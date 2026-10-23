import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { SQL } from 'bun';
import { FrozenClock } from '@mia-crm/kernel';
import { withTenant } from '@mia-crm/db';
import {
  Lead,
  Pipeline,
  DEFAULT_AUTOMOTIVE_PIPELINES,
  Deal,
  Quote,
  Sale,
  CreateLeadUseCase,
  ContactLeadUseCase,
  ConvertLeadToDealUseCase,
  MoveDealStageUseCase,
  CreateQuoteUseCase,
  ReconcileSaleWithErpUseCase,
  BunSqlCommercialRepository,
} from './index';

const ADMIN_DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://mia_admin:mia_admin_password@localhost:5432/mia_crm_dev';
const APP_DATABASE_URL =
  'postgresql://mia_app:mia_app_password@localhost:5432/mia_crm_dev';

describe('Commercial Module: Leads, Automotive Pipelines, Deals, Quotes & ERP Sales Reconciliation', () => {
  const baseTime = new Date('2026-10-15T09:00:00Z');
  let clock: FrozenClock;
  let adminSql: SQL;
  let appSql: SQL;
  let tenantId: string;
  let partyId: string;
  let vehicleId: string;

  beforeAll(async () => {
    clock = new FrozenClock(baseTime);
    adminSql = new SQL(ADMIN_DATABASE_URL);
    appSql = new SQL(APP_DATABASE_URL);

    // Configurar tenant de prueba
    const [t] = await adminSql<{ id: string }[]>`
      INSERT INTO tenants (name, slug)
      VALUES ('Concesionario Central Colombia', 'central-colombia')
      RETURNING id
    `;
    tenantId = t!.id;

    // Crear cliente (Party) y vehículo para pruebas comerciales
    await withTenant(appSql, { tenantId }, async (tx) => {
      const [p] = await tx<{ id: string }[]>`
        INSERT INTO parties (tenant_id, party_type)
        VALUES (${tenantId}::uuid, 'person')
        RETURNING id
      `;
      partyId = p!.id;

      const [v] = await tx<{ id: string }[]>`
        INSERT INTO vehicles (tenant_id, vin, current_plate, make, model)
        VALUES (${tenantId}::uuid, 'VIN-COMM-001', 'COM001', 'Toyota', 'Hilux GR-S')
        RETURNING id
      `;
      vehicleId = v!.id;
    });
  });

  afterAll(async () => {
    if (tenantId) {
      await adminSql`DELETE FROM tenants WHERE id = ${tenantId}::uuid`;
    }
    await adminSql.close();
    await appSql.close();
  });

  describe('1. Domain Entity & Rules Unit Tests', () => {
    it('Lead enforces required fields (name and at least one contact channel)', () => {
      const noName = Lead.create(
        { tenantId, firstName: '', phone: '3001234567' },
        clock
      );
      expect(noName.ok).toBe(false);

      const noContact = Lead.create(
        { tenantId, firstName: 'Juan' },
        clock
      );
      expect(noContact.ok).toBe(false);

      const valid = Lead.create(
        { tenantId, firstName: 'Juan', phone: '3001234567' },
        clock
      );
      expect(valid.ok).toBe(true);
      if (valid.ok) {
        expect(valid.value.status).toBe('new');
        expect(valid.value.domainEvents.length).toBe(1);
        expect(valid.value.domainEvents[0]?.eventType).toBe('LeadCreated');
      }
    });

    it('Lead tracks SLA and first contact detection accurately', () => {
      const leadRes = Lead.create(
        { tenantId, firstName: 'María', phone: '3109876543', slaMinutes: 30 },
        clock
      );
      expect(leadRes.ok).toBe(true);
      if (!leadRes.ok) return;

      const lead = leadRes.value;
      // Al momento de creación (0 min transcurridos), no hay violación de SLA
      expect(lead.isSlaBreached(clock.now())).toBe(false);

      // Avanzar el reloj 45 minutos (SLA de 30 minutos vencido)
      clock.advanceMs(45 * 60 * 1000);
      expect(lead.isSlaBreached(clock.now())).toBe(true);

      // Registrar primer contacto
      const contactRes = lead.recordFirstContact(clock);
      expect(contactRes.ok).toBe(true);
      expect(lead.status).toBe('contacted');
      expect(lead.firstContactedAt).toBeDefined();

      const contactedEvent = lead.domainEvents.find((e) => e.eventType === 'LeadContacted');
      expect(contactedEvent).toBeDefined();
      expect(contactedEvent?.payload.slaComplied).toBe(false); // Porque pasaron 45 min vs 30 min SLA
    });

    it('Calculates Quote amounts with Colombian IVA 19%, discount and trade-in allowance', () => {
      // Vehículo: $100.000.000 COP con IVA 19%
      // Accesorio: $5.000.000 COP con IVA 19%
      // Descuento: $5.000.000 COP
      // Retoma vehículo usado (Trade-in): $40.000.000 COP
      const items = [
        { id: '1', concept: 'Toyota Hilux 4x4', unitPrice: 100_000_000, quantity: 1, taxPct: 19 },
        { id: '2', concept: 'Película Nanocerámica', unitPrice: 5_000_000, quantity: 1, taxPct: 19 },
      ];

      const totals = Quote.calculateTotals(items, 5_000_000, 40_000_000);

      // Base total: 105.000.000
      expect(totals.basePrice).toBe(105_000_000);
      // Impuestos: 19% de 105.000.000 = 19.950.000
      expect(totals.taxesAmount).toBe(19_950_000);
      // Descuento: 5.000.000
      expect(totals.discountAmount).toBe(5_000_000);
      // Retoma: 40.000.000
      expect(totals.tradeInAllowance).toBe(40_000_000);
      // Neto: (105M - 5M + 19.95M) - 40M = 119.95M - 40M = 79.950.000
      expect(totals.netAmount).toBe(79_950_000);
    });

    it('Quote supports progressive versioning without losing history', () => {
      const quoteRes = Quote.create(
        {
          tenantId,
          dealId: crypto.randomUUID(),
          quoteNumber: 'COT-2026-001',
          items: [{ id: '1', concept: 'Toyota Yaris', unitPrice: 85_000_000, quantity: 1, taxPct: 19 }],
        },
        clock
      );
      expect(quoteRes.ok).toBe(true);
      if (!quoteRes.ok) return;

      const quote = quoteRes.value;
      expect(quote.currentVersion).toBe(1);
      expect(quote.versions.length).toBe(1);

      // Cliente pide descuento adicional en versión 2
      const v2Res = quote.addVersion(
        {
          items: [{ id: '1', concept: 'Toyota Yaris', unitPrice: 85_000_000, quantity: 1, taxPct: 19 }],
          discountAmount: 3_000_000,
        },
        clock
      );
      expect(v2Res.ok).toBe(true);
      expect(quote.currentVersion).toBe(2);
      expect(quote.versions.length).toBe(2);
      expect(quote.latestVersion?.discountAmount).toBe(3_000_000);
    });
  });

  describe('2. Use Cases & PostgreSQL Integration with Bun.sql and RLS', () => {
    it('creates lead, contacts lead, and converts to deal in commercial pipeline', async () => {
      await withTenant(appSql, { tenantId }, async (tx) => {
        const repo = new BunSqlCommercialRepository(tx);
        const createLeadUc = new CreateLeadUseCase(repo, clock);
        const contactLeadUc = new ContactLeadUseCase(repo, clock);
        const convertLeadUc = new ConvertLeadToDealUseCase(repo, clock);

        // 1. Asegurar pipelines automotrices en el tenant
        const pipelines = await repo.ensureDefaultPipelines();
        expect(pipelines.length).toBe(4);
        const passengerPipeline = pipelines.find((p) => p.code === 'new_passenger');
        expect(passengerPipeline).toBeDefined();

        // 2. Crear lead
        const leadRes = await createLeadUc.execute(tenantId, {
          firstName: 'Alejandro',
          lastName: 'Restrepo',
          phone: '+573155554433',
          email: 'alejandro.restrepo@example.com',
          source: 'meta_lead_ads',
          interestedVehicleModel: 'Toyota Hilux GR-S',
          notes: 'Interesado en compra con retoma de usado',
          slaMinutes: 60,
        });
        expect(leadRes.ok).toBe(true);
        if (!leadRes.ok) return;
        const lead = leadRes.value;

        // 3. Contactar al lead
        const contactRes = await contactLeadUc.execute(lead.id);
        expect(contactRes.ok).toBe(true);

        // 4. Convertir lead en Oportunidad Comercial (Deal)
        const convertRes = await convertLeadUc.execute(
          tenantId,
          {
            leadId: lead.id,
            pipelineId: passengerPipeline!.id,
            dealTitle: 'Compra Toyota Hilux GR-S — Alejandro Restrepo',
            estimatedValue: 195_000_000,
          },
          partyId
        );
        expect(convertRes.ok).toBe(true);
        if (!convertRes.ok) return;

        const { deal } = convertRes.value;
        expect(deal.partyId).toBe(partyId);
        expect(deal.leadId).toBe(lead.id);
        expect(deal.status).toBe('open');

        // Verificar persistencia y consulta
        const persistedDeal = await repo.findDealById(deal.id);
        expect(persistedDeal).toBeDefined();
        expect(persistedDeal?.title).toBe('Compra Toyota Hilux GR-S — Alejandro Restrepo');
        expect(persistedDeal?.estimatedValue).toBe(195_000_000);
      });
    });

    it('moves deal through pipeline stages and emits outbox events', async () => {
      await withTenant(appSql, { tenantId }, async (tx) => {
        const repo = new BunSqlCommercialRepository(tx);
        const moveStageUc = new MoveDealStageUseCase(repo, clock);

        const pipelines = await repo.findPipelines();
        const passengerPipeline = pipelines.find((p) => p.code === 'new_passenger')!;
        const stages = passengerPipeline.stages;
        const testDriveStage = stages.find((s) => s.code === 'test_drive')!;

        // Crear Deal para mover
        const dealRes = Deal.create(
          {
            tenantId,
            pipelineId: passengerPipeline.id,
            stageId: stages[0]!.id,
            title: 'Test Drive Oportunidad',
            partyId,
            vehicleId,
            estimatedValue: 120_000_000,
          },
          clock
        );
        expect(dealRes.ok).toBe(true);
        const deal = dealRes.value;
        await repo.saveDeal(deal);

        // Avanzar a etapa Test Drive
        const moveRes = await moveStageUc.execute({
          dealId: deal.id,
          newStageId: testDriveStage.id,
        });
        expect(moveRes.ok).toBe(true);
        expect(moveRes.value.stageId).toBe(testDriveStage.id);
        expect(moveRes.value.status).toBe('open');

        // Verificar que se haya emitido el evento al Outbox
        const outboxEvents = await tx<any[]>`
          SELECT * FROM outbox_events
          WHERE aggregate_type = 'Deal' AND aggregate_id = ${deal.id}
          ORDER BY occurred_at DESC
        `;
        expect(outboxEvents.length).toBeGreaterThan(0);
        expect(outboxEvents[0].event_type).toBe('DealStageChanged');
      });
    });

    it('creates versioned quote for deal, recalculating deal value and emitting QuoteIssued', async () => {
      await withTenant(appSql, { tenantId }, async (tx) => {
        const repo = new BunSqlCommercialRepository(tx);
        const createQuoteUc = new CreateQuoteUseCase(repo, clock);

        const pipelines = await repo.findPipelines();
        const passengerPipeline = pipelines.find((p) => p.code === 'new_passenger')!;

        const dealRes = Deal.create(
          {
            tenantId,
            pipelineId: passengerPipeline.id,
            stageId: passengerPipeline.stages[0]!.id,
            title: 'Negociación Corolla Cross Híbrido',
            partyId,
            vehicleId,
          },
          clock
        );
        const deal = dealRes.value;
        await repo.saveDeal(deal);

        const quoteRes = await createQuoteUc.execute(tenantId, {
          dealId: deal.id,
          quoteNumber: 'COT-2026-9901',
          items: [
            { id: '1', concept: 'Toyota Corolla Cross HEV', unitPrice: 125_000_000, quantity: 1, taxPct: 19 },
            { id: '2', concept: 'Tapetes Termoformados', unitPrice: 1_200_000, quantity: 1, taxPct: 19 },
          ],
          discountAmount: 2_000_000,
          tradeInAllowance: 35_000_000,
          paymentTerms: 'Financiamiento 70% + Retoma 30%',
          validDays: 20,
        });

        expect(quoteRes.ok).toBe(true);
        if (!quoteRes.ok) return;
        const quote = quoteRes.value;

        // Verificar cotización persistida
        const fetchedQuote = await repo.findQuoteById(quote.id);
        expect(fetchedQuote).toBeDefined();
        expect(fetchedQuote?.quoteNumber).toBe('COT-2026-9901');
        expect(fetchedQuote?.versions.length).toBe(1);
        expect(fetchedQuote?.latestVersion?.tradeInAllowance).toBe(35_000_000);

        // Verificar que el Deal actualizó su valor estimado al valor neto de la cotización
        const updatedDeal = await repo.findDealById(deal.id);
        expect(updatedDeal?.estimatedValue).toBe(fetchedQuote!.latestVersion!.netAmount);
      });
    });

    it('reconciles ERP sale with quote & deal (Decision D-44), marking sale completed and quote reconciled', async () => {
      await withTenant(appSql, { tenantId }, async (tx) => {
        const repo = new BunSqlCommercialRepository(tx);
        const reconcileUc = new ReconcileSaleWithErpUseCase(repo, clock);

        const pipelines = await repo.findPipelines();
        const passengerPipeline = pipelines.find((p) => p.code === 'new_passenger')!;

        // 1. Crear Deal y Quote
        const deal = Deal.create(
          {
            tenantId,
            pipelineId: passengerPipeline.id,
            stageId: passengerPipeline.stages[2]!.id,
            title: 'Venta Hilux — Facturación ERP',
            partyId,
            vehicleId,
          },
          clock
        ).value;
        await repo.saveDeal(deal);

        const quote = Quote.create(
          {
            tenantId,
            dealId: deal.id,
            quoteNumber: 'COT-2026-RECON',
            items: [{ id: '1', concept: 'Vehículo', unitPrice: 180_000_000, quantity: 1, taxPct: 19 }],
          },
          clock
        ).value;
        await repo.saveQuote(quote);

        // 2. Ejecutar reconciliación con pedido del ERP (vh_documentos_ped)
        const reconcileRes = await reconcileUc.execute(tenantId, {
          vehicleId,
          customerPartyId: partyId,
          dealId: deal.id,
          quoteId: quote.id,
          externalOrderNumber: 'PED-DMS-88192',
          externalInvoiceNumber: 'FAC-VEH-10492',
          saleAmount: 214_200_000,
          saleDate: '2026-10-15',
          deliveryDate: '2026-10-20',
        });

        expect(reconcileRes.ok).toBe(true);
        if (!reconcileRes.ok) return;

        const sale = reconcileRes.value;
        expect(sale.status).toBe('completed');
        expect(sale.externalOrderNumber).toBe('PED-DMS-88192');

        // 3. Verificar que Quote cambió a reconciled
        const updatedQuote = await repo.findQuoteById(quote.id);
        expect(updatedQuote?.status).toBe('reconciled');

        // 4. Verificar que Deal pasó a Won (Ganado)
        const updatedDeal = await repo.findDealById(deal.id);
        expect(updatedDeal?.status).toBe('won');
        expect(updatedDeal?.wonAt).toBeDefined();

        // 5. Verificar evento SaleReconciled en Outbox
        const outboxEvents = await tx<any[]>`
          SELECT * FROM outbox_events
          WHERE aggregate_type = 'Sale' AND aggregate_id = ${sale.id}
        `;
        expect(outboxEvents.length).toBe(1);
        expect(outboxEvents[0].event_type).toBe('SaleReconciled');
      });
    });
  });
});
