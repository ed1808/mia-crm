import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { withTenant } from '@mia-crm/db';
import { SQL } from 'bun';
import {
  BunSqlContactPressureRepository,
  BunSqlOpportunityRepository,
  BunSqlRuleParamsRepository,
  ChurnRiskMaintenanceRule,
  CommercialRenewalRule,
  ControlGroupPolicy,
  DetectOpportunitiesUseCase,
  FleetConsolidationRule,
  ManageContactPressureUseCase,
  OverdueMaintenanceRule,
  RegulatoryRtmDueRule,
  RuleRegistry,
  Score,
  UpcomingMaintenanceRule,
  UpcomingWarrantyExpirationRule,
  UpdateOpportunityStatusUseCase,
} from './index';

const ADMIN_DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://mia_admin:mia_admin_password@localhost:5432/mia_crm_dev';
const APP_DATABASE_URL = 'postgresql://mia_app:mia_app_password@localhost:5432/mia_crm_dev';

describe('Opportunity Module: Predictive Rules, 15% Control Group & Lifecycle', () => {
  const fixedNow = new Date('2026-10-15T12:00:00Z');

  describe('Domain Rules Unit Evaluation', () => {
    it('R-MNT-01: UpcomingMaintenanceRule detects visit due within 30 days or 1000 km', () => {
      const rule = new UpcomingMaintenanceRule();

      // Caso 1: 15 días antes -> Detecta
      const dueIn15Days = new Date('2026-10-30T12:00:00Z');
      const res1 = rule.evaluate({
        vehicle: {
          id: 'v-1',
          tenantId: 't-1',
          make: 'Chevrolet',
          model: 'Onix',
          vehicleType: 'car',
          currentMileage: 29500,
          isCompanyOwner: false,
        },
        projection: {
          projectedDate: dueIn15Days,
          projectedMileage: 30000,
          projectionMethod: 'own_history',
          confidenceLevel: 'high',
        },
        now: fixedNow,
      });

      expect(res1).not.toBeNull();
      expect(res1?.ruleId).toBe('R-MNT-01');
      expect(res1?.score.value).toBeGreaterThan(60);
      expect(res1?.evidence.daysUntilProjected).toBe(15);

      // Caso 2: 50 días antes -> No detecta
      const dueIn50Days = new Date('2026-12-04T12:00:00Z');
      const res2 = rule.evaluate({
        vehicle: {
          id: 'v-1',
          tenantId: 't-1',
          make: 'Chevrolet',
          model: 'Onix',
          vehicleType: 'car',
          currentMileage: 20000,
          isCompanyOwner: false,
        },
        projection: {
          projectedDate: dueIn50Days,
          projectedMileage: 30000,
          projectionMethod: 'own_history',
          confidenceLevel: 'high',
        },
        now: fixedNow,
      });

      expect(res2).toBeNull();
    });

    it('R-MNT-02: OverdueMaintenanceRule detects overdue visit up to 90 days', () => {
      const rule = new OverdueMaintenanceRule();

      // Vencido hace 20 días
      const past20Days = new Date('2026-09-25T12:00:00Z');
      const res = rule.evaluate({
        vehicle: {
          id: 'v-2',
          tenantId: 't-1',
          make: 'Kenworth',
          model: 'T800',
          vehicleType: 'truck',
          isCompanyOwner: true,
        },
        projection: {
          projectedDate: past20Days,
          projectionMethod: 'cohort',
          confidenceLevel: 'medium',
        },
        now: fixedNow,
      });

      expect(res).not.toBeNull();
      expect(res?.ruleId).toBe('R-MNT-02');
      expect(res?.evidence.overdueDays).toBe(20);
      expect(res?.score.value).toBeGreaterThanOrEqual(75);
    });

    it('R-MNT-03: ChurnRiskMaintenanceRule detects inactivity greater than 365 days', () => {
      const rule = new ChurnRiskMaintenanceRule();

      const lastVisit400DaysAgo = new Date('2025-09-10T12:00:00Z');
      const res = rule.evaluate({
        vehicle: {
          id: 'v-3',
          tenantId: 't-1',
          make: 'Toyota',
          model: 'Hilux',
          vehicleType: 'pickup',
          isCompanyOwner: false,
        },
        lastVisitDate: lastVisit400DaysAgo,
        now: fixedNow,
      });

      expect(res).not.toBeNull();
      expect(res?.ruleId).toBe('R-MNT-03');
      expect(Number(res?.evidence.daysSinceLastVisit)).toBeGreaterThan(365);
    });

    it('R-WAR-01: UpcomingWarrantyExpirationRule triggers 60 days before warranty end', () => {
      const rule = new UpcomingWarrantyExpirationRule();

      const warrantyEndsIn40Days = new Date('2026-11-24T12:00:00Z');
      const res = rule.evaluate({
        vehicle: {
          id: 'v-4',
          tenantId: 't-1',
          make: 'Renault',
          model: 'Duster',
          vehicleType: 'car',
          warrantyEndDate: warrantyEndsIn40Days,
          isCompanyOwner: false,
        },
        now: fixedNow,
      });

      expect(res).not.toBeNull();
      expect(res?.ruleId).toBe('R-WAR-01');
      expect(res?.score.value).toBeGreaterThanOrEqual(80);
    });

    it('R-RET-01: CommercialRenewalRule identifies vehicles 3-5 years old with high mileage', () => {
      const rule = new CommercialRenewalRule();

      // Vehículo modelo 2022 (4 años en 2026) con 75,000 km
      const res = rule.evaluate({
        vehicle: {
          id: 'v-5',
          tenantId: 't-1',
          make: 'Hino',
          model: '300',
          modelYear: 2022,
          vehicleType: 'truck',
          currentMileage: 75000,
          isCompanyOwner: true,
        },
        now: fixedNow,
      });

      expect(res).not.toBeNull();
      expect(res?.ruleId).toBe('R-RET-01');
      expect(res?.evidence.ageYears).toBe(4);
    });

    it('R-FLT-01: FleetConsolidationRule triggers when company has >= 3 units due', () => {
      const rule = new FleetConsolidationRule();

      const res = rule.evaluate({
        vehicle: {
          id: 'v-6',
          tenantId: 't-1',
          make: 'Foton',
          model: 'Aumark',
          vehicleType: 'truck',
          isCompanyOwner: true,
        },
        fleetUnitCount: 5,
        now: fixedNow,
      });

      expect(res).not.toBeNull();
      expect(res?.ruleId).toBe('R-FLT-01');
      expect(res?.valueEstimate).toBe(5 * 450000);
    });

    it('R-RTM-01: RegulatoryRtmDueRule triggers within 30 days before statutory Colombian RTM (D-47)', () => {
      const rule = new RegulatoryRtmDueRule();

      const rtmDueIn20Days = new Date('2026-11-04T12:00:00Z');
      const res = rule.evaluate({
        vehicle: {
          id: 'v-7',
          tenantId: 't-1',
          make: 'Chevrolet',
          model: 'Spark',
          vehicleType: 'car',
          rtmDueDate: rtmDueIn20Days,
          isCompanyOwner: false,
        },
        now: fixedNow,
      });

      expect(res).not.toBeNull();
      expect(res?.ruleId).toBe('R-RTM-01');
      expect(res?.evidence.regulatoryCompliance).toBe('mandatory_colombian_rtm');
    });
  });

  describe('Deterministic 15% Control Group (D-39)', () => {
    it('is strictly deterministic: same vehicleId and salt yield identical assignment', () => {
      const testVehicleId = 'a4b8c9d0-1234-5678-90ab-cdef12345678';

      const first = ControlGroupPolicy.isControlGroup(testVehicleId);
      const second = ControlGroupPolicy.isControlGroup(testVehicleId);
      const third = ControlGroupPolicy.isControlGroup(testVehicleId);

      expect(first).toBe(second);
      expect(second).toBe(third);
    });

    it('approximates 15% distribution across a sample of 1,000 entities', () => {
      let controlCount = 0;
      const sampleSize = 1000;

      for (let i = 0; i < sampleSize; i++) {
        const fakeUuid = crypto.randomUUID();
        if (ControlGroupPolicy.isControlGroup(fakeUuid)) {
          controlCount++;
        }
      }

      const percentage = (controlCount / sampleSize) * 100;
      // Esperamos que esté entre 11% y 19% para una muestra uniforme de 1000
      expect(percentage).toBeGreaterThanOrEqual(11);
      expect(percentage).toBeLessThanOrEqual(19);
    });
  });

  describe('PostgreSQL Integration with Bun.sql, RLS, Deduplication & Cooldown', () => {
    let adminSql: SQL;
    let appSql: SQL;
    let tenantId: string;
    let vehicleId: string;
    let partyId: string;

    beforeAll(async () => {
      adminSql = new SQL(ADMIN_DATABASE_URL);
      appSql = new SQL(APP_DATABASE_URL);

      // Crear tenant para pruebas de oportunidad
      const [t] = await adminSql<{ id: string }[]>`
        INSERT INTO tenants (name, slug)
        VALUES ('Concesionario Oportunidades Test', 'opp-test')
        RETURNING id
      `;
      tenantId = t!.id;

      // Crear titular (Party) y Vehículo dentro del tenant
      await withTenant(appSql, { tenantId }, async (tx) => {
        const [p] = await tx<{ id: string }[]>`
          INSERT INTO parties (tenant_id, party_type)
          VALUES (${tenantId}::uuid, 'person')
          RETURNING id
        `;
        partyId = p!.id;

        await tx`
          INSERT INTO persons (party_id, tenant_id, first_name, last_name)
          VALUES (${partyId}::uuid, ${tenantId}::uuid, 'Carlos', 'Gómez')
        `;

        const [v] = await tx<{ id: string }[]>`
          INSERT INTO vehicles (tenant_id, vin, current_plate, make, model, model_year, vehicle_type, current_mileage, warranty_end_date, rtm_due_date)
          VALUES (
            ${tenantId}::uuid,
            '9BWCA4244FP888999',
            'ABC456',
            'Volkswagen',
            'Gol',
            2021,
            'car',
            58000,
            NOW() + INTERVAL '20 days',
            NOW() + INTERVAL '15 days'
          )
          RETURNING id
        `;
        vehicleId = v!.id;

        // Asignar Carlos Gómez como propietario primario
        await tx`
          INSERT INTO vehicle_relationships (
            tenant_id, vehicle_id, party_id, role, is_primary, valid_from
          ) VALUES (
            ${tenantId}::uuid, ${vehicleId}::uuid, ${partyId}::uuid, 'owner', true, NOW()
          )
        `;
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

    it('detects opportunities and saves them with transactional Outbox events', async () => {
      await withTenant(appSql, { tenantId }, async (tx) => {
        const oppRepo = new BunSqlOpportunityRepository(tx);
        const useCase = new DetectOpportunitiesUseCase(oppRepo);

        const result = await useCase.execute({
          tenantId,
          vehicle: {
            id: vehicleId,
            tenantId,
            vin: '9BWCA4244FP888999',
            plate: 'ABC456',
            make: 'Volkswagen',
            model: 'Gol',
            modelYear: 2021,
            vehicleType: 'car',
            currentMileage: 58000,
            warrantyEndDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
            rtmDueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
            primaryOwnerPartyId: partyId,
            isCompanyOwner: false,
          },
          projection: {
            projectedDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            projectedMileage: 60000,
            projectionMethod: 'own_history',
            confidenceLevel: 'high',
          },
          lastVisitDate: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000),
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const opportunities = result.value;
        expect(opportunities.length).toBeGreaterThanOrEqual(1);

        // Verificar que las oportunidades quedaron en PostgreSQL
        const rows = await tx<{ id: string; rule_id: string; status: string }[]>`
          SELECT id, rule_id, status FROM opportunities WHERE vehicle_id = ${vehicleId}::uuid
        `;
        expect(rows.length).toBe(opportunities.length);

        // Verificar que se emitieron eventos a outbox_events
        const outboxRows = await tx<{ event_type: string }[]>`
          SELECT event_type FROM outbox_events WHERE aggregate_type = 'Opportunity'
        `;
        expect(outboxRows.length).toBeGreaterThanOrEqual(1);
        expect(outboxRows.some((e) => e.event_type === 'OpportunityDetected')).toBe(true);
      });
    });

    it('enforces deduplication: executing detection again does not create duplicate active opportunities', async () => {
      await withTenant(appSql, { tenantId }, async (tx) => {
        const oppRepo = new BunSqlOpportunityRepository(tx);
        const useCase = new DetectOpportunitiesUseCase(oppRepo);

        // Contar oportunidades previas
        const prevRows = await tx<{ count: string }[]>`
          SELECT count(*)::text as count FROM opportunities WHERE vehicle_id = ${vehicleId}::uuid
        `;
        const initialCount = Number(prevRows[0]!.count);

        // Re-ejecutar detección
        const result = await useCase.execute({
          tenantId,
          vehicle: {
            id: vehicleId,
            tenantId,
            vin: '9BWCA4244FP888999',
            plate: 'ABC456',
            make: 'Volkswagen',
            model: 'Gol',
            modelYear: 2021,
            vehicleType: 'car',
            currentMileage: 58000,
            warrantyEndDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
            rtmDueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
            primaryOwnerPartyId: partyId,
            isCompanyOwner: false,
          },
          projection: {
            projectedDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            projectedMileage: 60000,
            projectionMethod: 'own_history',
            confidenceLevel: 'high',
          },
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // No debe haber nuevas oportunidades activas para este vehículo
        expect(result.value.length).toBe(0);

        const currentRows = await tx<{ count: string }[]>`
          SELECT count(*)::text as count FROM opportunities WHERE vehicle_id = ${vehicleId}::uuid
        `;
        expect(Number(currentRows[0]!.count)).toBe(initialCount);
      });
    });

    it('progresses opportunity lifecycle and triggers 45-day contact cooldown on rejection (D-38)', async () => {
      await withTenant(appSql, { tenantId }, async (tx) => {
        const oppRepo = new BunSqlOpportunityRepository(tx);
        const contactRepo = new BunSqlContactPressureRepository(tx);
        const updateUseCase = new UpdateOpportunityStatusUseCase(oppRepo, contactRepo);
        const pressureUseCase = new ManageContactPressureUseCase(contactRepo);

        // Obtener una oportunidad activa
        const opps = await oppRepo.findByVehicleId(vehicleId);
        const targetOpp = opps[0];
        expect(targetOpp).toBeDefined();
        if (!targetOpp) return;

        // 1. Iniciar progreso
        const progressRes = await updateUseCase.execute({
          opportunityId: targetOpp.id,
          action: 'start_progress',
        });
        expect(progressRes.ok).toBe(true);
        expect(progressRes.value?.status).toBe('in_progress');

        // 2. Rechazar oportunidad con motivo
        const rejectRes = await updateUseCase.execute({
          opportunityId: targetOpp.id,
          action: 'reject',
          rejectionReason: 'Cliente vendió el carro recientemente',
        });
        expect(rejectRes.ok).toBe(true);
        expect(rejectRes.value?.status).toBe('rejected');

        // 3. Verificar que se activó el cooldown de 45 días (D-38)
        const canContactWhatsApp = await pressureUseCase.canContact(partyId, 'whatsapp');
        const canContactCall = await pressureUseCase.canContact(partyId, 'call');

        expect(canContactWhatsApp).toBe(false);
        expect(canContactCall).toBe(false);
      });
    });

    it('enforces tenant isolation under PostgreSQL RLS: Tenant 2 cannot see Tenant 1 opportunities', async () => {
      // Crear un segundo tenant
      const [t2] = await adminSql<{ id: string }[]>`
        INSERT INTO tenants (name, slug)
        VALUES ('Segundo Concesionario Isol Opp', 'isol-opp-test')
        RETURNING id
      `;
      const tenant2Id = t2!.id;

      try {
        await withTenant(appSql, { tenantId: tenant2Id }, async (tx) => {
          const rows = await tx<{ id: string }[]>`
            SELECT id FROM opportunities WHERE tenant_id = ${tenantId}::uuid
          `;
          expect(rows.length).toBe(0);

          const allOpps = await tx<{ id: string }[]>`
            SELECT id FROM opportunities
          `;
          expect(allOpps.length).toBe(0);
        });
      } finally {
        await adminSql`DELETE FROM tenants WHERE id = ${tenant2Id}::uuid`;
      }
    });
  });
});
