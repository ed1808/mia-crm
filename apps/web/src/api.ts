import type {
  VehicleSummary,
  Vehicle360Data,
  OpportunityItem,
  OpportunitySummary,
} from './types';

const API_BASE = '/api/v1';

export async function fetchVehicles(search?: string, vehicleType?: string): Promise<VehicleSummary[]> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (vehicleType) params.set('vehicleType', vehicleType);

  const res = await fetch(`${API_BASE}/vehicles?${params.toString()}`);
  if (!res.ok) throw new Error('Error al consultar vehículos');
  const json = await res.json();
  return json.data;
}

export async function fetchVehicle360(vehicleId: string): Promise<Vehicle360Data> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}`);
  if (!res.ok) throw new Error('Error al consultar Vehicle 360');
  const json = await res.json();
  return json.data;
}

export async function fetchOpportunities(filters?: {
  status?: string;
  ruleId?: string;
  isControlGroup?: boolean;
}): Promise<OpportunityItem[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.ruleId) params.set('ruleId', filters.ruleId);
  if (filters?.isControlGroup !== undefined) {
    params.set('isControlGroup', String(filters.isControlGroup));
  }

  const res = await fetch(`${API_BASE}/opportunities?${params.toString()}`);
  if (!res.ok) throw new Error('Error al consultar oportunidades');
  const json = await res.json();
  return json.data;
}

export async function fetchOpportunitySummary(): Promise<OpportunitySummary> {
  const res = await fetch(`${API_BASE}/opportunities/summary`);
  if (!res.ok) throw new Error('Error al consultar métricas de oportunidades');
  const json = await res.json();
  return json.data;
}

export async function scheduleOpportunityAppointment(
  opportunityId: string,
  scheduledAt: string,
  notes?: string,
  serviceType?: string
): Promise<{ id: string; scheduled_at: string; status: string; origin: string }> {
  const res = await fetch(`${API_BASE}/opportunities/${opportunityId}/appointment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduledAt, notes, serviceType }),
  });
  if (!res.ok) {
    let errorMsg = `Error ${res.status}: ${res.statusText}`;
    try {
      const errJson = await res.json();
      errorMsg = errJson.message || errJson.error || errorMsg;
    } catch {
      const rawText = await res.text().catch(() => '');
      if (rawText) errorMsg = rawText;
    }
    throw new Error(errorMsg);
  }
  const json = await res.json();
  return json.data;
}

export async function updateOpportunityStatus(
  opportunityId: string,
  action: 'start_progress' | 'request_appointment' | 'convert' | 'reject' | 'expire',
  rejectionReason?: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/opportunities/${opportunityId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, rejectionReason }),
  });
  if (!res.ok) {
    let errorMsg = `Error ${res.status}: ${res.statusText}`;
    try {
      const errJson = await res.json();
      errorMsg = errJson.message || errJson.error || errorMsg;
    } catch {
      const rawText = await res.text().catch(() => '');
      if (rawText) errorMsg = rawText;
    }
    throw new Error(errorMsg);
  }
}

// ----------------------------------------------------
// COMERCIAL: PIPELINES, LEADS, DEALS, QUOTES, SALES
// ----------------------------------------------------

export async function fetchPipelines(): Promise<import('./types').PipelineItem[]> {
  const res = await fetch(`${API_BASE}/commercial/pipelines`);
  if (!res.ok) throw new Error('Error al consultar pipelines comerciales');
  const json = await res.json();
  return json.data;
}

export async function fetchLeads(status?: string): Promise<import('./types').LeadItem[]> {
  const url = status
    ? `${API_BASE}/commercial/leads?status=${encodeURIComponent(status)}`
    : `${API_BASE}/commercial/leads`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Error al consultar leads');
  const json = await res.json();
  return json.data;
}

export async function createLead(data: {
  firstName: string;
  lastName?: string;
  phone?: string;
  email?: string;
  source?: string;
  interestedVehicleModel?: string;
  notes?: string;
  slaMinutes?: number;
}): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/commercial/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al crear lead');
  }
  const json = await res.json();
  return json.data;
}

export async function contactLead(leadId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/commercial/leads/${leadId}/contact`, {
    method: 'PATCH',
  });
  if (!res.ok) throw new Error('Error al registrar contacto con el lead');
}

export async function convertLeadToDeal(
  leadId: string,
  data?: { pipelineId?: string; stageId?: string; dealTitle?: string; estimatedValue?: number }
): Promise<{ dealId: string }> {
  const res = await fetch(`${API_BASE}/commercial/leads/${leadId}/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data ?? {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al convertir lead');
  }
  const json = await res.json();
  return json.data;
}

export async function fetchDeals(pipelineId?: string): Promise<import('./types').DealItem[]> {
  const url = pipelineId
    ? `${API_BASE}/commercial/deals?pipelineId=${encodeURIComponent(pipelineId)}`
    : `${API_BASE}/commercial/deals`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Error al consultar oportunidades comerciales');
  const json = await res.json();
  return json.data;
}

export async function moveDealStage(
  dealId: string,
  newStageId: string,
  lossReason?: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/commercial/deals/${dealId}/stage`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newStageId, lossReason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al mover etapa de la oportunidad');
  }
}

export async function fetchDealQuotes(dealId: string): Promise<import('./types').QuoteDto[]> {
  const res = await fetch(`${API_BASE}/commercial/deals/${dealId}/quotes`);
  if (!res.ok) throw new Error('Error al consultar cotizaciones del negocio');
  const json = await res.json();
  return json.data;
}

export async function createQuote(
  dealId: string,
  quoteData: {
    quoteNumber?: string;
    items: import('./types').QuoteItemDto[];
    discountAmount?: number;
    tradeInAllowance?: number;
    paymentTerms?: string;
    validDays?: number;
    notes?: string;
  }
): Promise<{ id: string; quoteNumber: string; netAmount: number }> {
  const res = await fetch(`${API_BASE}/commercial/deals/${dealId}/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(quoteData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al generar cotización');
  }
  const json = await res.json();
  return json.data;
}

export async function fetchSales(): Promise<import('./types').SaleItem[]> {
  const res = await fetch(`${API_BASE}/commercial/sales`);
  if (!res.ok) throw new Error('Error al consultar ventas conciliadas');
  const json = await res.json();
  return json.data;
}

// ----------------------------------------------------
// SEMANTIC METRICS LAYER (Hito M6)
// ----------------------------------------------------

export async function fetchExecutiveDashboard(): Promise<import('./types').ExecutiveDashboardDto> {
  const res = await fetch(`${API_BASE}/metrics/dashboard`);
  if (!res.ok) throw new Error('Error al consultar panel ejecutivo de métricas');
  const json = await res.json();
  return json.data;
}

export async function fetchKpiDefinitions(): Promise<import('./types').KpiDefinitionDto[]> {
  const res = await fetch(`${API_BASE}/metrics/definitions`);
  if (!res.ok) throw new Error('Error al consultar definiciones de KPIs');
  const json = await res.json();
  return json.data;
}

export async function explainKpi(code: string): Promise<import('./types').KpiExplanationDto> {
  const res = await fetch(`${API_BASE}/metrics/explain/${code}`);
  if (!res.ok) throw new Error(`Error al consultar explicación de KPI ${code}`);
  const json = await res.json();
  return json.data;
}

export async function queryKpi(params: {
  kpi: string;
  dimension?: string;
  make?: string;
  vehicleType?: string;
}): Promise<import('./types').MetricResultDto> {
  const q = new URLSearchParams();
  q.set('kpi', params.kpi);
  if (params.dimension) q.set('dimension', params.dimension);
  if (params.make) q.set('make', params.make);
  if (params.vehicleType) q.set('vehicleType', params.vehicleType);

  const res = await fetch(`${API_BASE}/metrics/query?${q.toString()}`);
  if (!res.ok) throw new Error(`Error al consultar métrica ${params.kpi}`);
  const json = await res.json();
  return json.data;
}

// ----------------------------------------------------
// AUTONOMOUS AI COPILOT & TOOLS GATEWAY (Hito M7)
// ----------------------------------------------------

export async function chatWithCopilot(params: {
  role: string;
  message: string;
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
}): Promise<import('./types').CopilotChatResponseDto> {
  const res = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al comunicarse con Copiloto MIA');
  }
  const json = await res.json();
  return json.data;
}

export async function fetchAiTools(role = 'sales_advisor'): Promise<import('./types').AiToolMetadataDto[]> {
  const res = await fetch(`${API_BASE}/ai/tools?role=${encodeURIComponent(role)}`);
  if (!res.ok) throw new Error('Error al consultar herramientas del copiloto');
  const json = await res.json();
  return json.data;
}

export async function executeAiTool(params: {
  toolName: string;
  arguments: Record<string, any>;
  role?: string;
  taskType?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/ai/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error al ejecutar herramienta ${params.toolName}`);
  }
  const json = await res.json();
  return json.data;
}

export async function approveAiExecution(params: {
  executionId: string;
  action: 'approve' | 'reject';
  rejectionReason?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/ai/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al procesar aprobación');
  }
  const json = await res.json();
  return json.data;
}

export async function fetchPendingAiApprovals(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/ai/pending`);
  if (!res.ok) throw new Error('Error al consultar aprobaciones pendientes');
  const json = await res.json();
  return json.data;
}

export async function fetchAiHistory(limit = 20): Promise<any[]> {
  const res = await fetch(`${API_BASE}/ai/history?limit=${limit}`);
  if (!res.ok) throw new Error('Error al consultar historial de ejecuciones de IA');
  const json = await res.json();
  return json.data;
}

