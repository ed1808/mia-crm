import { Entity } from '@mia-crm/kernel';

export type KpiCategory = 'retention' | 'aftersales' | 'commercial' | 'experimentation';
export type KpiUnit = 'percentage' | 'currency_cop' | 'count' | 'days' | 'hours';

export interface KpiDefinitionProps {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description: string;
  formula: string;
  category: KpiCategory;
  unit: KpiUnit;
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class KpiDefinition extends Entity<string> {
  constructor(public readonly props: KpiDefinitionProps) {
    super(props.id);
  }

  get code(): string {
    return this.props.code;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string {
    return this.props.description;
  }
  get formula(): string {
    return this.props.formula;
  }
  get category(): KpiCategory {
    return this.props.category;
  }
  get unit(): KpiUnit {
    return this.props.unit;
  }
  get version(): number {
    return this.props.version;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
}

/**
 * Catálogo Canónico de Métricas y KPIs Gobernados de MIA CRM (Decisión D-13, D-16, D-27, D-39)
 */
export const GOVERNED_AUTOMOTIVE_KPIS: Omit<KpiDefinitionProps, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>[] = [
  {
    code: 'vehicle_retention_rate',
    name: 'Tasa de Retención del Vehículo (D-13)',
    description:
      'Porcentaje del parque atribuible (vendido por el concesionario o atendido en los últimos 24 meses) que ha tenido al menos 1 servicio facturado o de garantía en los últimos 12 meses. Se analiza por cohortes de año de venta.',
    formula: '(vehiculos_con_servicio_ultimos_12m / parque_atribuible_activo) * 100',
    category: 'retention',
    unit: 'percentage',
    version: 1,
    isActive: true,
  },
  {
    code: 'workshop_return_rate',
    name: 'Tasa de Retorno al Taller',
    description:
      'Porcentaje de vehículos con mantenimiento proyectado que efectivamente ingresan al taller dentro de la ventana de tolerancia (±30 días o ±1.000 km).',
    formula: '(vehiculos_retornados_en_ventana / vehiculos_proyectados_a_vencer) * 100',
    category: 'aftersales',
    unit: 'percentage',
    version: 1,
    isActive: true,
  },
  {
    code: 'opportunity_conversion_rate',
    name: 'Tasa de Conversión de Oportunidades Posventa',
    description:
      'Porcentaje de oportunidades predictivas generadas por el motor de reglas que culminan en una orden de taller atendida y facturada.',
    formula: '(oportunidades_convertidas_en_ot / oportunidades_intervenidas_totales) * 100',
    category: 'aftersales',
    unit: 'percentage',
    version: 1,
    isActive: true,
  },
  {
    code: 'control_group_incremental_lift',
    name: 'Lift Incremental del Grupo de Control (D-39)',
    description:
      'Diferencia porcentual de retorno y facturación entre los vehículos con oportunidades gestionadas proactivamente frente al 15% del Grupo de Control no intervenido.',
    formula: 'tasa_retorno_intervenidos - tasa_retorno_grupo_control',
    category: 'experimentation',
    unit: 'percentage',
    version: 1,
    isActive: true,
  },
  {
    code: 'lead_first_response_sla_compliance',
    name: 'Cumplimiento de SLA de Primera Respuesta',
    description:
      'Porcentaje de prospectos comerciales (leads) que reciben el primer contacto por llamada o WhatsApp antes de vencer el SLA objetivo (30 minutos).',
    formula: '(leads_contactados_dentro_de_sla / leads_totales_gestionados) * 100',
    category: 'commercial',
    unit: 'percentage',
    version: 1,
    isActive: true,
  },
  {
    code: 'aftersales_revenue_per_vehicle',
    name: 'Ingreso Promedio de Posventa por Vehículo Activo',
    description:
      'Monto facturado en pesos colombianos (COP) en mano de obra y repuestos en el taller dividido por el número total de vehículos atendidos.',
    formula: 'total_facturado_taller_cop / vehiculos_atendidos_periodo',
    category: 'aftersales',
    unit: 'currency_cop',
    version: 1,
    isActive: true,
  },
];
