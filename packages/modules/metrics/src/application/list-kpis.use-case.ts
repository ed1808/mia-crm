import type { MetricsRepository } from '../domain/metrics-repository';
import type { KpiDefinition } from '../domain/kpi-definition';

export class ListKpiDefinitionsUseCase {
  constructor(private readonly repo: MetricsRepository) {}

  async execute(): Promise<KpiDefinition[]> {
    await this.repo.ensureKpiCatalog();
    return await this.repo.getKpiDefinitions();
  }
}
