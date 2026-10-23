export type MetricDimension =
  | 'make'
  | 'model'
  | 'vehicle_type'
  | 'branch'
  | 'cohort_year'
  | 'status'
  | 'is_control_group';

export type MetricPeriod = '12m' | '6m' | '30d' | 'year_to_date';

export interface MetricFilter {
  make?: string;
  vehicleType?: string;
  branchId?: string;
  isControlGroup?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface MetricQuery {
  kpiCode: string;
  dimensions?: MetricDimension[];
  filters?: MetricFilter;
  period?: MetricPeriod;
}
