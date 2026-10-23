import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { SQL } from 'bun';
import { withTenant } from '@mia-crm/db';
import { BunSqlMetricsRepository, ListKpiDefinitionsUseCase } from '@mia-crm/module-metrics';
import { createServer } from './index';

const ADMIN_DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://mia_admin:mia_admin_password@localhost:5432/mia_crm_dev';
const APP_DATABASE_URL = 'postgresql://mia_app:mia_app_password@localhost:5432/mia_crm_dev';

describe('HTTP API: Vehicles 360 & Mi Día Opportunities Routes', () => {
  let adminSql: SQL;
  let appSql: SQL;
  let tenantId: string;
  let vehicleId: string;
  let partyId: string;
  let opportunityId: string;
  const app = createServer();

  beforeAll(async () => {
    adminSql = new SQL(ADMIN_DATABASE_URL);
    appSql = new SQL(APP_DATABASE_URL);

    // Crear tenant de prueba
    const [t] = await adminSql<{ id: string }[]>`
      INSERT INTO tenants (name, slug)
      VALUES ('Concesionario API Test', 'api-routes-test')
      RETURNING id
    `;
    tenantId = t!.id;

    // Crear titular, vehículo, orden de trabajo y oportunidad
    await withTenant(appSql, { tenantId }, async (tx) => {
      const [p] = await tx<{ id: string }[]>`
        INSERT INTO parties (tenant_id, party_type)
        VALUES (${tenantId}::uuid, 'person')
        RETURNING id
      `;
      partyId = p!.id;

      await tx`
        INSERT INTO persons (party_id, tenant_id, first_name, last_name)
        VALUES (${partyId}::uuid, ${tenantId}::uuid, 'Diana', 'Restrepo')
      `;

      await tx`
        INSERT INTO party_identifiers (tenant_id, party_id, id_type, id_number)
        VALUES (${tenantId}::uuid, ${partyId}::uuid, 'CC', '1020304050')
      `;

      await tx`
        INSERT INTO party_contact_points (tenant_id, party_id, channel, value, is_primary)
        VALUES
          (${tenantId}::uuid, ${partyId}::uuid, 'phone', '3124567890', true),
          (${tenantId}::uuid, ${partyId}::uuid, 'email', 'diana.restrepo@example.com', true)
      `;

      const [v] = await tx<{ id: string }[]>`
        INSERT INTO vehicles (
          tenant_id, vin, current_plate, make, model, model_year, vehicle_type,
          current_mileage, warranty_end_date, rtm_due_date
        ) VALUES (
          ${tenantId}::uuid,
          '1HGCR2F83HA001122',
          'MED345',
          'Mazda',
          'CX-30',
          2022,
          'car',
          35000,
          NOW() + INTERVAL '30 days',
          NOW() + INTERVAL '10 days'
        )
        RETURNING id
      `;
      vehicleId = v!.id;

      await tx`
        INSERT INTO vehicle_relationships (
          tenant_id, vehicle_id, party_id, role, is_primary, valid_from
        ) VALUES (
          ${tenantId}::uuid, ${vehicleId}::uuid, ${partyId}::uuid, 'owner', true, NOW()
        )
      `;

      await tx`
        INSERT INTO next_visit_projections (
          tenant_id, vehicle_id, projected_date, projected_mileage,
          projection_method, confidence_level, calculation_basis
        ) VALUES (
          ${tenantId}::uuid, ${vehicleId}::uuid, (NOW() + INTERVAL '12 days')::date, 40000,
          'own_history', 'high', '{"avgDays": 180}'::jsonb
        )
      `;

      const [opp] = await tx<{ id: string }[]>`
        INSERT INTO opportunities (
          tenant_id, rule_id, rule_version, vehicle_id, party_id,
          status, score, value_estimate, evidence, is_control_group
        ) VALUES (
          ${tenantId}::uuid, 'R-MNT-01', 1, ${vehicleId}::uuid, ${partyId}::uuid,
          'detected', 88.50, 450000, '{"daysUntil": 12}'::jsonb, false
        )
        RETURNING id
      `;
      opportunityId = opp!.id;

      // Inicializar catálogo gobernado de KPIs para el tenant de prueba
      const metricsRepo = new BunSqlMetricsRepository(tx);
      const listKpis = new ListKpiDefinitionsUseCase(metricsRepo);
      await listKpis.execute();
    });
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

  it('GET /api/v1/vehicles returns vehicle list with owner and projection', async () => {
    const res = await app.request('/api/v1/vehicles', {
      headers: { 'x-tenant-id': tenantId },
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { current_plate: string; make: string; owner_name: string }[] };
    expect(json.data.length).toBeGreaterThanOrEqual(1);

    const vehicle = json.data.find((v) => v.current_plate === 'MED345');
    expect(vehicle).toBeDefined();
    expect(vehicle?.make).toBe('Mazda');
    expect(vehicle?.owner_name).toContain('Diana Restrepo');
  });

  it('GET /api/v1/vehicles/:id returns full Vehicle 360 data', async () => {
    const res = await app.request(`/api/v1/vehicles/${vehicleId}`, {
      headers: { 'x-tenant-id': tenantId },
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: {
        vehicle: { vin: string; current_plate: string };
        ownership: { currentPrimaryOwner: { party_name: string; phone: string } };
        projection: { projection_method: string };
        opportunities: { rule_id: string }[];
      };
    };

    expect(json.data.vehicle.vin).toBe('1HGCR2F83HA001122');
    expect(json.data.ownership.currentPrimaryOwner.party_name).toContain('Diana Restrepo');
    expect(json.data.ownership.currentPrimaryOwner.phone).toBe('3124567890');
    expect(json.data.projection.projection_method).toBe('own_history');
    expect(json.data.opportunities.length).toBeGreaterThanOrEqual(1);
    expect(json.data.opportunities[0]?.rule_id).toBe('R-MNT-01');
  });

  it('GET /api/v1/opportunities returns prioritized opportunities for Mi Día', async () => {
    const res = await app.request('/api/v1/opportunities', {
      headers: { 'x-tenant-id': tenantId },
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { id: string; rule_id: string; score: number; vehicle_plate: string; party_name: string }[];
    };

    expect(json.data.length).toBeGreaterThanOrEqual(1);
    const opp = json.data.find((o) => o.id === opportunityId);
    expect(opp).toBeDefined();
    expect(opp?.vehicle_plate).toBe('MED345');
    expect(opp?.party_name).toContain('Diana Restrepo');
    expect(Number(opp?.score)).toBeCloseTo(88.5, 1);
  });

  it('GET /api/v1/opportunities/summary returns aggregated counts and value', async () => {
    const res = await app.request('/api/v1/opportunities/summary', {
      headers: { 'x-tenant-id': tenantId },
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { activeCount: number; estimatedPipelineValue: number; byRule: { ruleId: string }[] };
    };

    expect(json.data.activeCount).toBeGreaterThanOrEqual(1);
    expect(json.data.estimatedPipelineValue).toBeGreaterThan(0);
    expect(json.data.byRule.some((r) => r.ruleId === 'R-MNT-01')).toBe(true);
  });

  it('PATCH /api/v1/opportunities/:id/status transitions status to in_progress and reject', async () => {
    // 1. Iniciar progreso
    const progressRes = await app.request(`/api/v1/opportunities/${opportunityId}/status`, {
      method: 'PATCH',
      headers: {
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'start_progress' }),
    });

    expect(progressRes.status).toBe(200);
    const progressJson = (await progressRes.json()) as { data: { status: string } };
    expect(progressJson.data.status).toBe('in_progress');

    // 2. Rechazar
    const rejectRes = await app.request(`/api/v1/opportunities/${opportunityId}/status`, {
      method: 'PATCH',
      headers: {
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'reject',
        rejectionReason: 'Cliente no tiene presupuesto este mes',
      }),
    });

    expect(rejectRes.status).toBe(200);
    const rejectJson = (await rejectRes.json()) as { data: { status: string } };
    expect(rejectJson.data.status).toBe('rejected');
  });

  it('POST /api/v1/opportunities/:id/appointment schedules workshop appointment and updates status', async () => {
    // Crear una nueva oportunidad para agendar cita
    let newOppId = '';
    await withTenant(appSql, { tenantId }, async (tx) => {
      const [opp] = await tx<{ id: string }[]>`
        INSERT INTO opportunities (
          tenant_id, rule_id, rule_version, vehicle_id, party_id,
          status, score, value_estimate, evidence, is_control_group
        ) VALUES (
          ${tenantId}::uuid, 'R-WAR-01', 1, ${vehicleId}::uuid, ${partyId}::uuid,
          'detected', 90.00, 800000, '{"warrantyEnd": "2026-11-20"}'::jsonb, false
        )
        RETURNING id
      `;
      newOppId = opp!.id;
    });

    const apptRes = await app.request(`/api/v1/opportunities/${newOppId}/appointment`, {
      method: 'POST',
      headers: {
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        scheduledAt: '2026-10-20T08:30:00',
        serviceType: 'Revisión Preventiva Fin de Garantía',
        notes: 'Sede Principal Calle 26 Bogotá. Cliente solicita revisión de caja',
      }),
    });

    expect(apptRes.status).toBe(200);
    const apptJson = (await apptRes.json()) as { data: { id: string; status: string; origin: string } };
    expect(apptJson.data.id).toBeDefined();
    expect(apptJson.data.status).toBe('scheduled');
    expect(apptJson.data.origin).toBe('CRM');

    // Verificar que la oportunidad pasó a appointment_requested
    await withTenant(appSql, { tenantId }, async (tx) => {
      const rows = await tx<{ status: string }[]>`
        SELECT status FROM opportunities WHERE id = ${newOppId}::uuid
      `;
      expect(rows[0]?.status).toBe('appointment_requested');
    });
  });

  describe('Commercial API Endpoints (/api/v1/commercial)', () => {
    let createdLeadId: string;
    let convertedDealId: string;

    it('GET /api/v1/commercial/pipelines returns the 4 automotive pipelines and stages', async () => {
      const res = await app.request('/api/v1/commercial/pipelines', {
        headers: { 'x-tenant-id': tenantId },
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { data: { code: string; name: string; stages: { name: string }[] }[] };
      expect(json.data.length).toBe(4);

      const passenger = json.data.find((p) => p.code === 'new_passenger');
      expect(passenger).toBeDefined();
      expect(passenger?.stages.length).toBeGreaterThanOrEqual(5);

      const commercial = json.data.find((p) => p.code === 'commercial_heavy');
      expect(commercial).toBeDefined();

      const usedTradeIn = json.data.find((p) => p.code === 'used_tradein');
      expect(usedTradeIn).toBeDefined();

      const fleetB2b = json.data.find((p) => p.code === 'fleet_b2b');
      expect(fleetB2b).toBeDefined();
    });

    it('POST /api/v1/commercial/leads creates a new inbound automotive lead', async () => {
      const res = await app.request('/api/v1/commercial/leads', {
        method: 'POST',
        headers: {
          'x-tenant-id': tenantId,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          firstName: 'Mauricio',
          lastName: 'Cárdenas',
          phone: '+573104448899',
          email: 'm.cardenas@empresa.com.co',
          source: 'meta_lead_ads',
          interestedVehicleModel: 'Camión Hino Serie 300 4x2',
          notes: 'Requiere furgón refrigerado para distribución de alimentos en Bogotá',
          slaMinutes: 30,
        }),
      });

      expect(res.status).toBe(201);
      const json = (await res.json()) as { data: { id: string; status: string } };
      expect(json.data.id).toBeDefined();
      expect(json.data.status).toBe('new');
      createdLeadId = json.data.id;
    });

    it('PATCH /api/v1/commercial/leads/:id/contact registers first contact', async () => {
      const res = await app.request(`/api/v1/commercial/leads/${createdLeadId}/contact`, {
        method: 'PATCH',
        headers: { 'x-tenant-id': tenantId },
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { data: { status: string; firstContactedAt: string } };
      expect(json.data.status).toBe('contacted');
      expect(json.data.firstContactedAt).toBeDefined();
    });

    it('POST /api/v1/commercial/leads/:id/convert converts lead into a Deal in pipeline', async () => {
      const res = await app.request(`/api/v1/commercial/leads/${createdLeadId}/convert`, {
        method: 'POST',
        headers: {
          'x-tenant-id': tenantId,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          dealTitle: 'Camión Hino Serie 300 Furgón — Mauricio Cárdenas',
          estimatedValue: 240000000,
        }),
      });

      expect(res.status).toBe(201);
      const json = (await res.json()) as { data: { dealId: string; title: string; status: string } };
      expect(json.data.dealId).toBeDefined();
      expect(json.data.status).toBe('open');
      convertedDealId = json.data.dealId;
    });

    it('POST /api/v1/commercial/deals/:id/quotes creates a formal quote and recalculates deal value', async () => {
      const res = await app.request(`/api/v1/commercial/deals/${convertedDealId}/quotes`, {
        method: 'POST',
        headers: {
          'x-tenant-id': tenantId,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          quoteNumber: 'COT-2026-HINO-01',
          items: [
            { id: '1', concept: 'Chasis Cabinado Hino 300', unitPrice: 190000000, quantity: 1, taxPct: 19 },
            { id: '2', concept: 'Furgón Isotérmico con Unidad Thermo King', unitPrice: 50000000, quantity: 1, taxPct: 19 },
          ],
          discountAmount: 10000000,
          tradeInAllowance: 60000000,
          paymentTerms: 'Leasing Bancolombia 48 meses',
          validDays: 15,
        }),
      });

      expect(res.status).toBe(201);
      const json = (await res.json()) as { data: { id: string; quoteNumber: string; netAmount: number } };
      expect(json.data.id).toBeDefined();
      expect(json.data.quoteNumber).toBe('COT-2026-HINO-01');
      // Subtotal 240M - 10M disc = 230M + 19% IVA (45.6M) = 275.6M - 60M retoma = 215.600.000 COP
      expect(json.data.netAmount).toBe(215600000);
    });

    it('POST /api/v1/commercial/sales/reconcile reconciles ERP sale with quote and vehicle', async () => {
      const res = await app.request('/api/v1/commercial/sales/reconcile', {
        method: 'POST',
        headers: {
          'x-tenant-id': tenantId,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          vehicleId,
          customerPartyId: partyId,
          dealId: convertedDealId,
          externalOrderNumber: 'PED-ERP-9912',
          externalInvoiceNumber: 'FAC-VEH-5541',
          saleAmount: 225600000,
          saleDate: '2026-10-15',
          deliveryDate: '2026-10-22',
        }),
      });

      expect(res.status).toBe(201);
      const json = (await res.json()) as { data: { id: string; status: string; externalOrderNumber: string } };
      expect(json.data.id).toBeDefined();
      expect(json.data.status).toBe('completed');
      expect(json.data.externalOrderNumber).toBe('PED-ERP-9912');
    });
  });

  describe('Semantic Metrics Layer & Governed KPIs (/api/v1/metrics)', () => {
    it('GET /api/v1/metrics/definitions returns governed automotive KPI definitions', async () => {
      const res = await app.request('/api/v1/metrics/definitions', {
        headers: { 'x-tenant-id': tenantId },
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { data: { code: string; name: string; formula: string }[] };
      expect(json.data.length).toBeGreaterThanOrEqual(6);

      const retention = json.data.find((k) => k.code === 'vehicle_retention_rate');
      expect(retention).toBeDefined();
      expect(retention?.name).toContain('Retención del Vehículo');
      expect(retention?.formula).toContain('parque_atribuible');
    });

    it('GET /api/v1/metrics/explain/:code returns formula and Colombian business interpretation', async () => {
      const res = await app.request('/api/v1/metrics/explain/control_group_incremental_lift', {
        headers: { 'x-tenant-id': tenantId },
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { data: { code: string; businessInterpretation: string } };
      expect(json.data.code).toBe('control_group_incremental_lift');
      expect(json.data.businessInterpretation).toContain('CRM');
    });

    it('GET /api/v1/metrics/query returns governed calculation with breakdowns', async () => {
      const res = await app.request('/api/v1/metrics/query?kpi=vehicle_retention_rate&dimension=make', {
        headers: { 'x-tenant-id': tenantId },
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        data: {
          kpiCode: string;
          currentValue: { value: number; unit: string; formatted: string };
          breakdowns?: { key: string; value: number }[];
        };
      };

      expect(json.data.kpiCode).toBe('vehicle_retention_rate');
      expect(json.data.currentValue.unit).toBe('percentage');
      expect(json.data.breakdowns).toBeDefined();
    });

    it('GET /api/v1/metrics/dashboard returns the full executive dashboard', async () => {
      const res = await app.request('/api/v1/metrics/dashboard', {
        headers: { 'x-tenant-id': tenantId },
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        data: {
          vehicleRetention: { currentValue: { formatted: string } };
          controlGroupLift: { currentValue: { formatted: string } };
          opportunityConversion: { currentValue: { formatted: string } };
          leadSlaCompliance: { currentValue: { formatted: string } };
        };
      };

      expect(json.data.vehicleRetention).toBeDefined();
      expect(json.data.controlGroupLift).toBeDefined();
      expect(json.data.opportunityConversion).toBeDefined();
      expect(json.data.leadSlaCompliance).toBeDefined();
    });
  });

  describe('Autonomous AI Gateway & Copilot Routes (M7)', () => {
    it('GET /api/v1/ai/tools returns governed tools for the requested role', async () => {
      const res = await app.request('/api/v1/ai/tools?role=executive_manager', {
        headers: { 'x-tenant-id': tenantId },
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { data: { name: string; autonomyLevel: number }[] };
      expect(json.data.length).toBeGreaterThan(0);
      const queryMetricTool = json.data.find((t) => t.name === 'query_metric');
      expect(queryMetricTool).toBeDefined();
      expect(queryMetricTool?.autonomyLevel).toBe(0);
    });

    it('POST /api/v1/ai/execute executes governed Level 0 tool directly', async () => {
      const res = await app.request('/api/v1/ai/execute', {
        method: 'POST',
        headers: {
          'x-tenant-id': tenantId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'executive_manager',
          toolName: 'explain_metric',
          arguments: { kpiCode: 'vehicle_retention_rate' },
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { data: { status: string; data: { formula: string } } };
      expect(json.data.status).toBe('executed');
      expect(json.data.data.formula).toContain('parque_atribuible_activo');
    });

    it('POST /api/v1/ai/chat conducts contextual chat with Copiloto MIA', async () => {
      const res = await app.request('/api/v1/ai/chat', {
        method: 'POST',
        headers: {
          'x-tenant-id': tenantId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'executive_manager',
          message: '¿Cómo está la retención de vehículos?',
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        data: {
          response: string;
          toolExecutions: { toolName: string; autonomyLevel: number }[];
        };
      };

      expect(json.data.response.length).toBeGreaterThan(10);
      expect(json.data.toolExecutions.length).toBeGreaterThan(0);
      expect(json.data.toolExecutions[0]?.toolName).toBe('query_metric');
    });

    it('POST /api/v1/ai/execute on Level 2 generates proposal and pending approval', async () => {
      const res = await app.request('/api/v1/ai/execute', {
        method: 'POST',
        headers: {
          'x-tenant-id': tenantId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'service_advisor',
          toolName: 'draft_message',
          arguments: {
            phone: '3001234567',
            recipientName: 'Diana Restrepo',
            messageBody: 'Hola Diana, recordatorio de mantenimiento de tu Toyota Hilux.',
            channel: 'whatsapp',
          },
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        data: {
          executionId: string;
          status: string;
          autonomyLevel: number;
          proposal: { waMeUrl: string };
        };
      };

      expect(json.data.status).toBe('pending_approval');
      expect(json.data.autonomyLevel).toBe(2);
      expect(json.data.proposal.waMeUrl).toContain('wa.me');

      // Aprobar la propuesta
      const approveRes = await app.request('/api/v1/ai/approve', {
        method: 'POST',
        headers: {
          'x-tenant-id': tenantId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          executionId: json.data.executionId,
          action: 'approve',
        }),
      });

      expect(approveRes.status).toBe(200);
      const approveJson = (await approveRes.json()) as { data: { status: string } };
      expect(approveJson.data.status).toBe('approved');
    });
  });
});

