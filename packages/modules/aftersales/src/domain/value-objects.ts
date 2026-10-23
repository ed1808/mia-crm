export type OrderType =
  | 'maintenance'
  | 'repair'
  | 'warranty'
  | 'collision'
  | 'recall_campaign'
  | 'internal'
  | 'quick_service';

export type OrderStatus = 'opened' | 'in_progress' | 'completed' | 'voided' | 'billed';

export type ChargeToType = 'customer' | 'warranty' | 'internal' | 'insurance';
