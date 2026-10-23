import type { KpiDefinition } from './kpi-definition';
import type { MetricDimension, MetricFilter } from './metric-query';
import type { MetricResult } from './metric-result';

export interface ExecutiveDashboardData {
  vehicleRetention: MetricResult;
  workshopReturn: MetricResult;
  opportunityConversion: MetricResult;
  controlGroupLift: MetricResult;
  leadSlaCompliance: MetricResult;
  aftersalesRevenue: MetricResult;
}

export interface MetricsRepository {
  getKpiDefinitions(): Promise<KpiDefinition[]>;
  getKpiDefinitionByCode(code: string): Promise<KpiDefinition | undefined>;
  ensureKpiCatalog(): Promise<void>;

  calculateVehicleRetention(filters?: MetricFilter, dimension?: MetricDimension): Promise<MetricResult>;
  calculateWorkshopReturn(filters?: MetricFilter, dimension?: MetricDimension): Promise<MetricResult>;
  calculateOpportunityConversion(filters?: MetricFilter, dimension?: MetricDimension): Promise<MetricResult>;
  calculateControlGroupLift(filters?: MetricFilter): Promise<MetricResult>;
  calculateLeadSlaCompliance(filters?: MetricFilter): Promise<MetricResult>;
  calculateAftersalesRevenue(filters?: MetricFilter, dimension?: MetricDimension): Promise<MetricResult>;

  getExecutiveDashboard(filters?: MetricFilter): Promise<ExecutiveDashboardData>;
}
