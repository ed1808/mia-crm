import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { SQL } from 'bun';
import { withTenant } from '@mia-crm/db';
import {
  Plate,
  Vin,
  Mileage,
  SharePercentage,
  UpsertVehicleFromErpUseCase,
  BunSqlVehicleRepository,
} from './index';

const ADMIN_DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://mia_admin:mia_admin_password@localhost:5432/mia_crm_dev';
const APP_DATABASE_URL = 'postgresql://mia_app:mia_app_password@localhost:5432/mia_crm_dev';

describe('Vehicle Module: Vehicle as First-Class Business Entity (Domain Core)', () => {
  let adminSql: SQL;
  let appSql: SQL;
  let tenantId: string;
  let party1Id: string;
  let party2Id: string;

  beforeAll(async () => {
    adminSql = new SQL(ADMIN_DATABASE_URL);
    appSql = new SQL(APP_DATABASE_URL);

    // Crear tenant de prueba
    const [t] = await adminSql<{ id: string }[]>`
      INSERT INTO tenants (name, slug)
      VALUES ('Concesionario Vehicle Test', 'vehicle-test')
      RETURNING id
    `;
    tenantId = t!.id;

    // Crear dos parties (propietario 1 y propietario 2)
    const [p1] = await adminSql<{ id: string }[]>`
      INSERT INTO parties (tenant_id, party_type)
      VALUES (${tenantId}::uuid, 'person')
      RETURNING id
    `;
    const [p2] = await adminSql<{ id: string }[]>`
      INSERT INTO parties (tenant_id, party_type)
      VALUES (${tenantId}::uuid, 'company')
      RETURNING id
    `;
    party1Id = p1!.id;
    party2Id = p2!.id;
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

  it('validates Value Objects and protects against Primitive Obsession', () => {
    const validPlate = Plate.create(' ufh-458 ');
    expect(validPlate.ok).toBe(true);
    if (validPlate.ok) {
      expect(validPlate.value.value).toBe('UFH458');
    }

    const invalidPlate = Plate.create('AB');
    expect(invalidPlate.ok).toBe(false);

    const validVin = Vin.create(' 93HBF26H2MZ123456 ');
    expect(validVin.ok).toBe(true);
    if (validVin.ok) {
      expect(validVin.value.value).toBe('93HBF26H2MZ123456');
    }

    const validMileage = Mileage.create(45000);
    expect(validMileage.ok).toBe(true);
    const negativeMileage = Mileage.create(-10);
    expect(negativeMileage.ok).toBe(false);

    const validShare = SharePercentage.create(50);
    expect(validShare.ok).toBe(true);
    const invalidShare = SharePercentage.create(150);
    expect(invalidShare.ok).toBe(false);
  });

  it('creates Vehicle with initial owner and emits VehicleUpserted domain event to Outbox', async () => {
    const result = await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlVehicleRepository(tx);
      const useCase = new UpsertVehicleFromErpUseCase(repo);

      return await useCase.execute({
        tenantId,
        externalCode: 'ERP-SERIE-9901',
        vin: '93HBF26H2MZ123456',
        plate: 'UFH458',
        make: 'Hino',
        model: '500 Series Camión',
        modelYear: 2024,
        color: 'Blanco',
        engineNumber: 'J08E-TI-991',
        mileage: 12500,
        operatingHours: 450,
        warrantyEndDate: '2027-03-15',
        rtmDueDate: '2026-03-15',
        ownerPartyId: party1Id,
      });
    });

    expect(result.ok).toBe(true);
    const vehicleId = result.ok ? result.value.vehicleId : '';
    expect(vehicleId).toBeDefined();

    // Consultar persistencia con RLS
    await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlVehicleRepository(tx);
      const vehicle = await repo.findById(vehicleId);

      expect(vehicle).not.toBeNull();
      expect(vehicle?.vin?.value).toBe('93HBF26H2MZ123456');
      expect(vehicle?.currentPlate?.value).toBe('UFH458');
      expect(vehicle?.make).toBe('Hino');
      expect(vehicle?.currentMileage?.value).toBe(12500);
      expect(vehicle?.currentOperatingHours?.value).toBe(450);

      // Verificar propietario principal vigente
      expect(vehicle?.primaryOwner).toBeDefined();
      expect(vehicle?.primaryOwner?.partyId).toBe(party1Id);
      expect(vehicle?.primaryOwner?.isPrimary).toBe(true);
      expect(vehicle?.primaryOwner?.validTo).toBeUndefined();

      // Verificar Outbox
      const outboxRows = await tx<{ event_type: string; payload: any }[]>`
        SELECT event_type, payload FROM outbox_events WHERE aggregate_id = ${vehicleId}
      `;
      expect(outboxRows.length).toBeGreaterThan(0);
      expect(outboxRows[0]?.event_type).toBe('VehicleUpserted');
    });
  });

  it('manages temporal ownership transfer (D-43): closes previous owner and registers new primary owner', async () => {
    // Buscar vehículo existente por VIN y transferirlo a Party 2 (Empresa)
    let vehicleId = '';
    await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlVehicleRepository(tx);
      const v = await repo.findByVin('93HBF26H2MZ123456');
      if (v) vehicleId = v.id;
    });

    expect(vehicleId).not.toBe('');

    // Ejecutar transferencia mediante nuevo ingreso de ERP
    await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlVehicleRepository(tx);
      const useCase = new UpsertVehicleFromErpUseCase(repo);

      const res = await useCase.execute({
        tenantId,
        externalCode: 'ERP-SERIE-9901',
        vin: '93HBF26H2MZ123456',
        plate: 'UFH458',
        make: 'Hino',
        model: '500 Series Camión',
        modelYear: 2024,
        color: 'Blanco',
        engineNumber: 'J08E-TI-991',
        mileage: 18000,
        operatingHours: 620,
        warrantyEndDate: '2027-03-15',
        rtmDueDate: '2026-03-15',
        ownerPartyId: party2Id, // Nuevo propietario
      });
      expect(res.ok).toBe(true);
    });

    // Validar historial de relaciones
    await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlVehicleRepository(tx);
      const vehicle = await repo.findById(vehicleId);

      expect(vehicle).not.toBeNull();
      // Debe haber 2 relaciones de propietario: el anterior cerrado y el actual activo
      expect(vehicle?.relationships.length).toBe(2);

      const previous = vehicle?.relationships.find((r) => r.partyId === party1Id);
      expect(previous).toBeDefined();
      expect(previous?.validTo).toBeDefined(); // Cerrado temporalmente

      const current = vehicle?.relationships.find((r) => r.partyId === party2Id);
      expect(current).toBeDefined();
      expect(current?.isPrimary).toBe(true);
      expect(current?.validTo).toBeUndefined(); // Activo

      // Verificar que el Outbox capturó VehicleOwnershipChanged para ambos propietarios
      const outboxRows = await tx<{ event_type: string; payload: any }[]>`
        SELECT event_type, payload FROM outbox_events
        WHERE aggregate_id = ${vehicleId} AND event_type = 'VehicleOwnershipChanged'
        ORDER BY occurred_at ASC
      `;
      expect(outboxRows.length).toBe(2);
      const payload0 =
        typeof outboxRows[0]?.payload === 'string'
          ? JSON.parse(outboxRows[0]!.payload)
          : outboxRows[0]?.payload;
      const payload1 =
        typeof outboxRows[1]?.payload === 'string'
          ? JSON.parse(outboxRows[1]!.payload)
          : outboxRows[1]?.payload;
      expect(payload0.newPrimaryOwnerPartyId).toBe(party1Id);
      expect(payload1.newPrimaryOwnerPartyId).toBe(party2Id);
    });
  });

  it('tracks plate changes (D-07) preserving historical plate entries', async () => {
    let vehicleId = '';
    await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlVehicleRepository(tx);
      const v = await repo.findByVin('93HBF26H2MZ123456');
      if (v) vehicleId = v.id;
    });

    // Actualizar placa a WXY999
    await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlVehicleRepository(tx);
      const useCase = new UpsertVehicleFromErpUseCase(repo);

      await useCase.execute({
        tenantId,
        externalCode: 'ERP-SERIE-9901',
        vin: '93HBF26H2MZ123456',
        plate: 'WXY999',
        make: 'Hino',
        model: '500 Series Camión',
        modelYear: 2024,
        color: 'Blanco',
        engineNumber: 'J08E-TI-991',
        mileage: 22000,
        operatingHours: 750,
        warrantyEndDate: '2027-03-15',
        rtmDueDate: '2026-03-15',
        ownerPartyId: party2Id,
      });
    });

    // Verificar en BD
    await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlVehicleRepository(tx);
      const vehicle = await repo.findById(vehicleId);

      expect(vehicle?.currentPlate?.value).toBe('WXY999');
      expect(vehicle?.plateHistory.length).toBe(2);
      expect(vehicle?.plateHistory[0]?.plate.value).toBe('UFH458');
      expect(vehicle?.plateHistory[0]?.validTo).toBeDefined();
      expect(vehicle?.plateHistory[1]?.plate.value).toBe('WXY999');
      expect(vehicle?.plateHistory[1]?.validTo).toBeUndefined();
    });
  });

  it('detects mileage regression as an anomaly', async () => {
    let vehicleId = '';
    await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlVehicleRepository(tx);
      const v = await repo.findByVin('93HBF26H2MZ123456');
      if (v) vehicleId = v.id;
    });

    await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlVehicleRepository(tx);
      const vehicle = await repo.findById(vehicleId);
      expect(vehicle).not.toBeNull();

      // Odómetro regresivo: intentar registrar 5,000 km cuando el actual es 22,000 km
      const mileage = Mileage.create(5000);
      expect(mileage.ok).toBe(true);

      const usageResult = vehicle!.recordUsage({
        mileage: mileage.ok ? mileage.value : undefined,
        source: 'manual_odometer',
      });

      expect(usageResult.isAnomaly).toBe(true);
      // El kilometraje vigente NO debe corromperse
      expect(vehicle!.currentMileage?.value).toBe(22000);
    });
  });
});
