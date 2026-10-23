import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { SQL } from 'bun';
import { withTenant } from '@mia-crm/db';
import { createServer } from './index';

const ADMIN_DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://mia_admin:mia_admin_password@localhost:5432/mia_crm_dev';
const APP_DATABASE_URL = 'postgresql://mia_app:mia_app_password@localhost:5432/mia_crm_dev';

describe('ERP Webhook Ingestion API (/api/v1/ingest/erp)', () => {
  let adminSql: SQL;
  let appSql: SQL;
  let tenantId: string;
  let connectorId: string;
  const rawApiKey = 'connector-secret-key-xyz-12345';
  let app: ReturnType<typeof createServer>;

  beforeAll(async () => {
    adminSql = new SQL(ADMIN_DATABASE_URL);
    appSql = new SQL(APP_DATABASE_URL);
    app = createServer();

    // Crear tenant de prueba
    const [t] = await adminSql<{ id: string }[]>`
      INSERT INTO tenants (name, slug)
      VALUES ('Concesionario Ingesta Test', 'ingesta-test')
      RETURNING id
    `;
    tenantId = t!.id;

    // Hashear API Key
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(rawApiKey);
    const keyHash = hasher.digest('hex');

    // Crear conector para el tenant
    const [c] = await adminSql<{ id: string }[]>`
      INSERT INTO connectors (tenant_id, name, type, api_key_hash, is_active)
      VALUES (${tenantId}::uuid, 'Simulated ERP Connector', 'erp_sql_server', ${keyHash}, true)
      RETURNING id
    `;
    connectorId = c!.id;
  });

  afterAll(async () => {
    if (adminSql && tenantId) {
      await adminSql`DELETE FROM tenants WHERE id = ${tenantId}::uuid`;
      await adminSql.close();
    }
    if (appSql) {
      await appSql.close();
    }
  });

  it('rejects requests missing Bearer authorization with 401', async () => {
    const res = await app.request('/api/v1/ingest/erp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: 'EVT-01' }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('rejects requests with an invalid Bearer token with 401', async () => {
    const res = await app.request('/api/v1/ingest/erp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid-token-999',
      },
      body: JSON.stringify({ event_id: 'EVT-01' }),
    });

    expect(res.status).toBe(401);
  });

  it('accepts ERP webhook events with valid token, persists to inbox and responds with 202', async () => {
    const eventPayload = {
      event_id: 'EVT-TEST-100',
      source_table: 'terceros',
      operation: 'INSERT',
      captured_at: new Date().toISOString(),
      payload: {
        after: {
          nit: '800200300',
          nombres: 'Transportes Rápidos SAS',
          mail: 'contacto@transportesrapidos.com',
          celular: '3109998877',
        },
      },
    };

    const res = await app.request('/api/v1/ingest/erp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rawApiKey}`,
      },
      body: JSON.stringify(eventPayload),
    });

    expect(res.status).toBe(202);
    const data = await res.json();
    expect(data.status).toBe('accepted');
    expect(data.inserted).toBe(1);
    expect(data.deduplicated).toBe(0);
    expect(data.tenant_id).toBe(tenantId);

    // Verificar en base de datos con withTenant y RLS
    const stored = await withTenant(appSql, { tenantId }, async (tx) => {
      return await tx<{ event_id: string; source_table: string; connector_id: string }[]>`
        SELECT event_id, source_table, connector_id
        FROM inbox_events
        WHERE event_id = 'EVT-TEST-100'
      `;
    });

    expect(stored.length).toBe(1);
    expect(stored[0]?.event_id).toBe('EVT-TEST-100');
    expect(stored[0]?.source_table).toBe('terceros');
    expect(stored[0]?.connector_id).toBe(connectorId);
  });

  it('deduplicates re-delivered events with identical event_id idempotently', async () => {
    const eventPayload = {
      event_id: 'EVT-TEST-100', // Mismo ID que la prueba anterior
      source_table: 'terceros',
      operation: 'INSERT',
      payload: {
        after: {
          nit: '800200300',
        },
      },
    };

    const res = await app.request('/api/v1/ingest/erp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rawApiKey}`,
      },
      body: JSON.stringify(eventPayload),
    });

    expect(res.status).toBe(202);
    const data = await res.json();
    expect(data.status).toBe('accepted');
    expect(data.inserted).toBe(0);
    expect(data.deduplicated).toBe(1);
  });

  describe('HMAC-SHA256 Hardening & Replay Attack Protection (D-42 / M8)', () => {
    it('accepts webhooks with valid HMAC-SHA256 signature and valid timestamp', async () => {
      const eventPayload = {
        event_id: 'EVT-HMAC-VALID-01',
        source_table: 'terceros',
        operation: 'INSERT',
        payload: { after: { nit: '900123456', nombres: 'Logística Segura SAS' } },
      };
      const rawBody = JSON.stringify(eventPayload);
      const timestamp = String(Math.floor(Date.now() / 1000));

      const hasher = new Bun.CryptoHasher('sha256', rawApiKey);
      hasher.update(`${timestamp}.${rawBody}`);
      const signature = `sha256=${hasher.digest('hex')}`;

      const res = await app.request('/api/v1/ingest/erp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${rawApiKey}`,
          'X-Signature-256': signature,
          'X-Timestamp': timestamp,
        },
        body: rawBody,
      });

      expect(res.status).toBe(202);
      const data = await res.json();
      expect(data.status).toBe('accepted');
      expect(data.inserted).toBe(1);
    });

    it('rejects webhooks with forged or invalid HMAC signature with 403', async () => {
      const eventPayload = {
        event_id: 'EVT-HMAC-INVALID-01',
        source_table: 'terceros',
      };
      const rawBody = JSON.stringify(eventPayload);
      const timestamp = String(Math.floor(Date.now() / 1000));

      const res = await app.request('/api/v1/ingest/erp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${rawApiKey}`,
          'X-Signature-256': 'sha256=invalidhash000000000000000000000000000000000000000000000000000000',
          'X-Timestamp': timestamp,
        },
        body: rawBody,
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('FORBIDDEN');
    });

    it('rejects webhooks with expired timestamp (> 300s) to prevent replay attacks', async () => {
      const eventPayload = {
        event_id: 'EVT-HMAC-EXPIRED-01',
        source_table: 'terceros',
      };
      const rawBody = JSON.stringify(eventPayload);
      const oldTimestamp = String(Math.floor(Date.now() / 1000) - 600); // 10 minutos atrás

      const hasher = new Bun.CryptoHasher('sha256', rawApiKey);
      hasher.update(`${oldTimestamp}.${rawBody}`);
      const signature = `sha256=${hasher.digest('hex')}`;

      const res = await app.request('/api/v1/ingest/erp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${rawApiKey}`,
          'X-Signature-256': signature,
          'X-Timestamp': oldTimestamp,
        },
        body: rawBody,
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('FORBIDDEN');
      expect(data.message).toContain('ventana tolerada');
    });
  });
});
