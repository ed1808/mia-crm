import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { SQL } from 'bun';
import { withTenant } from '@mia-crm/db';
import { InboxProcessor } from './processors/inbox-processor';
import { OutboxRelay } from './relay/outbox-relay';

const ADMIN_DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://mia_admin:mia_admin_password@localhost:5432/mia_crm_dev';
const APP_DATABASE_URL = 'postgresql://mia_app:mia_app_password@localhost:5432/mia_crm_dev';

describe('Workers: Asynchronous ERP Inbox Processing & Outbox Relay', () => {
  let adminSql: SQL;
  let appSql: SQL;
  let tenantId: string;

  beforeAll(async () => {
    adminSql = new SQL(ADMIN_DATABASE_URL);
    appSql = new SQL(APP_DATABASE_URL);

    // Crear tenant de prueba
    const [t] = await adminSql<{ id: string }[]>`
      INSERT INTO tenants (name, slug)
      VALUES ('Concesionario Workers Test', 'workers-test')
      RETURNING id
    `;
    tenantId = t!.id;
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

  it('processes raw terceros webhook event from inbox, creates Party and updates event status', async () => {
    const rawTercero = {
      event_id: 'EVT-RAW-TERC-01',
      source_table: 'terceros',
      operation: 'INSERT',
      captured_at: new Date().toISOString(),
      payload: {
        after: {
          nit: '901555444',
          nombres: 'Logística y Carga del Valle SAS',
          razon_comercial: 'LogiValle',
          tipo_identificacion: 'NIT',
          mail: 'operaciones@logivalle.co',
          celular: '3157778899',
          ciudad: 'Cali',
          direccion: 'Zona Industrial Acopi',
        },
      },
    };

    // 1. Insertar evento crudo en inbox_events
    await withTenant(appSql, { tenantId }, async (tx) => {
      await tx`
        INSERT INTO inbox_events (
          tenant_id,
          event_id,
          source_table,
          operation,
          payload,
          captured_at
        ) VALUES (
          ${tenantId}::uuid,
          ${rawTercero.event_id},
          ${rawTercero.source_table},
          ${rawTercero.operation},
          ${JSON.stringify(rawTercero.payload)}::jsonb,
          ${rawTercero.captured_at}::timestamptz
        )
      `;
    });

    // 2. Ejecutar InboxProcessor
    const processor = new InboxProcessor(appSql);
    const result = await processor.processPendingBatch(10);

    expect(result.processed).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBe(0);

    // 3. Verificar que el inbox_event quedó en estado 'processed'
    await withTenant(appSql, { tenantId }, async (tx) => {
      const inboxRows = await tx<{ status: string; processed_at: Date | null }[]>`
        SELECT status, processed_at FROM inbox_events WHERE event_id = 'EVT-RAW-TERC-01'
      `;
      expect(inboxRows[0]?.status).toBe('processed');
      expect(inboxRows[0]?.processed_at).not.toBeNull();

      // 4. Verificar que se creó la entidad Party en el módulo de party
      const partyRows = await tx<{ legal_name: string; id_number: string }[]>`
        SELECT c.legal_name, pi.id_number
        FROM companies c
        JOIN party_identifiers pi ON pi.party_id = c.party_id
        WHERE pi.id_number = '901555444'
      `;
      expect(partyRows.length).toBe(1);
      expect(partyRows[0]?.id_number).toBe('901555444');
      expect(partyRows[0]?.legal_name).toBe('Logística y Carga del Valle SAS');
    });
  });

  it('processes raw referencias_imp webhook event, links owner by NIT, and creates Vehicle', async () => {
    const rawVehiculo = {
      event_id: 'EVT-RAW-VEH-01',
      source_table: 'referencias_imp',
      operation: 'INSERT',
      captured_at: new Date().toISOString(),
      payload: {
        after: {
          codigo: 'SERIE-TRACTO-88',
          chasis: '3H1M2C8B4PK998877',
          placa: 'STR889',
          modelo_taller: 'Kenworth T800',
          modelo_ano: 2023,
          color: 'Rojo Carmesí',
          motor: 'Cummins ISX15',
          kilometraje: 95000,
          horas_uso: 3100,
          fecha_fin_garantia: '2026-11-20',
          fecha_tecnico_mecanica: '2025-11-20',
          nit_comprador: '901555444', // NIT de LogiValle creado en la prueba anterior
        },
      },
    };

    // 1. Insertar evento crudo de vehículo en inbox_events
    await withTenant(appSql, { tenantId }, async (tx) => {
      await tx`
        INSERT INTO inbox_events (
          tenant_id,
          event_id,
          source_table,
          operation,
          payload,
          captured_at
        ) VALUES (
          ${tenantId}::uuid,
          ${rawVehiculo.event_id},
          ${rawVehiculo.source_table},
          ${rawVehiculo.operation},
          ${JSON.stringify(rawVehiculo.payload)}::jsonb,
          ${rawVehiculo.captured_at}::timestamptz
        )
      `;
    });

    // 2. Procesar con InboxProcessor
    const processor = new InboxProcessor(appSql);
    const result = await processor.processPendingBatch(10);

    expect(result.processed).toBeGreaterThanOrEqual(1);

    // 3. Verificar que el vehículo fue persistido y su propietario asociado correctamente
    await withTenant(appSql, { tenantId }, async (tx) => {
      const vRows = await tx<
        {
          id: string;
          current_plate: string;
          vin: string;
          current_mileage: number;
        }[]
      >`
        SELECT id, current_plate, vin, current_mileage
        FROM vehicles
        WHERE vin = '3H1M2C8B4PK998877'
      `;
      expect(vRows.length).toBe(1);
      expect(vRows[0]?.current_plate).toBe('STR889');
      expect(vRows[0]?.current_mileage).toBe(95000);

      // Verificar relación de propiedad vinculada con LogiValle
      const relRows = await tx<{ role: string; is_primary: boolean }[]>`
        SELECT vr.role, vr.is_primary
        FROM vehicle_relationships vr
        WHERE vr.vehicle_id = ${vRows[0]!.id}::uuid
      `;
      expect(relRows.length).toBe(1);
      expect(relRows[0]?.role).toBe('owner');
      expect(relRows[0]?.is_primary).toBe(true);
    });
  });

  it('processes raw tall_encabeza_orden event, creates WorkOrder, updates vehicle mileage and computes next visit projection', async () => {
    const rawOrden = {
      event_id: 'EVT-RAW-OT-01',
      source_table: 'tall_encabeza_orden',
      operation: 'INSERT',
      captured_at: new Date().toISOString(),
      payload: {
        after: {
          bodega: 1,
          numero: 9001,
          serie: 'SERIE-TRACTO-88',
          nit: '901555444',
          tipo: 'mantenimiento 100k',
          kilometraje: 110000,
          horas_uso: 3500,
          estado: 'C',
          entrada: '2026-07-01T08:00:00Z',
          facturada: true,
          anulada: false,
        },
      },
    };

    // 1. Insertar evento de orden de taller en inbox_events
    await withTenant(appSql, { tenantId }, async (tx) => {
      await tx`
        INSERT INTO inbox_events (
          tenant_id,
          event_id,
          source_table,
          operation,
          payload,
          captured_at
        ) VALUES (
          ${tenantId}::uuid,
          ${rawOrden.event_id},
          ${rawOrden.source_table},
          ${rawOrden.operation},
          ${JSON.stringify(rawOrden.payload)}::jsonb,
          ${rawOrden.captured_at}::timestamptz
        )
      `;
    });

    // 2. Procesar con InboxProcessor
    const processor = new InboxProcessor(appSql);
    const result = await processor.processPendingBatch(10);
    expect(result.processed).toBeGreaterThanOrEqual(1);

    // 3. Verificar que la orden de trabajo existe en work_orders
    await withTenant(appSql, { tenantId }, async (tx) => {
      const woRows = await tx<{ order_type: string; mileage: number; status: string }[]>`
        SELECT order_type, mileage, status
        FROM work_orders
        WHERE external_id = '1_9001'
      `;
      expect(woRows.length).toBe(1);
      expect(woRows[0]?.order_type).toBe('maintenance');
      expect(woRows[0]?.mileage).toBe(110000);

      // 4. Verificar que el kilometraje del vehículo se actualizó
      const vRows = await tx<{ current_mileage: number }[]>`
        SELECT current_mileage FROM vehicles WHERE external_code = 'SERIE-TRACTO-88'
      `;
      expect(vRows[0]?.current_mileage).toBe(110000);

      // 5. Verificar que el Motor de Proyección calculó la próxima visita (D-35)
      const projRows = await tx<
        {
          projection_method: string;
          confidence_level: string;
          projected_date: string;
        }[]
      >`
        SELECT projection_method, confidence_level, projected_date::text
        FROM next_visit_projections
      `;
      expect(projRows.length).toBeGreaterThan(0);
      expect(projRows[0]?.projection_method).toBeDefined();
      expect(projRows[0]?.confidence_level).toBeDefined();
      expect(projRows[0]?.projected_date).toBeDefined();

      // 6. Verificar que el Motor de Oportunidades generó oportunidades predictivas automáticamente (D-37)
      const oppRows = await tx<{ rule_id: string; status: string; score: number }[]>`
        SELECT rule_id, status, score FROM opportunities
      `;
      expect(oppRows.length).toBeGreaterThan(0);
      expect(oppRows[0]?.rule_id).toBeDefined();
      expect(oppRows[0]?.status).toBe('detected');
    });
  });

  it('relays pending domain events from Outbox and marks them as published', async () => {
    // 1. Verificar que existen eventos pendientes en outbox_events generados por las pruebas anteriores
    let pendingCount = 0;
    await withTenant(appSql, { tenantId }, async (tx) => {
      const rows = await tx<{ count: string }[]>`
        SELECT count(*)::text as count FROM outbox_events WHERE status = 'pending'
      `;

      pendingCount = Number(rows[0]?.count ?? '0');
    });

    expect(pendingCount).toBeGreaterThan(0);

    // 2. Ejecutar OutboxRelay
    const relay = new OutboxRelay(appSql);
    const result = await relay.relayPendingBatch(50);

    expect(result.published).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBe(0);

    // 3. Verificar que todos los eventos quedaron con status 'published'
    await withTenant(appSql, { tenantId }, async (tx) => {
      const remainingPending = await tx<{ count: string }[]>`
        SELECT count(*)::text as count FROM outbox_events WHERE status = 'pending'
      `;
      expect(Number(remainingPending[0]?.count)).toBe(0);
    });
  });
});
