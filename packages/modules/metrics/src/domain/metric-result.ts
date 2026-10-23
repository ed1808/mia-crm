import type { KpiCategory, KpiUnit } from './kpi-definition';
import type { MetricDimension } from './metric-query';

export interface MetricValue {
  value: number;
  unit: KpiUnit;
  formatted: string;
  sampleSize?: number;
}

export interface MetricDimensionBreakdown {
  dimension: MetricDimension;
  key: string;
  label: string;
  value: number;
  formatted: string;
  percentage?: number;
  count?: number;
}

export interface MetricResult {
  kpiCode: string;
  kpiName: string;
  formula: string;
  category: KpiCategory;
  currentValue: MetricValue;
  previousValue?: MetricValue;
  changePct?: number;
  breakdowns?: MetricDimensionBreakdown[];
  calculatedAt: Date;
  explanation: string;
}

export function formatMetricValue(value: number, unit: KpiUnit): string {
  if (unit === 'percentage') {
    return `${value.toFixed(1)}%`;
  }
  if (unit === 'currency_cop') {
    return `$${Math.round(value).toLocaleString('es-CO')} COP`;
  }
  if (unit === 'days') {
    return `${value.toFixed(0)} días`;
  }
  if (unit === 'hours') {
    return `${value.toFixed(0)} horas`;
  }
  return value.toLocaleString('es-CO');
}
