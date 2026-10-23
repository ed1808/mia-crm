import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { SQL } from 'bun';
import { withTenant } from '@mia-crm/db';
import { IngestWorkOrderFromErpUseCase, BunSqlWorkOrderRepository } from './index';

const ADMIN_DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://mia_admin:mia_admin_password@localhost:5432/mia_crm_dev';
const APP_DATABASE_URL = 'postgresql://mia_app:mia_app_password@localhost:5432/mia_crm_dev';

describe('Aftersales Module: Work Order Classification & Lifecycle (Decisión D-46)', () => {
  let adminSql: SQL;
  let appSql: SQL;
  let tenantId: string;
  let vehicleId: string;
  let partyId: string;

  beforeAll(async () => {
    adminSql = new SQL(ADMIN_DATABASE_URL);
    appSql = new SQL(APP_DATABASE_URL);

    // Crear tenant de prueba
    const [t] = await adminSql<{ id: string }[]>`
      INSERT INTO tenants (name, slug)
      VALUES ('Concesionario Aftersales Test', 'aftersales-test')
      RETURNING id
    `;
    tenantId = t!.id;

    // Crear vehículo y cliente
    const [v] = await adminSql<{ id: string }[]>`
      INSERT INTO vehicles (tenant_id, vin, current_plate, make, model)
      VALUES (${tenantId}::uuid, 'VIN-AFTERSALES-01', 'AFT001', 'Renault', 'Duster')
      RETURNING id
    `;
    const [p] = await adminSql<{ id: string }[]>`
      INSERT INTO parties (tenant_id, party_type)
      VALUES (${tenantId}::uuid, 'person')
      RETURNING id
    `;

    vehicleId = v!.id;
    partyId = p!.id;
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

  it('ingests maintenance work order and emits WorkOrderOpened domain event', async () => {
    const result = await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlWorkOrderRepository(tx);
      const useCase = new IngestWorkOrderFromErpUseCase(repo);

      return await useCase.execute({
        tenantId,
        externalId: 'BOD1_OT_501',
        bodega: 1,
        orderNumber: 501,
        vehicleId,
        partyId,
        orderType: 'maintenance', // Decisión D-46
        status: 'opened',
        mileage: 20000,
        operatingHours: null,
        insuranceCompanyNit: null,
        isBilled: false,
        isVoided: false,
        promisedDeliveryAt: '2026-06-15T18:00:00Z',
        enteredAt: '2026-06-15T08:00:00Z',
      });
    });

    expect(result.ok).toBe(true);
    const orderId = result.ok ? result.value.workOrderId : '';

    await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlWorkOrderRepository(tx);
      const order = await repo.findById(orderId);

      expect(order).not.toBeNull();
      expect(order?.orderType).toBe('maintenance');
      expect(order?.mileage).toBe(20000);
      expect(order?.status).toBe('opened');

      // Verificar Transactional Outbox
      const outboxRows = await tx<{ event_type: string }[]>`
        SELECT event_type FROM outbox_events WHERE aggregate_id = ${orderId}
      `;
      expect(outboxRows.length).toBeGreaterThan(0);
      expect(outboxRows[0]?.event_type).toBe('WorkOrderOpened');
    });
  });

  it('correctly updates work order to completed and emits WorkOrderCompleted domain event', async () => {
    // Actualizar OT a completada
    await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlWorkOrderRepository(tx);
      const useCase = new IngestWorkOrderFromErpUseCase(repo);

      const res = await useCase.execute({
        tenantId,
        externalId: 'BOD1_OT_501',
        bodega: 1,
        orderNumber: 501,
        vehicleId,
        partyId,
        orderType: 'maintenance',
        status: 'completed',
        mileage: 20000,
        operatingHours: null,
        insuranceCompanyNit: null,
        isBilled: true,
        isVoided: false,
        promisedDeliveryAt: '2026-06-15T18:00:00Z',
        enteredAt: '2026-06-15T08:00:00Z',
      });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value.isNew).toBe(false);
    });

    await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlWorkOrderRepository(tx);
      const order = await repo.findByExternalId('BOD1_OT_501');

      expect(order?.status).toBe('completed');
      expect(order?.isBilled).toBe(true);
      expect(order?.closedAt).toBeDefined();

      const outboxRows = await tx<{ event_type: string }[]>`
        SELECT event_type FROM outbox_events
        WHERE aggregate_id = ${order!.id} AND event_type = 'WorkOrderCompleted'
      `;
      expect(outboxRows.length).toBe(1);
    });
  });

  it('correctly classifies collision work order with insurance company (D-46)', async () => {
    const result = await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlWorkOrderRepository(tx);
      const useCase = new IngestWorkOrderFromErpUseCase(repo);

      return await useCase.execute({
        tenantId,
        externalId: 'BOD1_OT_502',
        bodega: 1,
        orderNumber: 502,
        vehicleId,
        partyId,
        orderType: 'collision', // D-46: Siniestro / Latonería
        status: 'opened',
        mileage: 20500,
        operatingHours: null,
        insuranceCompanyNit: '860002184', // Seguros Bolívar
        isBilled: false,
        isVoided: false,
        promisedDeliveryAt: '2026-06-30T18:00:00Z',
        enteredAt: '2026-06-20T09:00:00Z',
      });
    });

    expect(result.ok).toBe(true);

    await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlWorkOrderRepository(tx);
      const order = await repo.findByExternalId('BOD1_OT_502');

      expect(order?.orderType).toBe('collision');
    });
  });
});
