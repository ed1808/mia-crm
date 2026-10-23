// Public API for @mia-crm/module-metrics
// Layer 4 strictly controls what is visible outside this bounded context

// Domain Entities, Types & Constants
export {
  KpiDefinition,
  type KpiDefinitionProps,
  type KpiCategory,
  type KpiUnit,
  GOVERNED_AUTOMOTIVE_KPIS,
} from './domain/kpi-definition';

export type {
  MetricDimension,
  MetricPeriod,
  MetricFilter,
  MetricQuery,
} from './domain/metric-query';

export {
  formatMetricValue,
  type MetricValue,
  type MetricDimensionBreakdown,
  type MetricResult,
} from './domain/metric-result';

export type {
  ExecutiveDashboardData,
  MetricsRepository,
} from './domain/metrics-repository';

// Application Use Cases
export { QueryMetricUseCase } from './application/query-metric.use-case';
export { ListKpiDefinitionsUseCase } from './application/list-kpis.use-case';
export { ExplainMetricUseCase, type KpiExplanation } from './application/explain-metric.use-case';

// Infrastructure Concrete Repository
export { BunSqlMetricsRepository } from './infrastructure/bun-sql-metrics-repository';
