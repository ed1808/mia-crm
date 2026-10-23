import type { LeadSource } from '../../domain/lead';
import type { QuoteItem } from '../../domain/quote';

export interface CreateLeadDto {
  firstName: string;
  lastName?: string;
  documentType?: string;
  documentNumber?: string;
  email?: string;
  phone?: string;
  source?: LeadSource;
  interestedVehicleModel?: string;
  notes?: string;
  assignedTo?: string;
  branchId?: string;
  slaMinutes?: number;
}

export interface ConvertLeadDto {
  leadId: string;
  pipelineId?: string;
  stageId?: string;
  dealTitle?: string;
  estimatedValue?: number;
}

export interface CreateDealDto {
  pipelineId: string;
  stageId?: string;
  title: string;
  partyId: string;
  leadId?: string;
  vehicleId?: string;
  tradeInVehicleId?: string;
  assignedTo?: string;
  branchId?: string;
  estimatedValue?: number;
  expectedCloseDate?: string;
}

export interface MoveDealStageDto {
  dealId: string;
  newStageId: string;
  lossReason?: string;
}

export interface CreateQuoteDto {
  dealId: string;
  quoteNumber?: string;
  items: QuoteItem[];
  discountAmount?: number;
  tradeInAllowance?: number;
  paymentTerms?: string;
  validDays?: number;
  notes?: string;
}

export interface ReconcileSaleDto {
  vehicleId: string;
  customerPartyId: string;
  dealId?: string;
  quoteId?: string;
  externalOrderNumber?: string;
  externalInvoiceNumber?: string;
  saleAmount: number;
  saleDate: string; // YYYY-MM-DD
  deliveryDate?: string; // YYYY-MM-DD
  branchId?: string;
}
