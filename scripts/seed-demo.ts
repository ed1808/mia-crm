import { SQL } from 'bun';
import { withTenant } from '@mia-crm/db';
import {
  BunSqlOpportunityRepository,
  DetectOpportunitiesUseCase,
} from '@mia-crm/module-opportunity';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://mia_admin:mia_admin_password@localhost:5432/mia_crm_dev';

async function seed() {
  const sql = new SQL(DATABASE_URL);
  console.log('--- Sembrando datos demo de concesionario colombiano para MIA CRM ---');

  // 1. Crear o reutilizar Tenant
  let [tenant] = await sql<{ id: string }[]>`
    SELECT id FROM tenants WHERE slug = 'demo-colombia' LIMIT 1
  `;

  if (!tenant) {
    const [created] = await sql<{ id: string }[]>`
      INSERT INTO tenants (name, slug)
      VALUES ('Concesionario Los Coches & Carga del Valle SAS', 'demo-colombia')
      RETURNING id
    `;
    tenant = created;
  }
  const tenantId = tenant.id;
  console.log(`Tenant ID: ${tenantId}`);

  // 2. Sembrar dentro del contexto del tenant
  await withTenant(sql, { tenantId }, async (tx) => {
    // Sedes
    let branches = await tx<{ id: string }[]>`
      SELECT id FROM branches WHERE tenant_id = ${tenantId}::uuid
    `;
    if (branches.length === 0) {
      branches = await tx<{ id: string }[]>`
        INSERT INTO branches (tenant_id, name, city, address)
        VALUES
          (${tenantId}::uuid, 'Sede Principal Calle 26', 'Bogotá', 'Avenida Calle 26 # 68-35'),
          (${tenantId}::uuid, 'Sede Taller Pesados Yumbo', 'Cali / Yumbo', 'Km 5 Vía Yumbo')
        RETURNING id
      `;
    }

    // Titulares (Parties)
    // Carlos Gómez
    let [pCarlos] = await tx<{ id: string }[]>`
      SELECT p.id FROM parties p
      JOIN party_identifiers pi ON pi.party_id = p.id
      WHERE pi.id_number = '1017223344' LIMIT 1
    `;
    if (!pCarlos) {
      const [p] = await tx<{ id: string }[]>`
        INSERT INTO parties (tenant_id, party_type) VALUES (${tenantId}::uuid, 'person') RETURNING id
      `;
      pCarlos = p;
      await tx`INSERT INTO persons (party_id, tenant_id, first_name, last_name) VALUES (${pCarlos.id}::uuid, ${tenantId}::uuid, 'Carlos', 'Gómez')`;
      await tx`INSERT INTO party_identifiers (tenant_id, party_id, id_type, id_number) VALUES (${tenantId}::uuid, ${pCarlos.id}::uuid, 'CC', '1017223344')`;
      await tx`INSERT INTO party_contact_points (tenant_id, party_id, channel, value, is_primary) VALUES (${tenantId}::uuid, ${pCarlos.id}::uuid, 'phone', '3158889900', true), (${tenantId}::uuid, ${pCarlos.id}::uuid, 'email', 'carlos.gomez@gmail.com', true)`;
    }

    // Diana Restrepo
    let [pDiana] = await tx<{ id: string }[]>`
      SELECT p.id FROM parties p
      JOIN party_identifiers pi ON pi.party_id = p.id
      WHERE pi.id_number = '1020304050' LIMIT 1
    `;
    if (!pDiana) {
      const [p] = await tx<{ id: string }[]>`
        INSERT INTO parties (tenant_id, party_type) VALUES (${tenantId}::uuid, 'person') RETURNING id
      `;
      pDiana = p;
      await tx`INSERT INTO persons (party_id, tenant_id, first_name, last_name) VALUES (${pDiana.id}::uuid, ${tenantId}::uuid, 'Diana', 'Restrepo')`;
      await tx`INSERT INTO party_identifiers (tenant_id, party_id, id_type, id_number) VALUES (${tenantId}::uuid, ${pDiana.id}::uuid, 'CC', '1020304050')`;
      await tx`INSERT INTO party_contact_points (tenant_id, party_id, channel, value, is_primary) VALUES (${tenantId}::uuid, ${pDiana.id}::uuid, 'phone', '3124567890', true), (${tenantId}::uuid, ${pDiana.id}::uuid, 'email', 'diana.restrepo@example.com', true)`;
    }

    // Transportes del Valle SAS
    let [pEmpresa] = await tx<{ id: string }[]>`
      SELECT p.id FROM parties p
      JOIN party_identifiers pi ON pi.party_id = p.id
      WHERE pi.id_number = '901444555' LIMIT 1
    `;
    if (!pEmpresa) {
      const [p] = await tx<{ id: string }[]>`
        INSERT INTO parties (tenant_id, party_type) VALUES (${tenantId}::uuid, 'company') RETURNING id
      `;
      pEmpresa = p;
      await tx`INSERT INTO companies (party_id, tenant_id, legal_name, trade_name) VALUES (${pEmpresa.id}::uuid, ${tenantId}::uuid, 'Transportes y Logística del Valle SAS', 'LogiValle')`;
      await tx`INSERT INTO party_identifiers (tenant_id, party_id, id_type, id_number) VALUES (${tenantId}::uuid, ${pEmpresa.id}::uuid, 'NIT', '901444555')`;
      await tx`INSERT INTO party_contact_points (tenant_id, party_id, channel, value, is_primary) VALUES (${tenantId}::uuid, ${pEmpresa.id}::uuid, 'phone', '3157778899', true), (${tenantId}::uuid, ${pEmpresa.id}::uuid, 'email', 'flota@logivalle.co', true)`;
    }

    // Flota de LogiValle
    let [fleet] = await tx<{ id: string }[]>`
      SELECT id FROM fleets WHERE tenant_id = ${tenantId}::uuid AND name = 'Flota Nacional Pesada' LIMIT 1
    `;
    if (!fleet) {
      const [f] = await tx<{ id: string }[]>`
        INSERT INTO fleets (tenant_id, company_party_id, name)
        VALUES (${tenantId}::uuid, ${pEmpresa.id}::uuid, 'Flota Nacional Pesada')
        RETURNING id
      `;
      fleet = f;
    }

    console.log('Titulares y empresa sembrados.');

    // 3. Vehículos
    const vehicleConfigs = [
      {
        plate: 'STR889',
        vin: '3H1M2C8B4PK998877',
        make: 'Kenworth',
        model: 'T800 Tractocamión',
        modelYear: 2023,
        vehicleType: 'truck',
        currentMileage: 110000,
        currentOperatingHours: 3500,
        ownerId: pEmpresa.id,
        isCompany: true,
        warrantyDays: 25,
        rtmDays: 120,
        fleetId: fleet.id,
        daysToService: 10,
        visits: [
          { orderNumber: 7001, enteredAt: '2025-08-01', mileage: 30000, type: 'maintenance' },
          { orderNumber: 7450, enteredAt: '2025-12-15', mileage: 65000, type: 'maintenance' },
          { orderNumber: 8120, enteredAt: '2026-05-10', mileage: 95000, type: 'maintenance' },
        ],
      },
      {
        plate: 'MED345',
        vin: '1HGCR2F83HA001122',
        make: 'Mazda',
        model: 'CX-30 Grand Touring',
        modelYear: 2022,
        vehicleType: 'car',
        currentMileage: 35000,
        currentOperatingHours: null,
        ownerId: pDiana.id,
        isCompany: false,
        warrantyDays: 45,
        rtmDays: 15, // RTM Próxima!
        daysToService: 12,
        visits: [
          { orderNumber: 6100, enteredAt: '2024-10-10', mileage: 10000, type: 'maintenance' },
          { orderNumber: 6800, enteredAt: '2025-05-12', mileage: 20000, type: 'maintenance' },
          { orderNumber: 7500, enteredAt: '2025-11-20', mileage: 30000, type: 'maintenance' },
        ],
      },
      {
        plate: 'ABC123',
        vin: '9BWCA4244FP888999',
        make: 'Chevrolet',
        model: 'Onix Turbo LTZ',
        modelYear: 2021,
        vehicleType: 'car',
        currentMileage: 58000,
        currentOperatingHours: null,
        ownerId: pCarlos.id,
        isCompany: false,
        warrantyDays: -20, // Garantía ya venció
        rtmDays: 20, // RTM Próxima!
        daysToService: -15, // Mantenimiento atrasado!
        visits: [
          { orderNumber: 5200, enteredAt: '2023-08-10', mileage: 20000, type: 'maintenance' },
          { orderNumber: 6300, enteredAt: '2024-06-15', mileage: 40000, type: 'maintenance' },
        ],
      },
      {
        plate: 'VLM444',
        vin: 'LB1C4A8D3KL554433',
        make: 'Foton',
        model: 'Aumark 4.5T',
        modelYear: 2022,
        vehicleType: 'truck',
        currentMileage: 72000,
        currentOperatingHours: 2400,
        ownerId: pEmpresa.id,
        isCompany: true,
        warrantyDays: 60,
        rtmDays: 200,
        fleetId: fleet.id,
        daysToService: 18,
        visits: [
          { orderNumber: 7200, enteredAt: '2025-06-10', mileage: 40000, type: 'maintenance' },
        ],
      },
      {
        plate: 'TLX111',
        vin: '3H1M2C8B4PK112233',
        make: 'Kenworth',
        model: 'T800 Volqueta',
        modelYear: 2021,
        vehicleType: 'truck',
        currentMileage: 145000,
        currentOperatingHours: 4800,
        ownerId: pEmpresa.id,
        isCompany: true,
        warrantyDays: -100,
        rtmDays: 180,
        fleetId: fleet.id,
        daysToService: 5,
        visits: [
          { orderNumber: 6500, enteredAt: '2024-11-05', mileage: 110000, type: 'maintenance' },
          { orderNumber: 7800, enteredAt: '2025-09-12', mileage: 135000, type: 'maintenance' },
        ],
      },
    ];

    const oppRepo = new BunSqlOpportunityRepository(tx);
    const detectUseCase = new DetectOpportunitiesUseCase(oppRepo);

    for (const vc of vehicleConfigs) {
      let [veh] = await tx<{ id: string }[]>`
        SELECT id FROM vehicles WHERE current_plate = ${vc.plate} AND tenant_id = ${tenantId}::uuid LIMIT 1
      `;

      const warrantyEnd = new Date(Date.now() + vc.warrantyDays * 24 * 60 * 60 * 1000);
      const rtmDue = new Date(Date.now() + vc.rtmDays * 24 * 60 * 60 * 1000);

      if (!veh) {
        const [v] = await tx<{ id: string }[]>`
          INSERT INTO vehicles (
            tenant_id, vin, current_plate, make, model, model_year,
            vehicle_type, current_mileage, current_operating_hours,
            warranty_end_date, rtm_due_date
          ) VALUES (
            ${tenantId}::uuid, ${vc.vin}, ${vc.plate}, ${vc.make}, ${vc.model},
            ${vc.modelYear}, ${vc.vehicleType}, ${vc.currentMileage}, ${vc.currentOperatingHours},
            ${warrantyEnd}::timestamptz, ${rtmDue}::timestamptz
          )
          RETURNING id
        `;
        veh = v;

        // Historial de placa
        await tx`
          INSERT INTO plate_history (tenant_id, vehicle_id, plate, valid_from)
          VALUES (${tenantId}::uuid, ${veh.id}::uuid, ${vc.plate}, NOW() - INTERVAL '1 year')
        `;

        // Relación de propiedad
        await tx`
          INSERT INTO vehicle_relationships (
            tenant_id, vehicle_id, party_id, role, is_primary, valid_from
          ) VALUES (
            ${tenantId}::uuid, ${veh.id}::uuid, ${vc.ownerId}::uuid, 'owner', true, NOW() - INTERVAL '1 year'
          )
        `;

        // Membresía de flota
        if (vc.fleetId) {
          await tx`
            INSERT INTO fleet_memberships (tenant_id, fleet_id, vehicle_id)
            VALUES (${tenantId}::uuid, ${vc.fleetId}::uuid, ${veh.id}::uuid)
            ON CONFLICT DO NOTHING
          `;
        }

        // Órdenes de taller históricas
        for (const visit of vc.visits) {
          await tx`
            INSERT INTO work_orders (
              tenant_id, vehicle_id, party_id, branch_code, external_id,
              order_number, order_type, status, mileage, entered_at, is_billed
            ) VALUES (
              ${tenantId}::uuid, ${veh.id}::uuid, ${vc.ownerId}::uuid, 1,
              ${`WO-${visit.orderNumber}`}, ${visit.orderNumber}, ${visit.type},
              'completed', ${visit.mileage}, ${visit.enteredAt}::timestamptz, true
            )
            ON CONFLICT DO NOTHING
          `;
        }
      }

      // Proyección de próxima visita (D-35)
      const projectedDate = new Date(Date.now() + vc.daysToService * 24 * 60 * 60 * 1000);
      await tx`
        INSERT INTO next_visit_projections (
          tenant_id, vehicle_id, projected_date, projected_mileage,
          projection_method, confidence_level, calculation_basis
        ) VALUES (
          ${tenantId}::uuid, ${veh.id}::uuid, ${projectedDate.toISOString().split('T')[0]}::date,
          ${vc.currentMileage + 5000},
          ${vc.visits.length >= 2 ? 'own_history' : 'cohort'},
          ${vc.visits.length >= 2 ? 'high' : 'medium'},
          ${JSON.stringify({ avgIntervalDays: 180, lastOdo: vc.currentMileage })}::jsonb
        )
        ON CONFLICT (tenant_id, vehicle_id) DO UPDATE SET
          projected_date = EXCLUDED.projected_date,
          projected_mileage = EXCLUDED.projected_mileage,
          projection_method = EXCLUDED.projection_method,
          confidence_level = EXCLUDED.confidence_level
      `;

      // Detección automática de oportunidades predictivas
      await detectUseCase.execute({
        tenantId,
        vehicle: {
          id: veh.id,
          tenantId,
          vin: vc.vin,
          plate: vc.plate,
          make: vc.make,
          model: vc.model,
          modelYear: vc.modelYear,
          vehicleType: vc.vehicleType,
          currentMileage: vc.currentMileage,
          currentOperatingHours: vc.currentOperatingHours ?? undefined,
          warrantyEndDate: warrantyEnd,
          rtmDueDate: rtmDue,
          primaryOwnerPartyId: vc.ownerId,
          isCompanyOwner: vc.isCompany,
          fleetId: vc.fleetId,
        },
        projection: {
          projectedDate,
          projectedMileage: vc.currentMileage + 5000,
          projectionMethod: vc.visits.length >= 2 ? 'own_history' : 'cohort',
          confidenceLevel: vc.visits.length >= 2 ? 'high' : 'medium',
        },
        fleetUnitCount: vc.fleetId ? 3 : 1,
      });

      console.log(`Vehículo ${vc.plate} procesado con éxito.`);
    }
  });

  await sql.close();
  console.log('✅ Sembrado demo completado exitosamente.');
}

seed().catch((err) => {
  console.error('Error al sembrar:', err);
  process.exit(1);
});
