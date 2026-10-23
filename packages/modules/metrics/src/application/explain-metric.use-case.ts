import { DomainError, Result } from '@mia-crm/kernel';
import type { MetricsRepository } from '../domain/metrics-repository';

export interface KpiExplanation {
  code: string;
  name: string;
  description: string;
  formula: string;
  category: string;
  unit: string;
  businessInterpretation: string;
}

export class ExplainMetricUseCase {
  constructor(private readonly repo: MetricsRepository) {}

  async execute(code: string): Promise<Result<KpiExplanation, DomainError>> {
    const kpi = await this.repo.getKpiDefinitionByCode(code);
    if (!kpi) {
      return Result.fail(
        new DomainError('KPI_NOT_FOUND', `Métrica con código '${code}' no encontrada.`)
      );
    }

    let interpretation = '';
    switch (code) {
      case 'vehicle_retention_rate':
        interpretation =
          'Indica la lealtad del cliente hacia el servicio oficial del concesionario. Un valor superior al 60% se considera óptimo en Colombia. Las caídas pronunciadas suelen ocurrir al finalizar la garantía (año 3 a 5).';
        break;
      case 'workshop_return_rate':
        interpretation =
          'Mide la puntualidad y adherencia de los clientes a los intervalos de mantenimiento preventivo proyectados. Permite anticipar la ocupación de bahías del taller.';
        break;
      case 'opportunity_conversion_rate':
        interpretation =
          'Mide la efectividad del equipo de asesores de servicio al contactar y convertir oportunidades predictivas detectadas por el sistema en órdenes de trabajo reales.';
        break;
      case 'control_group_incremental_lift':
        interpretation =
          'Demuestra el ROI real y la facturación incremental atribuible al uso del CRM frente a la inacción comercial (15% grupo de control).';
        break;
      case 'lead_first_response_sla_compliance':
        interpretation =
          'Evalúa la agilidad del equipo de ventas. Un primer contacto antes de 30 minutos incrementa la probabilidad de cierre en más de un 40%.';
        break;
      case 'aftersales_revenue_per_vehicle':
        interpretation =
          'Mide el valor del ciclo de vida del cliente en el taller (ticket promedio anual por vehículo activo en COP).';
        break;
      default:
        interpretation = kpi.description;
    }

    return Result.ok({
      code: kpi.code,
      name: kpi.name,
      description: kpi.description,
      formula: kpi.formula,
      category: kpi.category,
      unit: kpi.unit,
      businessInterpretation: interpretation,
    });
  }
}
