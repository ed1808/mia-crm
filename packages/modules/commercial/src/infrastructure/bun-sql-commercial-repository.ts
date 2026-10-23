import type { SQL } from 'bun';
import type {
  CommercialRepository,
  DealFilter,
  LeadFilter,
} from '../domain/commercial-repository';
import { Lead } from '../domain/lead';
import {
  DEFAULT_AUTOMOTIVE_PIPELINES,
  Pipeline,
  PipelineStage,
} from '../domain/pipeline';
import { Deal } from '../domain/deal';
import { Quote, QuoteVersion } from '../domain/quote';
import { Sale } from '../domain/sale';

export class BunSqlCommercialRepository implements CommercialRepository {
  constructor(private readonly sql: SQL) {}

  // ----------------------------------------------------
  // LEADS
  // ----------------------------------------------------
  async saveLead(lead: Lead): Promise<void> {
    const slaDueAtStr = lead.slaDueAt ? lead.slaDueAt.toISOString() : null;
    const firstContactedAtStr = lead.firstContactedAt
      ? lead.firstContactedAt.toISOString()
      : null;

    await this.sql`
      INSERT INTO leads (
        id, tenant_id, branch_id, first_name, last_name, document_type, document_number,
        email, phone, source, status, discard_reason, assigned_to, party_id,
        interested_vehicle_model, notes, sla_due_at, first_contacted_at, created_at, updated_at
      ) VALUES (
        ${lead.id}::uuid,
        ${lead.tenantId}::uuid,
        ${lead.branchId ?? null}::uuid,
        ${lead.firstName},
        ${lead.lastName ?? null},
        ${lead.documentType ?? 'CC'},
        ${lead.documentNumber ?? null},
        ${lead.email ?? null},
        ${lead.phone ?? null},
        ${lead.source},
        ${lead.status},
        ${lead.discardReason ?? null},
        ${lead.assignedTo ?? null}::uuid,
        ${lead.partyId ?? null}::uuid,
        ${lead.interestedVehicleModel ?? null},
        ${lead.notes ?? null},
        ${slaDueAtStr}::timestamptz,
        ${firstContactedAtStr}::timestamptz,
        ${lead.createdAt.toISOString()}::timestamptz,
        ${lead.updatedAt.toISOString()}::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        branch_id = EXCLUDED.branch_id,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        document_type = EXCLUDED.document_type,
        document_number = EXCLUDED.document_number,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        source = EXCLUDED.source,
        status = EXCLUDED.status,
        discard_reason = EXCLUDED.discard_reason,
        assigned_to = EXCLUDED.assigned_to,
        party_id = EXCLUDED.party_id,
        interested_vehicle_model = EXCLUDED.interested_vehicle_model,
        notes = EXCLUDED.notes,
        first_contacted_at = EXCLUDED.first_contacted_at,
        updated_at = EXCLUDED.updated_at
    `;

    for (const event of lead.domainEvents) {
      await this.sql`
        INSERT INTO outbox_events (
          tenant_id, event_type, aggregate_type, aggregate_id, payload
        ) VALUES (
          ${lead.tenantId}::uuid,
          ${event.eventType},
          'Lead',
          ${lead.id},
          ${JSON.stringify(event.payload ?? {})}::jsonb
        )
      `;
    }
    lead.clearDomainEvents();
  }

  async findLeadById(id: string): Promise<Lead | undefined> {
    const rows = await this.sql<any[]>`
      SELECT * FROM leads WHERE id = ${id}::uuid LIMIT 1
    `;
    const row = rows[0];
    if (!row) return undefined;
    return this.mapLeadRow(row);
  }

  async findLeads(filter?: LeadFilter): Promise<Lead[]> {
    let rows: any[];
    if (filter?.status) {
      rows = await this.sql<any[]>`
        SELECT * FROM leads WHERE status = ${filter.status} ORDER BY created_at DESC
      `;
    } else {
      rows = await this.sql<any[]>`
        SELECT * FROM leads ORDER BY created_at DESC
      `;
    }
    return rows.map((r) => this.mapLeadRow(r));
  }

  private mapLeadRow(row: any): Lead {
    return Lead.reconstitute({
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id ?? undefined,
      firstName: row.first_name,
      lastName: row.last_name ?? undefined,
      documentType: row.document_type ?? undefined,
      documentNumber: row.document_number ?? undefined,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      source: row.source,
      status: row.status,
      discardReason: row.discard_reason ?? undefined,
      assignedTo: row.assigned_to ?? undefined,
      partyId: row.party_id ?? undefined,
      interestedVehicleModel: row.interested_vehicle_model ?? undefined,
      notes: row.notes ?? undefined,
      slaDueAt: row.sla_due_at ? new Date(row.sla_due_at) : undefined,
      firstContactedAt: row.first_contacted_at ? new Date(row.first_contacted_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  // ----------------------------------------------------
  // PIPELINES
  // ----------------------------------------------------
  async savePipeline(pipeline: Pipeline): Promise<void> {
    await this.sql`
      INSERT INTO pipelines (id, tenant_id, code, name, is_default, created_at)
      VALUES (
        ${pipeline.id}::uuid,
        ${pipeline.props.tenantId}::uuid,
        ${pipeline.code},
        ${pipeline.name},
        ${pipeline.isDefault},
        ${pipeline.props.createdAt.toISOString()}::timestamptz
      )
      ON CONFLICT (tenant_id, code) DO UPDATE SET
        name = EXCLUDED.name,
        is_default = EXCLUDED.is_default
    `;

    for (const stage of pipeline.props.stages) {
      await this.sql`
        INSERT INTO pipeline_stages (
          id, tenant_id, pipeline_id, code, name, order_index, probability_pct, is_won, is_lost, created_at
        ) VALUES (
          ${stage.id}::uuid,
          ${stage.props.tenantId}::uuid,
          ${pipeline.id}::uuid,
          ${stage.code},
          ${stage.name},
          ${stage.orderIndex},
          ${stage.probabilityPct},
          ${stage.isWon},
          ${stage.isLost},
          ${stage.props.createdAt.toISOString()}::timestamptz
        )
        ON CONFLICT (tenant_id, pipeline_id, code) DO UPDATE SET
          name = EXCLUDED.name,
          order_index = EXCLUDED.order_index,
          probability_pct = EXCLUDED.probability_pct,
          is_won = EXCLUDED.is_won,
          is_lost = EXCLUDED.is_lost
      `;
    }
  }

  async findPipelineById(id: string): Promise<Pipeline | undefined> {
    const pipeRows = await this.sql<any[]>`
      SELECT * FROM pipelines WHERE id = ${id}::uuid LIMIT 1
    `;
    const pRow = pipeRows[0];
    if (!pRow) return undefined;

    const stageRows = await this.sql<any[]>`
      SELECT * FROM pipeline_stages
      WHERE pipeline_id = ${id}::uuid
      ORDER BY order_index ASC
    `;

    const stages = stageRows.map(
      (s) =>
        new PipelineStage({
          id: s.id,
          pipelineId: s.pipeline_id,
          tenantId: s.tenant_id,
          code: s.code,
          name: s.name,
          orderIndex: Number(s.order_index),
          probabilityPct: Number(s.probability_pct),
          isWon: s.is_won,
          isLost: s.is_lost,
          createdAt: new Date(s.created_at),
        })
    );

    return new Pipeline({
      id: pRow.id,
      tenantId: pRow.tenant_id,
      code: pRow.code,
      name: pRow.name,
      isDefault: pRow.is_default,
      stages,
      createdAt: new Date(pRow.created_at),
    });
  }

  async findPipelines(): Promise<Pipeline[]> {
    const pipeRows = await this.sql<any[]>`
      SELECT * FROM pipelines ORDER BY is_default DESC, name ASC
    `;
    if (pipeRows.length === 0) {
      return this.ensureDefaultPipelines();
    }

    const pipelines: Pipeline[] = [];
    for (const pRow of pipeRows) {
      const stageRows = await this.sql<any[]>`
        SELECT * FROM pipeline_stages
        WHERE pipeline_id = ${pRow.id}::uuid
        ORDER BY order_index ASC
      `;

      const stages = stageRows.map(
        (s) =>
          new PipelineStage({
            id: s.id,
            pipelineId: s.pipeline_id,
            tenantId: s.tenant_id,
            code: s.code,
            name: s.name,
            orderIndex: Number(s.order_index),
            probabilityPct: Number(s.probability_pct),
            isWon: s.is_won,
            isLost: s.is_lost,
            createdAt: new Date(s.created_at),
          })
      );

      pipelines.push(
        new Pipeline({
          id: pRow.id,
          tenantId: pRow.tenant_id,
          code: pRow.code,
          name: pRow.name,
          isDefault: pRow.is_default,
          stages,
          createdAt: new Date(pRow.created_at),
        })
      );
    }

    return pipelines;
  }

  async ensureDefaultPipelines(): Promise<Pipeline[]> {
    // Consulta tenant actual de la conexión
    const tenantRes = await this.sql<any[]>`
      SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid as tenant_id
    `;
    const tenantId = tenantRes[0]?.tenant_id;
    if (!tenantId) return [];

    const now = new Date();
    const createdPipelines: Pipeline[] = [];

    for (const def of DEFAULT_AUTOMOTIVE_PIPELINES) {
      const pId = crypto.randomUUID();
      const stages = def.stages.map(
        (s) =>
          new PipelineStage({
            id: crypto.randomUUID(),
            pipelineId: pId,
            tenantId,
            code: s.code,
            name: s.name,
            orderIndex: s.orderIndex,
            probabilityPct: s.probabilityPct,
            isWon: s.isWon,
            isLost: s.isLost,
            createdAt: now,
          })
      );

      const pipeline = new Pipeline({
        id: pId,
        tenantId,
        code: def.code,
        name: def.name,
        isDefault: def.isDefault,
        stages,
        createdAt: now,
      });

      await this.savePipeline(pipeline);
      createdPipelines.push(pipeline);
    }

    return createdPipelines;
  }

  // ----------------------------------------------------
  // DEALS
  // ----------------------------------------------------
  async saveDeal(deal: Deal): Promise<void> {
    const wonAtStr = deal.wonAt ? deal.wonAt.toISOString() : null;
    const lostAtStr = deal.lostAt ? deal.lostAt.toISOString() : null;
    const expectedCloseStr = deal.expectedCloseDate
      ? deal.expectedCloseDate.toISOString().split('T')[0]
      : null;

    await this.sql`
      INSERT INTO deals (
        id, tenant_id, branch_id, pipeline_id, stage_id, title, party_id, lead_id,
        vehicle_id, trade_in_vehicle_id, assigned_to, estimated_value, currency,
        status, loss_reason, expected_close_date, won_at, lost_at, created_at, updated_at
      ) VALUES (
        ${deal.id}::uuid,
        ${deal.tenantId}::uuid,
        ${deal.branchId ?? null}::uuid,
        ${deal.pipelineId}::uuid,
        ${deal.stageId}::uuid,
        ${deal.title},
        ${deal.partyId}::uuid,
        ${deal.leadId ?? null}::uuid,
        ${deal.vehicleId ?? null}::uuid,
        ${deal.tradeInVehicleId ?? null}::uuid,
        ${deal.assignedTo ?? null}::uuid,
        ${deal.estimatedValue},
        ${deal.currency},
        ${deal.status},
        ${deal.lossReason ?? null},
        ${expectedCloseStr}::date,
        ${wonAtStr}::timestamptz,
        ${lostAtStr}::timestamptz,
        ${deal.createdAt.toISOString()}::timestamptz,
        ${deal.updatedAt.toISOString()}::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        branch_id = EXCLUDED.branch_id,
        stage_id = EXCLUDED.stage_id,
        title = EXCLUDED.title,
        vehicle_id = EXCLUDED.vehicle_id,
        trade_in_vehicle_id = EXCLUDED.trade_in_vehicle_id,
        assigned_to = EXCLUDED.assigned_to,
        estimated_value = EXCLUDED.estimated_value,
        status = EXCLUDED.status,
        loss_reason = EXCLUDED.loss_reason,
        expected_close_date = EXCLUDED.expected_close_date,
        won_at = EXCLUDED.won_at,
        lost_at = EXCLUDED.lost_at,
        updated_at = EXCLUDED.updated_at
    `;

    for (const event of deal.domainEvents) {
      await this.sql`
        INSERT INTO outbox_events (
          tenant_id, event_type, aggregate_type, aggregate_id, payload
        ) VALUES (
          ${deal.tenantId}::uuid,
          ${event.eventType},
          'Deal',
          ${deal.id},
          ${JSON.stringify(event.payload ?? {})}::jsonb
        )
      `;
    }
    deal.clearDomainEvents();
  }

  async findDealById(id: string): Promise<Deal | undefined> {
    const rows = await this.sql<any[]>`
      SELECT * FROM deals WHERE id = ${id}::uuid LIMIT 1
    `;
    const row = rows[0];
    if (!row) return undefined;
    return this.mapDealRow(row);
  }

  async findDeals(filter?: DealFilter): Promise<Deal[]> {
    let rows: any[];
    if (filter?.pipelineId) {
      rows = await this.sql<any[]>`
        SELECT * FROM deals
        WHERE pipeline_id = ${filter.pipelineId}::uuid
        ORDER BY created_at DESC
      `;
    } else {
      rows = await this.sql<any[]>`
        SELECT * FROM deals ORDER BY created_at DESC
      `;
    }
    return rows.map((r) => this.mapDealRow(r));
  }

  private mapDealRow(row: any): Deal {
    return Deal.reconstitute({
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id ?? undefined,
      pipelineId: row.pipeline_id,
      stageId: row.stage_id,
      title: row.title,
      partyId: row.party_id,
      leadId: row.lead_id ?? undefined,
      vehicleId: row.vehicle_id ?? undefined,
      tradeInVehicleId: row.trade_in_vehicle_id ?? undefined,
      assignedTo: row.assigned_to ?? undefined,
      estimatedValue: Number(row.estimated_value),
      currency: row.currency,
      status: row.status,
      lossReason: row.loss_reason ?? undefined,
      expectedCloseDate: row.expected_close_date ? new Date(row.expected_close_date) : undefined,
      wonAt: row.won_at ? new Date(row.won_at) : undefined,
      lostAt: row.lost_at ? new Date(row.lost_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  // ----------------------------------------------------
  // QUOTES
  // ----------------------------------------------------
  async saveQuote(quote: Quote): Promise<void> {
    await this.sql`
      INSERT INTO quotes (
        id, tenant_id, deal_id, quote_number, current_version, status, created_at, updated_at
      ) VALUES (
        ${quote.id}::uuid,
        ${quote.tenantId}::uuid,
        ${quote.dealId}::uuid,
        ${quote.quoteNumber},
        ${quote.currentVersion},
        ${quote.status},
        ${quote.createdAt.toISOString()}::timestamptz,
        ${quote.updatedAt.toISOString()}::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        current_version = EXCLUDED.current_version,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
    `;

    for (const v of quote.versions) {
      const itemsJson = JSON.stringify(v.items);
      const validUntilStr = v.validUntil.toISOString().split('T')[0];

      await this.sql`
        INSERT INTO quote_versions (
          id, tenant_id, quote_id, version_number, base_price, discount_amount, taxes_amount,
          trade_in_allowance, net_amount, payment_terms, valid_until, items_json, notes, created_at
        ) VALUES (
          ${v.props.id}::uuid,
          ${v.props.tenantId}::uuid,
          ${quote.id}::uuid,
          ${v.versionNumber},
          ${v.basePrice},
          ${v.discountAmount},
          ${v.taxesAmount},
          ${v.tradeInAllowance},
          ${v.netAmount},
          ${v.props.paymentTerms ?? null},
          ${validUntilStr}::date,
          ${itemsJson}::jsonb,
          ${v.props.notes ?? null},
          ${v.props.createdAt.toISOString()}::timestamptz
        )
        ON CONFLICT (tenant_id, quote_id, version_number) DO UPDATE SET
          base_price = EXCLUDED.base_price,
          discount_amount = EXCLUDED.discount_amount,
          taxes_amount = EXCLUDED.taxes_amount,
          trade_in_allowance = EXCLUDED.trade_in_allowance,
          net_amount = EXCLUDED.net_amount,
          items_json = EXCLUDED.items_json
      `;
    }

    for (const event of quote.domainEvents) {
      await this.sql`
        INSERT INTO outbox_events (
          tenant_id, event_type, aggregate_type, aggregate_id, payload
        ) VALUES (
          ${quote.tenantId}::uuid,
          ${event.eventType},
          'Quote',
          ${quote.id},
          ${JSON.stringify(event.payload ?? {})}::jsonb
        )
      `;
    }
    quote.clearDomainEvents();
  }

  async findQuoteById(id: string): Promise<Quote | undefined> {
    const qRows = await this.sql<any[]>`
      SELECT * FROM quotes WHERE id = ${id}::uuid LIMIT 1
    `;
    const qRow = qRows[0];
    if (!qRow) return undefined;

    const vRows = await this.sql<any[]>`
      SELECT * FROM quote_versions WHERE quote_id = ${id}::uuid ORDER BY version_number ASC
    `;

    const versions = vRows.map(
      (v) =>
        new QuoteVersion({
          id: v.id,
          quoteId: v.quote_id,
          tenantId: v.tenant_id,
          versionNumber: Number(v.version_number),
          basePrice: Number(v.base_price),
          discountAmount: Number(v.discount_amount),
          taxesAmount: Number(v.taxes_amount),
          tradeInAllowance: Number(v.trade_in_allowance),
          netAmount: Number(v.net_amount),
          paymentTerms: v.payment_terms ?? undefined,
          validUntil: new Date(v.valid_until),
          items: typeof v.items_json === 'string' ? JSON.parse(v.items_json) : v.items_json,
          notes: v.notes ?? undefined,
          createdAt: new Date(v.created_at),
        })
    );

    return Quote.reconstitute({
      id: qRow.id,
      tenantId: qRow.tenant_id,
      dealId: qRow.deal_id,
      quoteNumber: qRow.quote_number,
      currentVersion: Number(qRow.current_version),
      status: qRow.status,
      versions,
      createdAt: new Date(qRow.created_at),
      updatedAt: new Date(qRow.updated_at),
    });
  }

  async findQuoteByNumber(quoteNumber: string): Promise<Quote | undefined> {
    const qRows = await this.sql<any[]>`
      SELECT id FROM quotes WHERE quote_number = ${quoteNumber} LIMIT 1
    `;
    if (!qRows[0]) return undefined;
    return this.findQuoteById(qRows[0].id);
  }

  async findQuotesByDealId(dealId: string): Promise<Quote[]> {
    const qRows = await this.sql<any[]>`
      SELECT id FROM quotes WHERE deal_id = ${dealId}::uuid ORDER BY created_at DESC
    `;
    const quotes: Quote[] = [];
    for (const r of qRows) {
      const q = await this.findQuoteById(r.id);
      if (q) quotes.push(q);
    }
    return quotes;
  }

  // ----------------------------------------------------
  // SALES
  // ----------------------------------------------------
  async saveSale(sale: Sale): Promise<void> {
    const saleDateStr = sale.saleDate.toISOString().split('T')[0];
    const deliveryDateStr = sale.deliveryDate
      ? sale.deliveryDate.toISOString().split('T')[0]
      : null;

    await this.sql`
      INSERT INTO sales (
        id, tenant_id, branch_id, deal_id, quote_id, vehicle_id, customer_party_id,
        external_order_number, external_invoice_number, sale_amount, sale_date,
        delivery_date, status, reconciled_at
      ) VALUES (
        ${sale.id}::uuid,
        ${sale.tenantId}::uuid,
        ${sale.branchId ?? null}::uuid,
        ${sale.dealId ?? null}::uuid,
        ${sale.quoteId ?? null}::uuid,
        ${sale.vehicleId}::uuid,
        ${sale.customerPartyId}::uuid,
        ${sale.externalOrderNumber ?? null},
        ${sale.externalInvoiceNumber ?? null},
        ${sale.saleAmount},
        ${saleDateStr}::date,
        ${deliveryDateStr}::date,
        ${sale.status},
        ${sale.reconciledAt.toISOString()}::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        delivery_date = EXCLUDED.delivery_date,
        status = EXCLUDED.status,
        external_invoice_number = EXCLUDED.external_invoice_number
    `;

    for (const event of sale.domainEvents) {
      await this.sql`
        INSERT INTO outbox_events (
          tenant_id, event_type, aggregate_type, aggregate_id, payload
        ) VALUES (
          ${sale.tenantId}::uuid,
          ${event.eventType},
          'Sale',
          ${sale.id},
          ${JSON.stringify(event.payload ?? {})}::jsonb
        )
      `;
    }
    sale.clearDomainEvents();
  }

  async findSaleById(id: string): Promise<Sale | undefined> {
    const rows = await this.sql<any[]>`
      SELECT * FROM sales WHERE id = ${id}::uuid LIMIT 1
    `;
    const r = rows[0];
    if (!r) return undefined;
    return this.mapSaleRow(r);
  }

  async findSalesByVehicleId(vehicleId: string): Promise<Sale[]> {
    const rows = await this.sql<any[]>`
      SELECT * FROM sales WHERE vehicle_id = ${vehicleId}::uuid ORDER BY sale_date DESC
    `;
    return rows.map((r) => this.mapSaleRow(r));
  }

  async findSales(limit = 50): Promise<Sale[]> {
    const rows = await this.sql<any[]>`
      SELECT * FROM sales ORDER BY sale_date DESC LIMIT ${limit}
    `;
    return rows.map((r) => this.mapSaleRow(r));
  }

  private mapSaleRow(r: any): Sale {
    return Sale.reconstitute({
      id: r.id,
      tenantId: r.tenant_id,
      branchId: r.branch_id ?? undefined,
      dealId: r.deal_id ?? undefined,
      quoteId: r.quote_id ?? undefined,
      vehicleId: r.vehicle_id,
      customerPartyId: r.customer_party_id,
      externalOrderNumber: r.external_order_number ?? undefined,
      externalInvoiceNumber: r.external_invoice_number ?? undefined,
      saleAmount: Number(r.sale_amount),
      saleDate: new Date(r.sale_date),
      deliveryDate: r.delivery_date ? new Date(r.delivery_date) : undefined,
      status: r.status,
      reconciledAt: new Date(r.reconciled_at),
    });
  }
}
