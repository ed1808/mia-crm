import { SQL } from 'bun';
import { withTenant } from '@mia-crm/db';
import { Hono } from 'hono';

export interface RawWebhookPayload {
  event_id?: string;
  source_table?: string;
  operation?: string;
  captured_at?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
}

export function createIngestRouter(options?: {
  sql?: SQL;
}) {
  const router = new Hono();
  const sql =
    options?.sql ??
    new SQL(
      process.env.APP_DATABASE_URL ||
        'postgresql://mia_app:mia_app_password@localhost:5432/mia_crm_dev',
    );

  const hashToken = (token: string): string => {
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(token);
    return hasher.digest('hex');
  };

  // POST /erp
  router.post('/erp', async (c) => {
    // 1. Validar Bearer Token
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json(
        { error: 'UNAUTHORIZED', message: 'Encabezado de autorización Bearer ausente o inválido.' },
        401,
      );
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Token de conector vacío.' }, 401);
    }

    const tokenHash = hashToken(token);

    // 2. Resolver conector y tenant de forma segura
    const lookup = await sql<{ connector_id: string; tenant_id: string; connector_name: string }[]>`
      SELECT connector_id, tenant_id, connector_name
      FROM lookup_connector_by_token(${tokenHash})
    `;

    if (!lookup || lookup.length === 0 || !lookup[0]) {
      return c.json(
        { error: 'UNAUTHORIZED', message: 'Token de conector inválido o inactivo.' },
        401,
      );
    }

    const { connector_id: connectorId, tenant_id: tenantId } = lookup[0];

    // 3. Leer cuerpo y validar firma HMAC si está presente (Decisión D-42: Endurecimiento de contrato)
    let body: unknown;
    const signatureHeader = c.req.header('X-Signature-256') || c.req.header('X-Hub-Signature-256');
    const timestampHeader = c.req.header('X-Timestamp');

    if (signatureHeader) {
      const rawText = await c.req.text();
      const { verifyWebhookHmac } = await import('../middleware/security');
      const hmacResult = verifyWebhookHmac(rawText, token, signatureHeader, timestampHeader);
      if (!hmacResult.valid) {
        return c.json(
          { error: 'FORBIDDEN', message: `Firma HMAC inválida: ${hmacResult.reason}` },
          403,
        );
      }
      try {
        body = JSON.parse(rawText);
      } catch {
        return c.json(
          { error: 'BAD_REQUEST', message: 'Cuerpo de solicitud JSON malformado.' },
          400,
        );
      }
    } else {
      try {
        body = await c.req.json();
      } catch {
        return c.json(
          { error: 'BAD_REQUEST', message: 'Cuerpo de solicitud JSON malformado.' },
          400,
        );
      }
    }

    const rawEvents: RawWebhookPayload[] = Array.isArray(body) ? body : [body as RawWebhookPayload];

    if (rawEvents.length === 0) {
      return c.json(
        { error: 'BAD_REQUEST', message: 'No se recibieron eventos para ingestar.' },
        400,
      );
    }

    // 4. Ingesta transaccional con RLS e idempotencia por event_id
    const results = await withTenant(sql, { tenantId }, async (tx) => {
      let insertedCount = 0;
      let deduplicatedCount = 0;

      for (const evt of rawEvents) {
        const eventId = String(evt.event_id || `EVT-${crypto.randomUUID()}`);
        const sourceTable = String(evt.source_table || 'unknown');
        const operation = String(evt.operation || 'INSERT');
        const capturedAt = evt.captured_at
          ? new Date(evt.captured_at).toISOString()
          : new Date().toISOString();
        const payloadJson = JSON.stringify(evt.payload ?? evt);

        const rows = await tx<{ id: string }[]>`
          INSERT INTO inbox_events (
            tenant_id,
            connector_id,
            event_id,
            source_table,
            operation,
            payload,
            captured_at
          ) VALUES (
            ${tenantId}::uuid,
            ${connectorId}::uuid,
            ${eventId},
            ${sourceTable},
            ${operation},
            ${payloadJson}::jsonb,
            ${capturedAt}::timestamptz
          )
          ON CONFLICT (tenant_id, event_id) DO NOTHING
          RETURNING id
        `;

        if (rows.length > 0) {
          insertedCount++;
        } else {
          deduplicatedCount++;
        }
      }

      return { insertedCount, deduplicatedCount };
    });

    // 5. Retornar 202 Accepted de inmediato
    return c.json(
      {
        status: 'accepted',
        received: rawEvents.length,
        inserted: results.insertedCount,
        deduplicated: results.deduplicatedCount,
        tenant_id: tenantId,
      },
      202,
    );
  });

  return router;
}
