export interface VehicleSummary {
  id: string;
  vin: string | null;
  current_plate: string | null;
  make: string;
  model: string;
  model_year: number | null;
  vehicle_type: string;
  current_mileage: number | null;
  current_operating_hours: number | null;
  warranty_end_date: string | null;
  rtm_due_date: string | null;
  owner_party_id: string | null;
  owner_name: string | null;
  owner_id_number: string | null;
  owner_is_company: boolean | null;
  projected_date: string | null;
  projected_mileage: number | null;
  projection_method: string | null;
  confidence_level: string | null;
  active_opportunities_count: string;
}

export interface Vehicle360Data {
  vehicle: {
    id: string;
    vin: string | null;
    current_plate: string | null;
    make: string;
    model: string;
    model_year: number | null;
    vehicle_type: string;
    current_mileage: number | null;
    current_operating_hours: number | null;
    warranty_end_date: string | null;
    rtm_due_date: string | null;
    created_at: string;
  };
  plates: {
    plate: string;
    valid_from: string;
    valid_to: string | null;
    is_active: boolean;
  }[];
  ownership: {
    currentPrimaryOwner: {
      party_id: string;
      party_name: string;
      id_number: string | null;
      id_type: string | null;
      phone: string | null;
      email: string | null;
      is_company: boolean;
      share_pct: number;
      valid_from: string;
    } | null;
    history: {
      id: string;
      party_id: string;
      role: string;
      is_primary: boolean;
      share_pct: number;
      valid_from: string;
      valid_to: string | null;
      party_name: string;
      id_number: string | null;
      id_type: string | null;
      phone: string | null;
      email: string | null;
      is_company: boolean;
    }[];
  };
  usageReadings: {
    id: string;
    mileage: number | null;
    operating_hours: number | null;
    reading_date: string;
    source: string;
    is_anomaly: boolean;
  }[];
  workOrders: {
    id: string;
    external_id: string;
    order_number: number;
    order_type: string;
    status: string;
    mileage: number | null;
    operating_hours: number | null;
    entered_at: string;
    promised_delivery_at: string | null;
    is_billed: boolean;
  }[];
  projection: {
    id: string;
    projected_date: string;
    projected_mileage: number | null;
    projection_method: string;
    confidence_level: string;
    calculation_basis: Record<string, unknown>;
    calculated_at: string;
  } | null;
  opportunities: {
    id: string;
    rule_id: string;
    rule_version: number;
    status: string;
    score: number;
    value_estimate: number | null;
    evidence: Record<string, unknown>;
    is_control_group: boolean;
    expires_at: string | null;
    created_at: string;
  }[];
}

export interface OpportunityItem {
  id: string;
  rule_id: string;
  rule_version: number;
  status: 'detected' | 'in_progress' | 'appointment_requested' | 'converted' | 'rejected' | 'expired';
  score: number;
  value_estimate: number | null;
  evidence: Record<string, unknown>;
  is_control_group: boolean;
  expires_at: string | null;
  converted_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  // Vehículo
  vehicle_id: string;
  vehicle_plate: string | null;
  vehicle_vin: string | null;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number | null;
  vehicle_type: string;
  vehicle_mileage: number | null;
  // Titular
  party_id: string;
  party_name: string;
  party_id_number: string | null;
  party_phone: string | null;
  party_email: string | null;
  party_is_company: boolean;
}

export interface OpportunitySummary {
  activeCount: number;
  estimatedPipelineValue: number;
  controlGroupCount: number;
  byRule: { ruleId: string; count: number }[];
}

export interface LeadItem {
  id: string;
  firstName: string;
  lastName?: string;
  fullName: string;
  documentType?: string;
  documentNumber?: string;
  email?: string;
  phone?: string;
  source: string;
  status: 'new' | 'assigned' | 'contacted' | 'qualified' | 'converted' | 'discarded' | 'duplicate';
  discardReason?: string;
  assignedTo?: string;
  partyId?: string;
  interestedVehicleModel?: string;
  notes?: string;
  slaDueAt?: string;
  firstContactedAt?: string;
  isSlaBreached: boolean;
  createdAt: string;
}

export interface PipelineStageItem {
  id: string;
  code: string;
  name: string;
  orderIndex: number;
  probabilityPct: number;
  isWon: boolean;
  isLost: boolean;
}

export interface PipelineItem {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStageItem[];
}

export interface DealItem {
  id: string;
  title: string;
  pipelineId: string;
  stageId: string;
  partyId: string;
  customerName: string;
  customerPhone: string;
  leadId?: string;
  vehicleId?: string;
  vehicleDescription?: string;
  vehiclePlate?: string;
  tradeInVehicleId?: string;
  tradeInDescription?: string;
  assignedTo?: string;
  estimatedValue: number;
  currency: string;
  status: 'open' | 'won' | 'lost' | 'abandoned';
  lossReason?: string;
  expectedCloseDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteItemDto {
  id: string;
  concept: string;
  unitPrice: number;
  quantity: number;
  taxPct: number;
}

export interface QuoteDto {
  id: string;
  quoteNumber: string;
  currentVersion: number;
  status: string;
  latestVersion?: {
    versionNumber: number;
    basePrice: number;
    discountAmount: number;
    taxesAmount: number;
    tradeInAllowance: number;
    netAmount: number;
    validUntil: string;
    items: QuoteItemDto[];
  } | null;
  versions: {
    versionNumber: number;
    netAmount: number;
    validUntil: string;
  }[];
}

export interface SaleItem {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleDescription: string;
  vehicleVin?: string;
  customerPartyId: string;
  customerName: string;
  dealId?: string;
  quoteId?: string;
  externalOrderNumber?: string;
  externalInvoiceNumber?: string;
  saleAmount: number;
  saleDate: string;
  deliveryDate?: string;
  status: string;
  reconciledAt: string;
}

export interface MetricValueDto {
  value: number;
  unit: string;
  formatted: string;
  sampleSize?: number;
}

export interface MetricBreakdownDto {
  dimension: string;
  key: string;
  label: string;
  value: number;
  formatted: string;
  percentage?: number;
  count?: number;
}

export interface MetricResultDto {
  kpiCode: string;
  kpiName: string;
  formula: string;
  category: string;
  currentValue: MetricValueDto;
  previousValue?: MetricValueDto;
  changePct?: number;
  breakdowns?: MetricBreakdownDto[];
  calculatedAt: string;
  explanation: string;
}

export interface ExecutiveDashboardDto {
  vehicleRetention: MetricResultDto;
  workshopReturn: MetricResultDto;
  opportunityConversion: MetricResultDto;
  controlGroupLift: MetricResultDto;
  leadSlaCompliance: MetricResultDto;
  aftersalesRevenue: MetricResultDto;
}

export interface KpiDefinitionDto {
  code: string;
  name: string;
  description: string;
  formula: string;
  category: string;
  unit: string;
  version: number;
}

export interface KpiExplanationDto {
  code: string;
  name: string;
  description: string;
  formula: string;
  category: string;
  unit: string;
  businessInterpretation: string;
}

export interface AiToolMetadataDto {
  name: string;
  description: string;
  autonomyLevel: number; // 0: Read, 1: Write Reversible, 2: Requires Approval, 3: Prohibited
  parameters: {
    name: string;
    type: string;
    description: string;
    required?: boolean;
  }[];
}

export interface AiProposalDto {
  requiresApproval?: boolean;
  proposalType: string;
  waMeUrl?: string;
  phone?: string;
  recipientName?: string;
  messageBody?: string;
  plate?: string;
  preferredDate?: string;
  serviceType?: string;
  actionPrompt?: string;
}

export interface AiToolExecutionDto {
  toolName: string;
  autonomyLevel: number;
  status: string;
  data?: any;
  proposal?: AiProposalDto;
  executionId?: string;
}

export interface CopilotChatResponseDto {
  response: string;
  role: string;
  toolExecutions: AiToolExecutionDto[];
  pendingApprovals: {
    executionId: string;
    toolName: string;
    proposal: AiProposalDto;
    message: string;
  }[];
}

export interface CopilotMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  toolExecutions?: AiToolExecutionDto[];
  pendingApprovals?: {
    executionId: string;
    toolName: string;
    proposal: AiProposalDto;
    message: string;
  }[];
  timestamp: string;
}

