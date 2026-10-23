import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { SQL } from 'bun';
import { withTenant } from '@mia-crm/db';
import {
  NextVisitProjector,
  ProjectVehicleNextVisitUseCase,
  BunSqlMaintenanceProjectionRepository,
} from './index';

const ADMIN_DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://mia_admin:mia_admin_password@localhost:5432/mia_crm_dev';
const APP_DATABASE_URL = 'postgresql://mia_app:mia_app_password@localhost:5432/mia_crm_dev';

describe('Maintenance Module: Next Visit Projection Engine (Decisión D-35)', () => {
  let adminSql: SQL;
  let appSql: SQL;
  let tenantId: string;
  let vehicleId: string;

  beforeAll(async () => {
    adminSql = new SQL(ADMIN_DATABASE_URL);
    appSql = new SQL(APP_DATABASE_URL);

    // Crear tenant de prueba
    const [t] = await adminSql<{ id: string }[]>`
      INSERT INTO tenants (name, slug)
      VALUES ('Concesionario Projection Test', 'proj-test')
      RETURNING id
    `;
    tenantId = t!.id;

    // Crear vehículo de prueba
    const [v] = await adminSql<{ id: string }[]>`
      INSERT INTO vehicles (tenant_id, vin, current_plate, make, model, vehicle_type, current_mileage)
      VALUES (${tenantId}::uuid, 'VIN-TRACTO-99', 'TRC990', 'Kenworth', 'T800', 'commercial_heavy', 50000)
      RETURNING id
    `;
    vehicleId = v!.id;
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

  it('selects Strategy 1 (own_history, high confidence) when vehicle has 2 or more historical visits', () => {
    const projector = new NextVisitProjector();

    const visit1Date = new Date('2026-01-01T08:00:00Z');
    const visit2Date = new Date('2026-04-01T08:00:00Z'); // 90 días después

    const projection = projector.calculate({
      tenantId,
      vehicleId,
      vehicleType: 'commercial_heavy',
      currentMileage: 50000,
      visits: [
        { enteredAt: visit1Date, mileage: 35000, orderType: 'maintenance' },
        { enteredAt: visit2Date, mileage: 50000, orderType: 'maintenance' },
      ],
      lastVisitDate: visit2Date,
    });

    expect(projection.projectionMethod).toBe('own_history');
    expect(projection.confidenceLevel).toBe('high');

    // Debe proyectar 90 días después de visit2Date (~2026-06-30)
    const diffDays = Math.round(
      (projection.projectedDate.getTime() - visit2Date.getTime()) / (1000 * 60 * 60 * 24),
    );
    expect(diffDays).toBe(90);
    expect(projection.projectedMileage).toBeGreaterThan(50000);
  });

  it('selects Strategy 2 (cohort, medium confidence) when vehicle has only 1 visit', () => {
    const projector = new NextVisitProjector();
    const visit1Date = new Date('2026-03-01T08:00:00Z');

    const projection = projector.calculate({
      tenantId,
      vehicleId,
      vehicleType: 'passenger', // Liviano: cohorte 180 días
      currentMileage: 10000,
      visits: [{ enteredAt: visit1Date, mileage: 10000, orderType: 'maintenance' }],
      lastVisitDate: visit1Date,
    });

    expect(projection.projectionMethod).toBe('cohort');
    expect(projection.confidenceLevel).toBe('medium');

    const diffDays = Math.round(
      (projection.projectedDate.getTime() - visit1Date.getTime()) / (1000 * 60 * 60 * 24),
    );
    expect(diffDays).toBe(180);
  });

  it('selects Strategy 3 (plan, low confidence) when vehicle has no visits', () => {
    const projector = new NextVisitProjector();
    const today = new Date('2026-05-01T00:00:00Z');

    const projection = projector.calculate({
      tenantId,
      vehicleId,
      vehicleType: 'commercial_heavy',
      visits: [],
      referenceDate: today,
    });

    expect(projection.projectionMethod).toBe('plan');
    expect(projection.confidenceLevel).toBe('low');

    const diffDays = Math.round(
      (projection.projectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    expect(diffDays).toBe(90); // 90 días por defecto para pesados
  });

  it('persists and updates projection in PostgreSQL with RLS and Outbox events', async () => {
    const visit1Date = new Date('2026-01-10T08:00:00Z');
    const visit2Date = new Date('2026-04-10T08:00:00Z');

    // 1. Ejecutar caso de uso de proyección
    const result = await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlMaintenanceProjectionRepository(tx);
      const useCase = new ProjectVehicleNextVisitUseCase(repo);

      return await useCase.execute({
        tenantId,
        vehicleId,
        vehicleType: 'commercial_heavy',
        currentMileage: 50000,
        visits: [
          { enteredAt: visit1Date, mileage: 35000, orderType: 'maintenance' },
          { enteredAt: visit2Date, mileage: 50000, orderType: 'maintenance' },
        ],
        lastVisitDate: visit2Date,
      });
    });

    expect(result.ok).toBe(true);

    // 2. Verificar en PostgreSQL con withTenant
    await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlMaintenanceProjectionRepository(tx);
      const proj = await repo.findByVehicleId(vehicleId);

      expect(proj).not.toBeNull();
      expect(proj?.projectionMethod).toBe('own_history');
      expect(proj?.confidenceLevel).toBe('high');

      // 3. Verificar que se emitió el evento NextVisitProjected al Outbox
      const outboxRows = await tx<{ event_type: string }[]>`
        SELECT event_type FROM outbox_events
        WHERE aggregate_id = ${proj!.id} AND event_type = 'NextVisitProjected'
      `;
      expect(outboxRows.length).toBeGreaterThan(0);
    });
  });
});
