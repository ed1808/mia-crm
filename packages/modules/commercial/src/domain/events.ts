// Domain Events for Commercial Context (Decisions D-01, D-25, D-44)

export interface LeadCreatedPayload {
  readonly leadId: string;
  readonly tenantId: string;
  readonly firstName: string;
  readonly lastName?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly source: string;
  readonly interestedVehicleModel?: string;
  readonly slaDueAt?: string;
}

export interface LeadContactedPayload {
  readonly leadId: string;
  readonly tenantId: string;
  readonly contactedAt: string;
  readonly slaComplied: boolean;
}

export interface LeadConvertedPayload {
  readonly leadId: string;
  readonly tenantId: string;
  readonly partyId: string;
  readonly dealId: string;
}

export interface DealStageChangedPayload {
  readonly dealId: string;
  readonly tenantId: string;
  readonly previousStageId: string;
  readonly newStageId: string;
  readonly status: 'open' | 'won' | 'lost' | 'abandoned';
}

export interface QuoteIssuedPayload {
  readonly quoteId: string;
  readonly dealId: string;
  readonly tenantId: string;
  readonly quoteNumber: string;
  readonly versionNumber: number;
  readonly netAmount: number;
  readonly validUntil: string;
}

export interface SaleReconciledPayload {
  readonly saleId: string;
  readonly tenantId: string;
  readonly dealId?: string;
  readonly quoteId?: string;
  readonly vehicleId: string;
  readonly customerPartyId: string;
  readonly externalOrderNumber?: string;
  readonly externalInvoiceNumber?: string;
  readonly saleAmount: number;
  readonly deliveryDate?: string;
}
