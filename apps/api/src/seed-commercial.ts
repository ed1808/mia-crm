import { SQL } from 'bun';
import { withTenant } from '@mia-crm/db';
import { SystemClock } from '@mia-crm/kernel';
import {
  BunSqlCommercialRepository,
  CreateLeadUseCase,
  CreateQuoteUseCase,
  ReconcileSaleWithErpUseCase,
  Deal,
} from '@mia-crm/module-commercial';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://mia_app:mia_app_password@localhost:5432/mia_crm_dev';

export async function seedCommercialData() {
  const sql = new SQL(DATABASE_URL);
  const clock = new SystemClock();

  // Obtener tenant demo-colombia
  const tenantRows = await sql<{ id: string }[]>`
    SELECT id FROM tenants WHERE slug = 'demo-colombia' LIMIT 1
  `;
  if (!tenantRows[0]) {
    console.error('Tenant demo-colombia no encontrado.');
    await sql.close();
    return;
  }

  const tenantId = tenantRows[0].id;
  console.log(`Poblando datos comerciales para tenant demo-colombia (${tenantId})...`);

  await withTenant(sql, { tenantId }, async (tx) => {
    const repo = new BunSqlCommercialRepository(tx);

    // 1. Asegurar pipelines automotrices
    const pipelines = await repo.ensureDefaultPipelines();
    console.log(`Pipelines configurados: ${pipelines.length}`);

    const passengerPipeline = pipelines.find((p) => p.code === 'new_passenger')!;
    const heavyPipeline = pipelines.find((p) => p.code === 'commercial_heavy')!;
    const usedPipeline = pipelines.find((p) => p.code === 'used_tradein')!;
    const fleetPipeline = pipelines.find((p) => p.code === 'fleet_b2b')!;

    // Obtener vehículos existentes para asociar
    const vehicles = await tx<{ id: string; current_plate: string; make: string; model: string }[]>`
      SELECT id, current_plate, make, model FROM vehicles LIMIT 5
    `;

    // Obtener clientes existentes (Parties)
    const parties = await tx<{ id: string }[]>`
      SELECT id FROM parties LIMIT 5
    `;

    // 2. Crear Leads realistas del mercado automotriz colombiano
    const createLeadUc = new CreateLeadUseCase(repo, clock);

    // Lead 1: Meta Ads - SUV con SLA ajustado
    await createLeadUc.execute(tenantId, {
      firstName: 'Andrés Felipe',
      lastName: 'Morales Silva',
      phone: '+573128901234',
      email: 'andres.morales@colombiacargo.com',
      source: 'meta_lead_ads',
      interestedVehicleModel: 'Toyota Hilux 4x4 Diésel',
      notes: 'Solicitó información por anuncio de feria automotriz. Requiere entrega rápida y asesoría en retoma de Duster 2019.',
      slaMinutes: 15,
    });

    // Lead 2: Empresa B2B - Flota de camiones
    await createLeadUc.execute(tenantId, {
      firstName: 'Alimentos del Valle SAS',
      lastName: '(Contacto: Ing. Rodrigo Pardo)',
      phone: '+573157778899',
      email: 'compras@alimentosdelvalle.com.co',
      source: 'web_form',
      interestedVehicleModel: '3x Camión Hino Serie 300 Furgón',
      notes: 'Renovación de flota de reparto urbano de congelados. Solicita visita técnica y propuesta formal.',
      slaMinutes: 60,
    });

    // Lead 3: Showroom - Usado / Retoma
    await createLeadUc.execute(tenantId, {
      firstName: 'Carolina',
      lastName: 'Gómez Hoyos',
      phone: '+573105556677',
      email: 'carolina.gomez@medicosantioquia.org',
      source: 'showroom_walk_in',
      interestedVehicleModel: 'Mazda CX-30 Grand Touring Híbrida',
      notes: 'Visitó sala de ventas el fin de semana. Deja en parte de pago Mazda 2 modelo 2020 con 42.000 km.',
      slaMinutes: 30,
    });

    // Lead 4: Licitación Corporativa
    await createLeadUc.execute(tenantId, {
      firstName: 'Transportes TransLogística Andina SAS',
      lastName: '(Gerencia de Operaciones)',
      phone: '+573004443322',
      email: 'operaciones@translogistica.com.co',
      source: 'phone_inbound',
      interestedVehicleModel: 'Camiones Pesados FVR / Isuzu Chasis Largo',
      notes: 'Contrato de transporte de carga pesada Bogotá - Buenaventura. Requiere cotización de 5 unidades.',
      slaMinutes: 120,
    });

    console.log('Leads creados satisfactoriamente.');

    // 3. Crear Deals (Oportunidades en el Kanban)
    const p1Stages = passengerPipeline.stages;
    const p2Stages = heavyPipeline.stages;
    const p3Stages = usedPipeline.stages;
    const p4Stages = fleetPipeline.stages;

    // Deal 1: En Cotización (Nuevos Livianos)
    const party1 = parties[0]?.id;
    const vehicle1 = vehicles[0]?.id;
    const tradeVehicle = vehicles[1]?.id;

    if (party1) {
      const deal1 = Deal.create(
        {
          tenantId,
          pipelineId: passengerPipeline.id,
          stageId: p1Stages[2]!.id, // Cotización Enviada
          title: 'Toyota Hilux 4x4 — Andrés Morales',
          partyId: party1,
          vehicleId: vehicle1,
          estimatedValue: 195000000,
          expectedCloseDate: new Date('2026-10-31'),
        },
        clock
      ).value;
      await repo.saveDeal(deal1);

      // Generar Cotización formal versionada para este Deal
      const quoteUc = new CreateQuoteUseCase(repo, clock);
      await quoteUc.execute(tenantId, {
        dealId: deal1.id,
        quoteNumber: 'COT-2026-0812',
        items: [
          { id: '1', concept: 'Toyota Hilux 2.8 Diésel Doble Cabina 4x4', unitPrice: 175000000, quantity: 1, taxPct: 19 },
          { id: '2', concept: 'Barra Antivuelco & Tiro de Arrastre', unitPrice: 3500000, quantity: 1, taxPct: 19 },
          { id: '3', concept: 'Película Nanocerámica & Duraliner Platón', unitPrice: 2800000, quantity: 1, taxPct: 19 },
        ],
        discountAmount: 4000000,
        tradeInAllowance: 45000000, // Bono de retoma de usado
        paymentTerms: 'Crédito Vehicular Bancolombia 70% + Retoma 30%',
        validDays: 15,
        notes: 'Garantía de fábrica 5 años o 100.000 km. Incluye kit de carretera y gastos de matrícula.',
      });

      // Deal 2: En Test Drive (Nuevos Livianos)
      const deal2 = Deal.create(
        {
          tenantId,
          pipelineId: passengerPipeline.id,
          stageId: p1Stages[1]!.id, // Demostración / Test Drive
          title: 'Mazda CX-30 Grand Touring — Carolina Gómez',
          partyId: party1,
          tradeInVehicleId: tradeVehicle,
          estimatedValue: 128000000,
          expectedCloseDate: new Date('2026-11-05'),
        },
        clock
      ).value;
      await repo.saveDeal(deal2);

      // Deal 3: En Negociación / Separación (Nuevos Livianos)
      const deal3 = Deal.create(
        {
          tenantId,
          pipelineId: passengerPipeline.id,
          stageId: p1Stages[4]!.id, // Negociación & Separación
          title: 'Renault Duster Iconic 4x4 — Roberto Cadavid',
          partyId: party1,
          estimatedValue: 104000000,
          expectedCloseDate: new Date('2026-10-25'),
        },
        clock
      ).value;
      await repo.saveDeal(deal3);

      // Deal 4: Comerciales & Pesados (Levantamiento de Carrocería)
      const deal4 = Deal.create(
        {
          tenantId,
          pipelineId: heavyPipeline.id,
          stageId: p2Stages[1]!.id, // Levantamiento de Carrocería
          title: '3x Camiones Hino Serie 300 — TransAlimentos SAS',
          partyId: party1,
          estimatedValue: 720000000,
          expectedCloseDate: new Date('2026-11-20'),
        },
        clock
      ).value;
      await repo.saveDeal(deal4);

      // Deal 5: Retoma y Usados
      const deal5 = Deal.create(
        {
          tenantId,
          pipelineId: usedPipeline.id,
          stageId: p3Stages[1]!.id, // Avalúo Realizado & Oferta
          title: 'Retoma Toyota Fortuner 2021 — Luis Fernando Mejía',
          partyId: party1,
          tradeInVehicleId: tradeVehicle,
          estimatedValue: 145000000,
          expectedCloseDate: new Date('2026-10-28'),
        },
        clock
      ).value;
      await repo.saveDeal(deal5);

      // Deal 6: Flotas Corporativas (Revisión Comité Compras)
      const deal6 = Deal.create(
        {
          tenantId,
          pipelineId: fleetPipeline.id,
          stageId: p4Stages[2]!.id, // Revisión Comité Compras
          title: 'Paquete Flota 5 Unidades — TransLogística Andina SAS',
          partyId: party1,
          estimatedValue: 1250000000,
          expectedCloseDate: new Date('2026-12-15'),
        },
        clock
      ).value;
      await repo.saveDeal(deal6);

      // 4. Registrar 2 Ventas Conciliadas con el ERP (vh_documentos_ped)
      if (vehicle1) {
        const reconcileUc = new ReconcileSaleWithErpUseCase(repo, clock);
        await reconcileUc.execute(tenantId, {
          vehicleId: vehicle1,
          customerPartyId: party1,
          externalOrderNumber: 'PED-DMS-88192',
          externalInvoiceNumber: 'FAC-VEH-10492',
          saleAmount: 185000000,
          saleDate: '2026-10-10',
          deliveryDate: '2026-10-14',
        });
        console.log('Venta conciliada con pedido ERP registrada.');
      }
    }

    console.log('Deals y cotizaciones sembrados exitosamente.');
  });

  await sql.close();
}

seedCommercialData().catch((err) => {
  console.error('Error al sembrar datos comerciales:', err);
  process.exit(1);
});
