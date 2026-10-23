import type { Lead } from './lead';
import type { Pipeline } from './pipeline';
import type { Deal } from './deal';
import type { Quote } from './quote';
import type { Sale } from './sale';

export interface LeadFilter {
  status?: string;
  source?: string;
  assignedTo?: string;
  search?: string;
}

export interface DealFilter {
  pipelineId?: string;
  stageId?: string;
  status?: string;
  assignedTo?: string;
  partyId?: string;
}

export interface CommercialRepository {
  // Leads
  saveLead(lead: Lead): Promise<void>;
  findLeadById(id: string): Promise<Lead | undefined>;
  findLeads(filter?: LeadFilter): Promise<Lead[]>;

  // Pipelines
  savePipeline(pipeline: Pipeline): Promise<void>;
  findPipelineById(id: string): Promise<Pipeline | undefined>;
  findPipelines(): Promise<Pipeline[]>;
  ensureDefaultPipelines(): Promise<Pipeline[]>;

  // Deals
  saveDeal(deal: Deal): Promise<void>;
  findDealById(id: string): Promise<Deal | undefined>;
  findDeals(filter?: DealFilter): Promise<Deal[]>;

  // Quotes
  saveQuote(quote: Quote): Promise<void>;
  findQuoteById(id: string): Promise<Quote | undefined>;
  findQuoteByNumber(quoteNumber: string): Promise<Quote | undefined>;
  findQuotesByDealId(dealId: string): Promise<Quote[]>;

  // Sales
  saveSale(sale: Sale): Promise<void>;
  findSaleById(id: string): Promise<Sale | undefined>;
  findSalesByVehicleId(vehicleId: string): Promise<Sale[]>;
  findSales(limit?: number): Promise<Sale[]>;
}
