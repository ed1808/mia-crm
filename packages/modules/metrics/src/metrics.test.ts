import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { SQL } from 'bun';
import { withTenant } from '@mia-crm/db';
import {
  BunSqlMetricsRepository,
  ExplainMetricUseCase,
  GOVERNED_AUTOMOTIVE_KPIS,
  ListKpiDefinitionsUseCase,
  QueryMetricUseCase,
} from './index';

const ADMIN_DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://mia_admin:mia_admin_password@localhost:5432/mia_crm_dev';
const APP_DATABASE_URL =
  'postgresql://mia_app:mia_app_password@localhost:5432/mia_crm_dev';

describe('Metrics Module: Semantic Layer, Governed Automotive KPIs & A/B Experimentation (M6)', () => {
  let adminSql: SQL;
  let appSql: SQL;
  let tenantId: string;

  beforeAll(async () => {
    adminSql = new SQL(ADMIN_DATABASE_URL);
    appSql = new SQL(APP_DATABASE_URL);

    // Crear tenant de prueba
    const [t] = await adminSql<{ id: string }[]>`
      INSERT INTO tenants (name, slug)
      VALUES ('Concesionario Semántico del Caribe', 'semantico-caribe')
      RETURNING id
    `;
    tenantId = t!.id;

    // Poblar datos de prueba: vehículos, órdenes de taller, oportunidades (con grupo de control) y leads
    await withTenant(appSql, { tenantId }, async (tx) => {
      // 1. Cliente (Party)
      const [p] = await tx<{ id: string }[]>`
        INSERT INTO parties (tenant_id, party_type)
        VALUES (${tenantId}::uuid, 'person')
        RETURNING id
      `;
      const partyId = p!.id;

      // 2. Vehículos
      const [v1] = await tx<{ id: string }[]>`
        INSERT INTO vehicles (tenant_id, vin, current_plate, make, model, vehicle_type)
        VALUES (${tenantId}::uuid, 'VIN-MET-001', 'MET001', 'Toyota', 'Hilux', 'passenger')
        RETURNING id
      `;
      const [v2] = await tx<{ id: string }[]>`
        INSERT INTO vehicles (tenant_id, vin, current_plate, make, model, vehicle_type)
        VALUES (${tenantId}::uuid, 'VIN-MET-002', 'MET002', 'Hino', '300', 'commercial')
        RETURNING id
      `;
      const [v3] = await tx<{ id: string }[]>`
        INSERT INTO vehicles (tenant_id, vin, current_plate, make, model, vehicle_type)
        VALUES (${tenantId}::uuid, 'VIN-MET-003', 'MET003', 'Mazda', 'CX-30', 'passenger')
        RETURNING id
      `;

      // 3. Órdenes de taller recientes (para retención y retorno)
      await tx`
        INSERT INTO work_orders (tenant_id, vehicle_id, party_id, external_id, order_number, branch_code, order_type, status, entered_at)
        VALUES
          (${tenantId}::uuid, ${v1!.id}::uuid, ${partyId}::uuid, 'DMS-OT-101', 101, 1, 'maintenance', 'completed', NOW() - INTERVAL '3 months'),
          (${tenantId}::uuid, ${v2!.id}::uuid, ${partyId}::uuid, 'DMS-OT-102', 102, 1, 'maintenance', 'completed', NOW() - INTERVAL '6 months')
      `;

      // 4. Proyección de próxima visita
      await tx`
        INSERT INTO next_visit_projections (tenant_id, vehicle_id, projected_date, projected_mileage, projection_method, confidence_level, calculation_basis)
        VALUES
          (${tenantId}::uuid, ${v1!.id}::uuid, NOW() - INTERVAL '2 months', 20000, 'own_history', 'high', '{"method": "history"}'::jsonb),
          (${tenantId}::uuid, ${v3!.id}::uuid, NOW() + INTERVAL '1 month', 10000, 'plan', 'medium', '{"method": "plan"}'::jsonb)
      `;

      // 5. Oportunidades: Intervenidas vs Grupo de Control 15% (Decisión D-39)
      await tx`
        INSERT INTO opportunities (
          tenant_id, rule_id, vehicle_id, party_id, status, score, value_estimate, is_control_group, evidence
        ) VALUES
          -- Intervenidas
          (${tenantId}::uuid, 'R-MNT-01', ${v1!.id}::uuid, ${partyId}::uuid, 'converted', 85, 450000, FALSE, '{"test": true}'::jsonb),
          (${tenantId}::uuid, 'R-WAR-01', ${v2!.id}::uuid, ${partyId}::uuid, 'appointment_requested', 90, 600000, FALSE, '{"test": true}'::jsonb),
          (${tenantId}::uuid, 'R-RET-01', ${v3!.id}::uuid, ${partyId}::uuid, 'detected', 70, 350000, FALSE, '{"test": true}'::jsonb),
          -- Grupo de Control (no intervenidas)
          (${tenantId}::uuid, 'R-MNT-01', ${v1!.id}::uuid, ${partyId}::uuid, 'detected', 80, 450000, TRUE, '{"test": true}'::jsonb)
      `;

      // 6. Leads (para SLA de primer contacto)
      await tx`
        INSERT INTO leads (
          tenant_id, first_name, last_name, phone, source, status, sla_due_at, first_contacted_at
        ) VALUES
          -- Lead contactado a tiempo (15 min de 30 min SLA)
          (${tenantId}::uuid, 'Juan', 'Pérez', '3001112233', 'meta_lead_ads', 'contacted',
           NOW() + INTERVAL '15 minutes', NOW() - INTERVAL '15 minutes'),
          -- Lead contactado tarde (SLA vencido)
          (${tenantId}::uuid, 'Ana', 'Ríos', '3104445566', 'web_form', 'contacted',
           NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '5 minutes')
      `;
    });
  });

  afterAll(async () => {
    if (tenantId) {
      await adminSql`DELETE FROM tenants WHERE id = ${tenantId}::uuid`;
    }
    await adminSql.close();
    await appSql.close();
  });

  describe('1. Canonical Governed KPI Catalog', () => {
    it('contains all 6 governed automotive KPIs with formulas and descriptions', () => {
      expect(GOVERNED_AUTOMOTIVE_KPIS.length).toBe(6);

      const codes = GOVERNED_AUTOMOTIVE_KPIS.map((k) => k.code);
      expect(codes).toContain('vehicle_retention_rate');
      expect(codes).toContain('workshop_return_rate');
      expect(codes).toContain('opportunity_conversion_rate');
      expect(codes).toContain('control_group_incremental_lift');
      expect(codes).toContain('lead_first_response_sla_compliance');
      expect(codes).toContain('aftersales_revenue_per_vehicle');

      for (const kpi of GOVERNED_AUTOMOTIVE_KPIS) {
        expect(kpi.formula.length).toBeGreaterThan(5);
        expect(kpi.description.length).toBeGreaterThan(15);
      }
    });

    it('ListKpiDefinitionsUseCase ensures catalog in database under tenant RLS', async () => {
      await withTenant(appSql, { tenantId }, async (tx) => {
        const repo = new BunSqlMetricsRepository(tx);
        const listKpisUc = new ListKpiDefinitionsUseCase(repo);

        const kpis = await listKpisUc.execute();
        expect(kpis.length).toBeGreaterThanOrEqual(6);

        const retention = kpis.find((k) => k.code === 'vehicle_retention_rate');
        expect(retention).toBeDefined();
        expect(retention?.name).toContain('Retención del Vehículo');
      });
    });

    it('ExplainMetricUseCase provides plain Colombian Spanish business explanation and formula', async () => {
      await withTenant(appSql, { tenantId }, async (tx) => {
        const repo = new BunSqlMetricsRepository(tx);
        const explainUc = new ExplainMetricUseCase(repo);

        const expRes = await explainUc.execute('vehicle_retention_rate');
        expect(expRes.ok).toBe(true);
        if (!expRes.ok) return;

        expect(expRes.value.code).toBe('vehicle_retention_rate');
        expect(expRes.value.formula).toContain('parque_atribuible_activo');
        expect(expRes.value.businessInterpretation).toContain('Colombia');
      });
    });
  });

  describe('2. Governed Query Engine (QueryMetricUseCase)', () => {
    it('rejects un-governed or fictitious KPI queries with typed DomainError', async () => {
      await withTenant(appSql, { tenantId }, async (tx) => {
        const repo = new BunSqlMetricsRepository(tx);
        const queryUc = new QueryMetricUseCase(repo);

        const invalidRes = await queryUc.execute({
          kpiCode: 'fictitious_random_metric_not_governed',
        });
        expect(invalidRes.ok).toBe(false);
        if (!invalidRes.ok) {
          expect(invalidRes.error.code).toBe('INVALID_KPI_CODE');
        }
      });
    });

    it('calculates vehicle_retention_rate (D-13) with dimension breakdowns (make)', async () => {
      await withTenant(appSql, { tenantId }, async (tx) => {
        const repo = new BunSqlMetricsRepository(tx);
        const queryUc = new QueryMetricUseCase(repo);

        const res = await queryUc.execute({
          kpiCode: 'vehicle_retention_rate',
          dimensions: ['make'],
        });

        expect(res.ok).toBe(true);
        if (!res.ok) return;

        const metric = res.value;
        expect(metric.kpiCode).toBe('vehicle_retention_rate');
        expect(metric.currentValue.unit).toBe('percentage');
        // De 3 vehículos, 2 tuvieron servicio en los últimos 12m = 66.7%
        expect(metric.currentValue.value).toBeCloseTo(66.67, 1);
        expect(metric.breakdowns).toBeDefined();
        expect(metric.breakdowns?.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('calculates control_group_incremental_lift (D-39) comparing intervened vs control group', async () => {
      await withTenant(appSql, { tenantId }, async (tx) => {
        const repo = new BunSqlMetricsRepository(tx);
        const queryUc = new QueryMetricUseCase(repo);

        const res = await queryUc.execute({
          kpiCode: 'control_group_incremental_lift',
        });

        expect(res.ok).toBe(true);
        if (!res.ok) return;

        const liftMetric = res.value;
        expect(liftMetric.kpiCode).toBe('control_group_incremental_lift');
        expect(liftMetric.breakdowns?.length).toBe(2);

        // Intervenidas: 2 convertidas de 3 = 66.7%
        // Control: 0 convertidas de 1 = 0%
        // Lift = 66.7% - 0% = +66.7%
        expect(liftMetric.currentValue.value).toBeGreaterThan(0);
        expect(liftMetric.currentValue.formatted).toContain('+');
      });
    });

    it('calculates lead_first_response_sla_compliance accurately', async () => {
      await withTenant(appSql, { tenantId }, async (tx) => {
        const repo = new BunSqlMetricsRepository(tx);
        const queryUc = new QueryMetricUseCase(repo);

        const res = await queryUc.execute({
          kpiCode: 'lead_first_response_sla_compliance',
        });

        expect(res.ok).toBe(true);
        if (!res.ok) return;

        // 1 lead a tiempo, 1 tarde = 50%
        expect(res.value.currentValue.value).toBe(50);
        expect(res.value.currentValue.formatted).toBe('50.0%');
      });
    });

    it('generates the complete Executive Dashboard data in a single call', async () => {
      await withTenant(appSql, { tenantId }, async (tx) => {
        const repo = new BunSqlMetricsRepository(tx);
        const dashboard = await repo.getExecutiveDashboard();

        expect(dashboard.vehicleRetention).toBeDefined();
        expect(dashboard.workshopReturn).toBeDefined();
        expect(dashboard.opportunityConversion).toBeDefined();
        expect(dashboard.controlGroupLift).toBeDefined();
        expect(dashboard.leadSlaCompliance).toBeDefined();
        expect(dashboard.aftersalesRevenue).toBeDefined();
      });
    });
  });
});
