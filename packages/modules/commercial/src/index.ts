// Public API for @mia-crm/module-commercial
// Layer 4 strictly controls what is visible outside this bounded context

// Domain Entities & Types
export { Lead, type LeadProps, type LeadSource, type LeadStatus } from './domain/lead';
export {
  Pipeline,
  PipelineStage,
  type PipelineProps,
  type PipelineStageProps,
  DEFAULT_AUTOMOTIVE_PIPELINES,
} from './domain/pipeline';
export { Deal, type DealProps, type DealStatus } from './domain/deal';
export {
  Quote,
  QuoteVersion,
  type QuoteProps,
  type QuoteVersionProps,
  type QuoteItem,
  type QuoteStatus,
} from './domain/quote';
export { Sale, type SaleProps, type SaleStatus } from './domain/sale';

// Domain Ports & Filters
export type {
  CommercialRepository,
  LeadFilter,
  DealFilter,
} from './domain/commercial-repository';

// Domain Events
export type {
  LeadCreatedPayload,
  LeadContactedPayload,
  LeadConvertedPayload,
  DealStageChangedPayload,
  QuoteIssuedPayload,
  SaleReconciledPayload,
} from './domain/events';

// Application Use Cases & DTOs
export { CreateLeadUseCase } from './application/usecases/create-lead.use-case';
export { ContactLeadUseCase } from './application/usecases/contact-lead.use-case';
export { ConvertLeadToDealUseCase } from './application/usecases/convert-lead-to-deal.use-case';
export { MoveDealStageUseCase } from './application/usecases/move-deal-stage.use-case';
export { CreateQuoteUseCase } from './application/usecases/create-quote.use-case';
export { ReconcileSaleWithErpUseCase } from './application/usecases/reconcile-sale.use-case';
export type {
  CreateLeadDto,
  ConvertLeadDto,
  CreateDealDto,
  MoveDealStageDto,
  CreateQuoteDto,
  ReconcileSaleDto,
} from './application/dto/commercial-dtos';

// Infrastructure Concrete Implementations
export { BunSqlCommercialRepository } from './infrastructure/bun-sql-commercial-repository';
