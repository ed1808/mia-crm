// packages/modules/ai/src/infrastructure/tools/governed-metrics-tools.ts
import type { SQL } from 'bun';
import { Result } from '@mia-crm/kernel';
import { withTenant } from '@mia-crm/db';
import {
  BunSqlMetricsRepository,
  QueryMetricUseCase,
  ExplainMetricUseCase,
} from '@mia-crm/module-metrics';
import { AutonomyLevel } from '../../domain/autonomy';
import type { IAiTool, ToolExecutionContext, ToolParameterDefinition } from '../../domain/ai-tool';

export class QueryMetricTool implements IAiTool {
  readonly name = 'query_metric';
  readonly description =
    'Consulta un KPI automotriz gobernado en la capa semántica con cálculo trazable bajo RLS (Decisión D-16). NUNCA inventa cifras.';
  readonly autonomyLevel = AutonomyLevel.LEVEL_0_READ_ONLY;
  readonly parameters: ToolParameterDefinition[] = [
    {
      name: 'kpiCode',
      type: 'string',
      description:
        'Código canónico del KPI: vehicle_retention_rate, workshop_return_rate, opportunity_conversion_rate, control_group_incremental_lift, lead_first_response_sla_compliance, aftersales_revenue_per_vehicle',
      required: true,
    },
    {
      name: 'dimension',
      type: 'string',
      description: 'Dimensión opcional de desglose: make, vehicle_type, branch, cohort_year',
      required: false,
    },
    {
      name: 'filterValue',
      type: 'string',
      description: 'Filtro específico para la dimensión seleccionada',
      required: false,
    },
  ];

  constructor(private readonly sql: SQL) {}

  async execute(
    ctx: ToolExecutionContext,
    params: { kpiCode: string; dimension?: any; filterValue?: string },
  ): Promise<Result<any, any>> {
    if (!params.kpiCode) {
      return Result.fail('El parámetro kpiCode es obligatorio');
    }

    return await withTenant(this.sql, { tenantId: ctx.tenantId }, async (tx) => {
      const repo = new BunSqlMetricsRepository(tx);
      const queryUc = new QueryMetricUseCase(repo);
      const res = await queryUc.execute({
        kpiCode: params.kpiCode,
        dimensions: params.dimension ? [params.dimension] : undefined,
        filters: params.filterValue
          ? [{ dimension: params.dimension, operator: 'eq', value: params.filterValue }]
          : undefined,
      });

      if (!res.ok) {
        return Result.fail(res.error.message);
      }

      return Result.ok(res.value);
    });
  }
}

export class ExplainMetricTool implements IAiTool {
  readonly name = 'explain_metric';
  readonly description =
    'Explica en lenguaje de negocio colombiano la fórmula matemática y la justificación técnica de un KPI gobernado (Decisión D-16).';
  readonly autonomyLevel = AutonomyLevel.LEVEL_0_READ_ONLY;
  readonly parameters: ToolParameterDefinition[] = [
    {
      name: 'kpiCode',
      type: 'string',
      description: 'Código canónico del KPI a explicar',
      required: true,
    },
  ];

  constructor(private readonly sql: SQL) {}

  async execute(ctx: ToolExecutionContext, params: { kpiCode: string }): Promise<Result<any, any>> {
    if (!params.kpiCode) {
      return Result.fail('El parámetro kpiCode es obligatorio');
    }

    return await withTenant(this.sql, { tenantId: ctx.tenantId }, async (tx) => {
      const repo = new BunSqlMetricsRepository(tx);
      const explainUc = new ExplainMetricUseCase(repo);
      const res = await explainUc.execute(params.kpiCode);

      if (!res.ok) {
        return Result.fail(res.error.message);
      }

      return Result.ok(res.value);
    });
  }
}
