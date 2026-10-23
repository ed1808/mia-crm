import { Hono } from 'hono';
import { withTenant } from '@mia-crm/db';
import {
  BunSqlOpportunityRepository,
  BunSqlContactPressureRepository,
  UpdateOpportunityStatusUseCase,
  type OpportunityStatus,
  type RuleId,
} from '@mia-crm/module-opportunity';
import { tenantMiddleware } from '../middleware/tenant';

export function createOpportunitiesRouter() {
  const router = new Hono();

  router.use('*', tenantMiddleware);

  // GET /api/v1/opportunities — Listado priorizado para "Mi Día"
  router.get('/', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');

    const statusParam = c.req.query('status');
    const ruleId = c.req.query('ruleId');
    const isControlGroupParam = c.req.query('isControlGroup');
    const limit = Math.min(Number(c.req.query('limit') ?? 50), 100);
    const offset = Number(c.req.query('offset') ?? 0);

    const statuses = statusParam
      ? statusParam.split(',')
      : ['detected', 'in_progress', 'appointment_requested'];
    const statusLiteral = `{${statuses.join(',')}}`;

    const isControlGroup =
      isControlGroupParam !== undefined ? isControlGroupParam === 'true' : null;

    const result = await withTenant(db, { tenantId }, async (tx) => {
      const rows = await tx<
        {
          id: string;
          rule_id: string;
          rule_version: number;
          status: string;
          score: number;
          value_estimate: number | null;
          evidence: Record<string, unknown>;
          is_control_group: boolean;
          expires_at: string | null;
          converted_at: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
          // Datos del vehículo
          vehicle_id: string;
          vehicle_plate: string | null;
          vehicle_vin: string | null;
          vehicle_make: string;
          vehicle_model: string;
          vehicle_year: number | null;
          vehicle_type: string;
          vehicle_mileage: number | null;
          // Datos del titular / cliente
          party_id: string;
          party_name: string;
          party_id_number: string | null;
          party_phone: string | null;
          party_email: string | null;
          party_is_company: boolean;
        }[]
      >`
        SELECT
          opp.id,
          opp.rule_id,
          opp.rule_version,
          opp.status,
          opp.score,
          opp.value_estimate,
          opp.evidence,
          opp.is_control_group,
          opp.expires_at::text,
          opp.converted_at::text,
          opp.rejection_reason,
          opp.created_at::text,
          opp.updated_at::text,
          -- Vehículo
          v.id as vehicle_id,
          v.current_plate as vehicle_plate,
          v.vin as vehicle_vin,
          v.make as vehicle_make,
          v.model as vehicle_model,
          v.model_year as vehicle_year,
          v.vehicle_type,
          v.current_mileage as vehicle_mileage,
          -- Titular
          p.id as party_id,
          COALESCE(pers.first_name || ' ' || COALESCE(pers.last_name, ''), comp.legal_name, 'Sin nombre') as party_name,
          pi.id_number as party_id_number,
          cp_phone.value as party_phone,
          cp_email.value as party_email,
          (comp.party_id IS NOT NULL) as party_is_company
        FROM opportunities opp
        JOIN vehicles v ON v.id = opp.vehicle_id
        JOIN parties p ON p.id = opp.party_id
        LEFT JOIN persons pers ON pers.party_id = p.id
        LEFT JOIN companies comp ON comp.party_id = p.id
        LEFT JOIN party_identifiers pi ON pi.party_id = p.id
        LEFT JOIN party_contact_points cp_phone ON cp_phone.party_id = p.id AND cp_phone.channel = 'phone' AND cp_phone.is_primary = true
        LEFT JOIN party_contact_points cp_email ON cp_email.party_id = p.id AND cp_email.channel = 'email' AND cp_email.is_primary = true
        WHERE opp.status = ANY(${statusLiteral}::varchar[])
          AND (${ruleId ?? null}::varchar IS NULL OR opp.rule_id = ${ruleId})
          AND (${isControlGroup}::boolean IS NULL OR opp.is_control_group = ${isControlGroup})
        ORDER BY opp.score DESC, opp.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      return rows;
    });

    return c.json({ data: result, count: result.length, limit, offset });
  });

  // GET /api/v1/opportunities/summary — Resumen de KPIs de oportunidades
  router.get('/summary', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');

    const summary = await withTenant(db, { tenantId }, async (tx) => {
      const activeRows = await tx<{ count: string; total_value: string | null }[]>`
        SELECT
          count(*)::text as count,
          sum(value_estimate)::text as total_value
        FROM opportunities
        WHERE status IN ('detected', 'in_progress', 'appointment_requested')
          AND is_control_group = false
      `;

      const controlRows = await tx<{ count: string }[]>`
        SELECT count(*)::text as count
        FROM opportunities
        WHERE is_control_group = true
      `;

      const ruleBreakdown = await tx<{ rule_id: string; count: string }[]>`
        SELECT rule_id, count(*)::text as count
        FROM opportunities
        WHERE status IN ('detected', 'in_progress', 'appointment_requested')
        GROUP BY rule_id
        ORDER BY count DESC
      `;

      return {
        activeCount: Number(activeRows[0]?.count ?? '0'),
        estimatedPipelineValue: Number(activeRows[0]?.total_value ?? '0'),
        controlGroupCount: Number(controlRows[0]?.count ?? '0'),
        byRule: ruleBreakdown.map((r) => ({ ruleId: r.rule_id, count: Number(r.count) })),
      };
    });

    return c.json({ data: summary });
  });

  // PATCH /api/v1/opportunities/:id/status — Transición de estado del ciclo de vida
  router.patch('/:id/status', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');
    const opportunityId = c.req.param('id');
    const body = await c.req.json<{
      action: 'start_progress' | 'request_appointment' | 'convert' | 'reject' | 'expire';
      rejectionReason?: string;
    }>();

    if (!body.action) {
      return c.json({ error: 'BAD_REQUEST', message: 'Se requiere el campo action.' }, 400);
    }

    const result = await withTenant(db, { tenantId }, async (tx) => {
      const oppRepo = new BunSqlOpportunityRepository(tx);
      const contactPressureRepo = new BunSqlContactPressureRepository(tx);
      const useCase = new UpdateOpportunityStatusUseCase(oppRepo, contactPressureRepo);

      return await useCase.execute({
        opportunityId,
        action: body.action,
        rejectionReason: body.rejectionReason,
      });
    });

    if (!result.ok) {
      return c.json({ error: result.error.code, message: result.error.message }, 400);
    }

    return c.json({
      data: {
        id: result.value.id,
        status: result.value.status,
        updatedAt: new Date().toISOString(),
      },
    });
  });

  // POST /api/v1/opportunities/:id/appointment — Agendar cita de taller desde la oportunidad (D-19)
  router.post('/:id/appointment', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');
    const opportunityId = c.req.param('id');
    const body = await c.req.json<{
      scheduledAt: string;
      notes?: string;
      serviceType?: string;
    }>();

    if (!body.scheduledAt) {
      return c.json(
        { error: 'BAD_REQUEST', message: 'Se requiere la fecha y hora de la cita (scheduledAt).' },
        400,
      );
    }

    const result = await withTenant(db, { tenantId }, async (tx) => {
      // 1. Obtener la oportunidad
      const oppRows = await tx<{ vehicle_id: string; party_id: string }[]>`
        SELECT vehicle_id, party_id FROM opportunities WHERE id = ${opportunityId}::uuid LIMIT 1
      `;
      const opp = oppRows[0];
      if (!opp) return { ok: false, error: 'Oportunidad no encontrada' };

      // 2. Crear cita en appointments (origen = CRM)
      const scheduledDate = new Date(body.scheduledAt);
      const notes = body.notes
        ? `${body.serviceType ? `[${body.serviceType}] ` : ''}${body.notes}`
        : body.serviceType || 'Cita generada desde oportunidad predictiva CRM';

      const [appointment] = await tx<
        { id: string; scheduled_at: string; status: string; origin: string }[]
      >`
        INSERT INTO appointments (
          tenant_id, vehicle_id, party_id, scheduled_at, status, origin, notes
        ) VALUES (
          ${tenantId}::uuid, ${opp.vehicle_id}::uuid, ${opp.party_id}::uuid,
          ${scheduledDate.toISOString()}::timestamptz, 'scheduled', 'CRM', ${notes}
        )
        RETURNING id, scheduled_at::text, status, origin
      `;

      // 3. Actualizar la oportunidad a appointment_requested
      const oppRepo = new BunSqlOpportunityRepository(tx);
      const useCase = new UpdateOpportunityStatusUseCase(oppRepo);
      await useCase.execute({
        opportunityId,
        action: 'request_appointment',
      });

      return { ok: true, appointment };
    });

    if (!result.ok) {
      return c.json({ error: 'NOT_FOUND', message: result.error }, 404);
    }

    return c.json({ data: result.appointment });
  });

  return router;
}
