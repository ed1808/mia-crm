import { DomainError, Result } from '@mia-crm/kernel';
import type { MetricsRepository } from '../domain/metrics-repository';
import type { MetricQuery } from '../domain/metric-query';
import type { MetricResult } from '../domain/metric-result';

export class QueryMetricUseCase {
  constructor(private readonly repo: MetricsRepository) {}

  async execute(query: MetricQuery): Promise<Result<MetricResult, DomainError>> {
    const kpi = await this.repo.getKpiDefinitionByCode(query.kpiCode);
    if (!kpi) {
      return Result.fail(
        new DomainError(
          'INVALID_KPI_CODE',
          `El código de métrica '${query.kpiCode}' no está registrado en la capa semántica gobernada.`
        )
      );
    }

    const dimension = query.dimensions?.[0];
    let result: MetricResult;

    switch (query.kpiCode) {
      case 'vehicle_retention_rate':
        result = await this.repo.calculateVehicleRetention(query.filters, dimension);
        break;
      case 'workshop_return_rate':
        result = await this.repo.calculateWorkshopReturn(query.filters, dimension);
        break;
      case 'opportunity_conversion_rate':
        result = await this.repo.calculateOpportunityConversion(query.filters, dimension);
        break;
      case 'control_group_incremental_lift':
        result = await this.repo.calculateControlGroupLift(query.filters);
        break;
      case 'lead_first_response_sla_compliance':
        result = await this.repo.calculateLeadSlaCompliance(query.filters);
        break;
      case 'aftersales_revenue_per_vehicle':
        result = await this.repo.calculateAftersalesRevenue(query.filters, dimension);
        break;
      default:
        return Result.fail(
          new DomainError('UNSUPPORTED_KPI', `Cálculo no implementado para la métrica ${query.kpiCode}`)
        );
    }

    return Result.ok(result);
  }
}
