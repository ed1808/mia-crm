import { Hono } from 'hono';
import { withTenant } from '@mia-crm/db';
import { SystemClock } from '@mia-crm/kernel';
import {
  BunSqlCommercialRepository,
  CreateLeadUseCase,
  ContactLeadUseCase,
  ConvertLeadToDealUseCase,
  MoveDealStageUseCase,
  CreateQuoteUseCase,
  ReconcileSaleWithErpUseCase,
  Deal,
} from '@mia-crm/module-commercial';
import { tenantMiddleware } from '../middleware/tenant';

export function createCommercialRouter() {
  const router = new Hono();
  const clock = new SystemClock();

  router.use('*', tenantMiddleware);

  // -------------------------------------------------------------------------
  // PIPELINES & ETAPAS
  // -------------------------------------------------------------------------
  // GET /api/v1/commercial/pipelines — Listado de los 4 pipelines y sus etapas
  router.get('/pipelines', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');

    const pipelines = await withTenant(db, { tenantId }, async (tx) => {
      const repo = new BunSqlCommercialRepository(tx);
      return await repo.findPipelines();
    });

    return c.json({
      data: pipelines.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        isDefault: p.isDefault,
        stages: p.stages.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          orderIndex: s.orderIndex,
          probabilityPct: s.probabilityPct,
          isWon: s.isWon,
          isLost: s.isLost,
        })),
      })),
    });
  });

  // -------------------------------------------------------------------------
  // LEADS
  // -------------------------------------------------------------------------
  // GET /api/v1/commercial/leads — Bandeja de entrada de leads
  router.get('/leads', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');
    const status = c.req.query('status');

    const leads = await withTenant(db, { tenantId }, async (tx) => {
      const repo = new BunSqlCommercialRepository(tx);
      return await repo.findLeads(status ? { status } : undefined);
    });

    const now = new Date();

    return c.json({
      data: leads.map((l) => ({
        id: l.id,
        firstName: l.firstName,
        lastName: l.lastName,
        fullName: l.fullName,
        documentType: l.documentType,
        documentNumber: l.documentNumber,
        email: l.email,
        phone: l.phone,
        source: l.source,
        status: l.status,
        discardReason: l.discardReason,
        assignedTo: l.assignedTo,
        partyId: l.partyId,
        interestedVehicleModel: l.interestedVehicleModel,
        notes: l.notes,
        slaDueAt: l.slaDueAt?.toISOString(),
        firstContactedAt: l.firstContactedAt?.toISOString(),
        isSlaBreached: l.isSlaBreached(now),
        createdAt: l.createdAt.toISOString(),
      })),
    });
  });

  // POST /api/v1/commercial/leads — Crear nuevo lead
  router.post('/leads', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');
    const body = await c.req.json();

    const result = await withTenant(db, { tenantId }, async (tx) => {
      const repo = new BunSqlCommercialRepository(tx);
      const useCase = new CreateLeadUseCase(repo, clock);
      return await useCase.execute(tenantId, {
        firstName: body.firstName,
        lastName: body.lastName,
        documentType: body.documentType,
        documentNumber: body.documentNumber,
        email: body.email,
        phone: body.phone,
        source: body.source,
        interestedVehicleModel: body.interestedVehicleModel,
        notes: body.notes,
        assignedTo: body.assignedTo,
        branchId: body.branchId,
        slaMinutes: body.slaMinutes,
      });
    });

    if (!result.ok) {
      return c.json({ error: result.error.message, code: result.error.code }, 400);
    }

    return c.json({ data: { id: result.value.id, status: result.value.status } }, 201);
  });

  // PATCH /api/v1/commercial/leads/:id/contact — Registrar primer contacto
  router.patch('/leads/:id/contact', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');
    const leadId = c.req.param('id');

    const result = await withTenant(db, { tenantId }, async (tx) => {
      const repo = new BunSqlCommercialRepository(tx);
      const useCase = new ContactLeadUseCase(repo, clock);
      return await useCase.execute(leadId);
    });

    if (!result.ok) {
      return c.json({ error: result.error.message, code: result.error.code }, 400);
    }

    return c.json({
      data: {
        id: result.value.id,
        status: result.value.status,
        firstContactedAt: result.value.firstContactedAt?.toISOString(),
      },
    });
  });

  // POST /api/v1/commercial/leads/:id/convert — Convertir lead en oportunidad comercial (Deal)
  router.post('/leads/:id/convert', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');
    const leadId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));

    const result = await withTenant(db, { tenantId }, async (tx) => {
      const repo = new BunSqlCommercialRepository(tx);
      const useCase = new ConvertLeadToDealUseCase(repo, clock);

      // Si no viene partyId en el body, crear o resolver Party
      let partyId = body.partyId;
      if (!partyId) {
        const lead = await repo.findLeadById(leadId);
        if (lead) {
          const [p] = await tx<{ id: string }[]>`
            INSERT INTO parties (tenant_id, party_type)
            VALUES (${tenantId}::uuid, 'person')
            RETURNING id
          `;
          partyId = p!.id;

          await tx`
            INSERT INTO persons (
              party_id, tenant_id, first_name, last_name
            ) VALUES (
              ${partyId}::uuid, ${tenantId}::uuid,
              ${lead.firstName}, ${lead.lastName ?? null}
            )
          `;

          if (lead.phone) {
            await tx`
              INSERT INTO party_contact_points (
                tenant_id, party_id, channel, value, is_primary
              ) VALUES (
                ${tenantId}::uuid, ${partyId}::uuid, 'mobile', ${lead.phone}, true
              )
            `;
          }

          if (lead.email) {
            await tx`
              INSERT INTO party_contact_points (
                tenant_id, party_id, channel, value, is_primary
              ) VALUES (
                ${tenantId}::uuid, ${partyId}::uuid, 'email', ${lead.email}, false
              )
            `;
          }
        }
      }

      if (!partyId) {
        return { ok: false, error: { message: 'No se pudo resolver el cliente (Party)', code: 'NO_PARTY' } } as const;
      }

      return await useCase.execute(
        tenantId,
        {
          leadId,
          pipelineId: body.pipelineId,
          stageId: body.stageId,
          dealTitle: body.dealTitle,
          estimatedValue: body.estimatedValue ? Number(body.estimatedValue) : undefined,
        },
        partyId
      );
    });

    if (!result.ok) {
      return c.json({ error: result.error.message, code: result.error.code }, 400);
    }

    return c.json({
      data: {
        dealId: result.value.deal.id,
        title: result.value.deal.title,
        status: result.value.deal.status,
      },
    }, 201);
  });

  // -------------------------------------------------------------------------
  // DEALS (OPORTUNIDADES COMERCIALES / KANBAN)
  // -------------------------------------------------------------------------
  // GET /api/v1/commercial/deals — Listado de deals con enriquecimiento para el tablero Kanban
  router.get('/deals', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');
    const pipelineId = c.req.query('pipelineId');

    const deals = await withTenant(db, { tenantId }, async (tx) => {
      const rows = await tx<any[]>`
        SELECT
          d.*,
          COALESCE(p_person.first_name || ' ' || COALESCE(p_person.last_name, ''), p_comp.legal_name, 'Cliente') as customer_name,
          COALESCE(pcp.value, '') as customer_phone,
          v.current_plate as vehicle_plate,
          v.make as vehicle_make,
          v.model as vehicle_model,
          v.model_year as vehicle_year,
          trade_v.current_plate as trade_in_plate,
          trade_v.make as trade_in_make,
          trade_v.model as trade_in_model
        FROM deals d
        LEFT JOIN parties party ON party.id = d.party_id
        LEFT JOIN persons p_person ON p_person.party_id = d.party_id
        LEFT JOIN party_contact_points pcp ON pcp.party_id = d.party_id AND pcp.channel = 'mobile' AND pcp.is_primary = true
        LEFT JOIN companies p_comp ON p_comp.party_id = d.party_id
        LEFT JOIN vehicles v ON v.id = d.vehicle_id
        LEFT JOIN vehicles trade_v ON trade_v.id = d.trade_in_vehicle_id
        WHERE (${pipelineId ?? null}::uuid IS NULL OR d.pipeline_id = ${pipelineId ?? null}::uuid)
        ORDER BY d.created_at DESC
      `;
      return rows;
    });

    return c.json({
      data: deals.map((d) => ({
        id: d.id,
        title: d.title,
        pipelineId: d.pipeline_id,
        stageId: d.stage_id,
        partyId: d.party_id,
        customerName: d.customer_name,
        customerPhone: d.customer_phone,
        leadId: d.lead_id,
        vehicleId: d.vehicle_id,
        vehicleDescription: d.vehicle_make ? `${d.vehicle_make} ${d.vehicle_model} (${d.vehicle_year ?? ''})` : null,
        vehiclePlate: d.vehicle_plate,
        tradeInVehicleId: d.trade_in_vehicle_id,
        tradeInDescription: d.trade_in_make ? `${d.trade_in_make} ${d.trade_in_model} [${d.trade_in_plate}]` : null,
        assignedTo: d.assigned_to,
        estimatedValue: Number(d.estimated_value),
        currency: d.currency,
        status: d.status,
        lossReason: d.loss_reason,
        expectedCloseDate: d.expected_close_date,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      })),
    });
  });

  // POST /api/v1/commercial/deals — Crear deal manualmente
  router.post('/deals', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');
    const body = await c.req.json();

    const result = await withTenant(db, { tenantId }, async (tx) => {
      const repo = new BunSqlCommercialRepository(tx);
      const pipeline = await repo.findPipelineById(body.pipelineId);
      if (!pipeline) {
        return { ok: false, error: { message: 'Pipeline no encontrado', code: 'PIPELINE_NOT_FOUND' } } as const;
      }

      const stage = body.stageId ? pipeline.findStage(body.stageId) : pipeline.getInitialStage();
      if (!stage) {
        return { ok: false, error: { message: 'Etapa no válida', code: 'STAGE_NOT_FOUND' } } as const;
      }

      const dealRes = Deal.create(
        {
          tenantId,
          pipelineId: pipeline.id,
          stageId: stage.id,
          title: body.title,
          partyId: body.partyId,
          vehicleId: body.vehicleId,
          tradeInVehicleId: body.tradeInVehicleId,
          assignedTo: body.assignedTo,
          estimatedValue: body.estimatedValue ? Number(body.estimatedValue) : 0,
          expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : undefined,
        },
        clock
      );

      if (!dealRes.ok) return dealRes;

      await repo.saveDeal(dealRes.value);
      return dealRes;
    });

    if (!result.ok) {
      return c.json({ error: result.error.message, code: result.error.code }, 400);
    }

    return c.json({ data: { id: result.value.id } }, 201);
  });

  // PATCH /api/v1/commercial/deals/:id/stage — Mover deal de etapa (drag and drop en el kanban)
  router.patch('/deals/:id/stage', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');
    const dealId = c.req.param('id');
    const body = await c.req.json();

    const result = await withTenant(db, { tenantId }, async (tx) => {
      const repo = new BunSqlCommercialRepository(tx);
      const useCase = new MoveDealStageUseCase(repo, clock);
      return await useCase.execute({
        dealId,
        newStageId: body.newStageId,
        lossReason: body.lossReason,
      });
    });

    if (!result.ok) {
      return c.json({ error: result.error.message, code: result.error.code }, 400);
    }

    return c.json({
      data: {
        id: result.value.id,
        stageId: result.value.stageId,
        status: result.value.status,
      },
    });
  });

  // -------------------------------------------------------------------------
  // QUOTES & VERSIONES (COTIZACIONES)
  // -------------------------------------------------------------------------
  // GET /api/v1/commercial/deals/:id/quotes — Cotizaciones de un Deal
  router.get('/deals/:id/quotes', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');
    const dealId = c.req.param('id');

    const quotes = await withTenant(db, { tenantId }, async (tx) => {
      const repo = new BunSqlCommercialRepository(tx);
      return await repo.findQuotesByDealId(dealId);
    });

    return c.json({
      data: quotes.map((q) => ({
        id: q.id,
        quoteNumber: q.quoteNumber,
        currentVersion: q.currentVersion,
        status: q.status,
        latestVersion: q.latestVersion
          ? {
              versionNumber: q.latestVersion.versionNumber,
              basePrice: q.latestVersion.basePrice,
              discountAmount: q.latestVersion.discountAmount,
              taxesAmount: q.latestVersion.taxesAmount,
              tradeInAllowance: q.latestVersion.tradeInAllowance,
              netAmount: q.latestVersion.netAmount,
              validUntil: q.latestVersion.validUntil.toISOString(),
              items: q.latestVersion.items,
            }
          : null,
        versions: q.versions.map((v) => ({
          versionNumber: v.versionNumber,
          netAmount: v.netAmount,
          validUntil: v.validUntil.toISOString(),
        })),
      })),
    });
  });

  // POST /api/v1/commercial/deals/:id/quotes — Generar nueva cotización
  router.post('/deals/:id/quotes', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');
    const dealId = c.req.param('id');
    const body = await c.req.json();

    const result = await withTenant(db, { tenantId }, async (tx) => {
      const repo = new BunSqlCommercialRepository(tx);
      const useCase = new CreateQuoteUseCase(repo, clock);
      return await useCase.execute(tenantId, {
        dealId,
        quoteNumber: body.quoteNumber,
        items: body.items,
        discountAmount: body.discountAmount ? Number(body.discountAmount) : 0,
        tradeInAllowance: body.tradeInAllowance ? Number(body.tradeInAllowance) : 0,
        paymentTerms: body.paymentTerms,
        validDays: body.validDays ? Number(body.validDays) : 15,
        notes: body.notes,
      });
    });

    if (!result.ok) {
      return c.json({ error: result.error.message, code: result.error.code }, 400);
    }

    const q = result.value;
    return c.json({
      data: {
        id: q.id,
        quoteNumber: q.quoteNumber,
        version: q.currentVersion,
        netAmount: q.latestVersion?.netAmount,
      },
    }, 201);
  });

  // -------------------------------------------------------------------------
  // SALES (CONCILIACIÓN CON ERP, D-44)
  // -------------------------------------------------------------------------
  // GET /api/v1/commercial/sales — Listado de ventas concluidas y conciliadas
  router.get('/sales', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');

    const sales = await withTenant(db, { tenantId }, async (tx) => {
      const rows = await tx<any[]>`
        SELECT
          s.*,
          v.current_plate as vehicle_plate,
          v.make as vehicle_make,
          v.model as vehicle_model,
          v.vin as vehicle_vin,
          COALESCE(p_person.first_name || ' ' || COALESCE(p_person.last_name, ''), p_comp.legal_name, 'Cliente') as customer_name
        FROM sales s
        JOIN vehicles v ON v.id = s.vehicle_id
        JOIN parties p ON p.id = s.customer_party_id
        LEFT JOIN persons p_person ON p_person.party_id = s.customer_party_id
        LEFT JOIN companies p_comp ON p_comp.party_id = s.customer_party_id
        ORDER BY s.sale_date DESC
        LIMIT 50
      `;
      return rows;
    });

    return c.json({
      data: sales.map((s) => ({
        id: s.id,
        vehicleId: s.vehicle_id,
        vehiclePlate: s.vehicle_plate,
        vehicleDescription: `${s.vehicle_make} ${s.vehicle_model}`,
        vehicleVin: s.vehicle_vin,
        customerPartyId: s.customer_party_id,
        customerName: s.customer_name,
        dealId: s.deal_id,
        quoteId: s.quote_id,
        externalOrderNumber: s.external_order_number,
        externalInvoiceNumber: s.external_invoice_number,
        saleAmount: Number(s.sale_amount),
        saleDate: s.sale_date,
        deliveryDate: s.delivery_date,
        status: s.status,
        reconciledAt: s.reconciled_at,
      })),
    });
  });

  // POST /api/v1/commercial/sales/reconcile — Conciliación de venta con ERP
  router.post('/sales/reconcile', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');
    const body = await c.req.json();

    const result = await withTenant(db, { tenantId }, async (tx) => {
      const repo = new BunSqlCommercialRepository(tx);
      const useCase = new ReconcileSaleWithErpUseCase(repo, clock);
      return await useCase.execute(tenantId, {
        vehicleId: body.vehicleId,
        customerPartyId: body.customerPartyId,
        dealId: body.dealId,
        quoteId: body.quoteId,
        externalOrderNumber: body.externalOrderNumber,
        externalInvoiceNumber: body.externalInvoiceNumber,
        saleAmount: Number(body.saleAmount),
        saleDate: body.saleDate ?? new Date().toISOString().split('T')[0],
        deliveryDate: body.deliveryDate,
      });
    });

    if (!result.ok) {
      return c.json({ error: result.error.message, code: result.error.code }, 400);
    }

    return c.json({
      data: {
        id: result.value.id,
        status: result.value.status,
        externalOrderNumber: result.value.externalOrderNumber,
      },
    }, 201);
  });

  return router;
}
