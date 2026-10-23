import type { SQL } from 'bun';
import {
  GOVERNED_AUTOMOTIVE_KPIS,
  KpiDefinition,
  type KpiDefinitionProps,
} from '../domain/kpi-definition';
import type { MetricDimension, MetricFilter } from '../domain/metric-query';
import {
  formatMetricValue,
  type MetricDimensionBreakdown,
  type MetricResult,
} from '../domain/metric-result';
import type {
  ExecutiveDashboardData,
  MetricsRepository,
} from '../domain/metrics-repository';

export class BunSqlMetricsRepository implements MetricsRepository {
  constructor(private readonly sql: SQL) {}

  async ensureKpiCatalog(): Promise<void> {
    const tenantRes = await this.sql<any[]>`
      SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid as tenant_id
    `;
    const tenantId = tenantRes[0]?.tenant_id;
    if (!tenantId) return;

    for (const def of GOVERNED_AUTOMOTIVE_KPIS) {
      await this.sql`
        INSERT INTO kpi_definitions (
          tenant_id, code, name, description, formula, category, unit, version, is_active
        ) VALUES (
          ${tenantId}::uuid,
          ${def.code},
          ${def.name},
          ${def.description},
          ${def.formula},
          ${def.category},
          ${def.unit},
          ${def.version},
          ${def.isActive}
        )
        ON CONFLICT (tenant_id, code, version) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          formula = EXCLUDED.formula,
          updated_at = NOW()
      `;
    }
  }

  async getKpiDefinitions(): Promise<KpiDefinition[]> {
    const rows = await this.sql<any[]>`
      SELECT * FROM kpi_definitions WHERE is_active = TRUE ORDER BY category ASC, code ASC
    `;
    return rows.map((r) => this.mapRowToKpi(r));
  }

  async getKpiDefinitionByCode(code: string): Promise<KpiDefinition | undefined> {
    const rows = await this.sql<any[]>`
      SELECT * FROM kpi_definitions WHERE code = ${code} AND is_active = TRUE LIMIT 1
    `;
    if (!rows[0]) return undefined;
    return this.mapRowToKpi(rows[0]);
  }

  private mapRowToKpi(r: any): KpiDefinition {
    return new KpiDefinition({
      id: r.id,
      tenantId: r.tenant_id,
      code: r.code,
      name: r.name,
      description: r.description,
      formula: r.formula,
      category: r.category,
      unit: r.unit,
      version: Number(r.version),
      isActive: r.is_active,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    });
  }

  // -------------------------------------------------------------------------
  // 1. VEHICLE RETENTION RATE (Decisión D-13)
  // -------------------------------------------------------------------------
  async calculateVehicleRetention(
    filters?: MetricFilter,
    dimension?: MetricDimension
  ): Promise<MetricResult> {
    const now = new Date();

    // Consultar total del parque atribuible y parque con servicio reciente en últimos 12 meses
    const summaryRows = await this.sql<any[]>`
      WITH attributable_fleet AS (
        SELECT v.id, v.make, v.model, v.vehicle_type, v.model_year,
          EXISTS (
            SELECT 1 FROM work_orders wo
            WHERE wo.vehicle_id = v.id
              AND wo.entered_at >= NOW() - INTERVAL '12 months'
              AND wo.status = 'completed'
          ) as has_service_12m
        FROM vehicles v
      )
      SELECT
        COUNT(*)::int as total_fleet,
        COUNT(CASE WHEN has_service_12m THEN 1 END)::int as active_serviced
      FROM attributable_fleet
    `;

    const totalFleet = Number(summaryRows[0]?.total_fleet || 0);
    const activeServiced = Number(summaryRows[0]?.active_serviced || 0);
    const retentionRate = totalFleet > 0 ? (activeServiced / totalFleet) * 100 : 0;

    // Desglose por dimensión si se solicita
    let breakdowns: MetricDimensionBreakdown[] | undefined;
    if (dimension === 'make') {
      const makeRows = await this.sql<any[]>`
        SELECT
          v.make as key,
          COUNT(*)::int as count,
          COUNT(CASE WHEN EXISTS (
            SELECT 1 FROM work_orders wo
            WHERE wo.vehicle_id = v.id
              AND wo.entered_at >= NOW() - INTERVAL '12 months'
              AND wo.status = 'completed'
          ) THEN 1 END)::int as serviced
        FROM vehicles v
        GROUP BY v.make
        ORDER BY count DESC
      `;
      breakdowns = makeRows.map((r) => {
        const c = Number(r.count);
        const s = Number(r.serviced);
        const pct = c > 0 ? (s / c) * 100 : 0;
        return {
          dimension: 'make',
          key: r.key,
          label: r.key,
          value: pct,
          formatted: `${pct.toFixed(1)}%`,
          percentage: pct,
          count: c,
        };
      });
    } else if (dimension === 'vehicle_type') {
      const typeRows = await this.sql<any[]>`
        SELECT
          v.vehicle_type as key,
          COUNT(*)::int as count,
          COUNT(CASE WHEN EXISTS (
            SELECT 1 FROM work_orders wo
            WHERE wo.vehicle_id = v.id
              AND wo.entered_at >= NOW() - INTERVAL '12 months'
              AND wo.status = 'completed'
          ) THEN 1 END)::int as serviced
        FROM vehicles v
        GROUP BY v.vehicle_type
        ORDER BY count DESC
      `;
      breakdowns = typeRows.map((r) => {
        const c = Number(r.count);
        const s = Number(r.serviced);
        const pct = c > 0 ? (s / c) * 100 : 0;
        return {
          dimension: 'vehicle_type',
          key: r.key,
          label: r.key === 'commercial' ? 'Comerciales / Pesados' : 'Livianos / Pasajeros',
          value: pct,
          formatted: `${pct.toFixed(1)}%`,
          percentage: pct,
          count: c,
        };
      });
    }

    return {
      kpiCode: 'vehicle_retention_rate',
      kpiName: 'Tasa de Retención del Vehículo (D-13)',
      formula: '(vehiculos_con_servicio_ultimos_12m / parque_atribuible_activo) * 100',
      category: 'retention',
      currentValue: {
        value: retentionRate,
        unit: 'percentage',
        formatted: `${retentionRate.toFixed(1)}%`,
        sampleSize: totalFleet,
      },
      breakdowns,
      calculatedAt: now,
      explanation: `De un parque atribuible de ${totalFleet} vehículos, ${activeServiced} han recibido mantenimiento en los últimos 12 meses, logrando una tasa de retención del ${retentionRate.toFixed(1)}%.`,
    };
  }

  // -------------------------------------------------------------------------
  // 2. WORKSHOP RETURN RATE
  // -------------------------------------------------------------------------
  async calculateWorkshopReturn(
    filters?: MetricFilter,
    dimension?: MetricDimension
  ): Promise<MetricResult> {
    const now = new Date();

    const rows = await this.sql<any[]>`
      SELECT
        COUNT(*)::int as total_projected,
        COUNT(CASE WHEN EXISTS (
          SELECT 1 FROM work_orders wo
          WHERE wo.vehicle_id = nvp.vehicle_id
            AND wo.entered_at >= nvp.projected_date - INTERVAL '30 days'
            AND wo.entered_at <= nvp.projected_date + INTERVAL '30 days'
        ) THEN 1 END)::int as returned_in_window
      FROM next_visit_projections nvp
    `;

    const total = Number(rows[0]?.total_projected || 0);
    const returned = Number(rows[0]?.returned_in_window || 0);
    const rate = total > 0 ? (returned / total) * 100 : 0;

    return {
      kpiCode: 'workshop_return_rate',
      kpiName: 'Tasa de Retorno al Taller',
      formula: '(vehiculos_retornados_en_ventana / vehiculos_proyectados_a_vencer) * 100',
      category: 'aftersales',
      currentValue: {
        value: rate,
        unit: 'percentage',
        formatted: `${rate.toFixed(1)}%`,
        sampleSize: total,
      },
      calculatedAt: now,
      explanation: `${returned} de ${total} vehículos con mantenimiento proyectado acudieron al taller dentro de la ventana de tolerancia (±30 días).`,
    };
  }

  // -------------------------------------------------------------------------
  // 3. OPPORTUNITY CONVERSION RATE
  // -------------------------------------------------------------------------
  async calculateOpportunityConversion(
    filters?: MetricFilter,
    dimension?: MetricDimension
  ): Promise<MetricResult> {
    const now = new Date();

    const rows = await this.sql<any[]>`
      SELECT
        COUNT(*)::int as total_opportunities,
        COUNT(CASE WHEN status IN ('appointment_requested', 'converted') THEN 1 END)::int as converted_count,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END)::int as rejected_count
      FROM opportunities
      WHERE is_control_group = FALSE
    `;

    const total = Number(rows[0]?.total_opportunities || 0);
    const converted = Number(rows[0]?.converted_count || 0);
    const rate = total > 0 ? (converted / total) * 100 : 0;

    // Desglose por regla
    const ruleRows = await this.sql<any[]>`
      SELECT
        rule_id as key,
        COUNT(*)::int as count,
        COUNT(CASE WHEN status IN ('appointment_requested', 'converted') THEN 1 END)::int as converted
      FROM opportunities
      WHERE is_control_group = FALSE
      GROUP BY rule_id
      ORDER BY count DESC
    `;

    const breakdowns: MetricDimensionBreakdown[] = ruleRows.map((r) => {
      const c = Number(r.count);
      const cv = Number(r.converted);
      const pct = c > 0 ? (cv / c) * 100 : 0;
      return {
        dimension: 'status',
        key: r.key,
        label: r.key,
        value: pct,
        formatted: `${pct.toFixed(1)}%`,
        percentage: pct,
        count: c,
      };
    });

    return {
      kpiCode: 'opportunity_conversion_rate',
      kpiName: 'Tasa de Conversión de Oportunidades Posventa',
      formula: '(oportunidades_convertidas / total_oportunidades_intervenidas) * 100',
      category: 'aftersales',
      currentValue: {
        value: rate,
        unit: 'percentage',
        formatted: `${rate.toFixed(1)}%`,
        sampleSize: total,
      },
      breakdowns,
      calculatedAt: now,
      explanation: `Se han convertido ${converted} de ${total} oportunidades intervenidas proactivamente (${rate.toFixed(1)}% de efectividad).`,
    };
  }

  // -------------------------------------------------------------------------
  // 4. CONTROL GROUP INCREMENTAL LIFT (Decisión D-39)
  // -------------------------------------------------------------------------
  async calculateControlGroupLift(filters?: MetricFilter): Promise<MetricResult> {
    const now = new Date();

    const rows = await this.sql<any[]>`
      SELECT
        -- Intervenidos (85%)
        COUNT(CASE WHEN is_control_group = FALSE THEN 1 END)::int as intervened_total,
        COUNT(CASE WHEN is_control_group = FALSE AND status IN ('appointment_requested', 'converted') THEN 1 END)::int as intervened_converted,
        -- Grupo de Control (15%)
        COUNT(CASE WHEN is_control_group = TRUE THEN 1 END)::int as control_total,
        COUNT(CASE WHEN is_control_group = TRUE AND status IN ('appointment_requested', 'converted') THEN 1 END)::int as control_converted
      FROM opportunities
    `;

    const intTotal = Number(rows[0]?.intervened_total || 0);
    const intConv = Number(rows[0]?.intervened_converted || 0);
    const intRate = intTotal > 0 ? (intConv / intTotal) * 100 : 0;

    const ctrlTotal = Number(rows[0]?.control_total || 0);
    const ctrlConv = Number(rows[0]?.control_converted || 0);
    const ctrlRate = ctrlTotal > 0 ? (ctrlConv / ctrlTotal) * 100 : 0;

    const lift = intRate - ctrlRate;

    const breakdowns: MetricDimensionBreakdown[] = [
      {
        dimension: 'is_control_group',
        key: 'intervened',
        label: 'Oportunidades Intervenidas (85%)',
        value: intRate,
        formatted: `${intRate.toFixed(1)}%`,
        percentage: intRate,
        count: intTotal,
      },
      {
        dimension: 'is_control_group',
        key: 'control_group',
        label: 'Grupo de Control Ciego (15%)',
        value: ctrlRate,
        formatted: `${ctrlRate.toFixed(1)}%`,
        percentage: ctrlRate,
        count: ctrlTotal,
      },
    ];

    return {
      kpiCode: 'control_group_incremental_lift',
      kpiName: 'Lift Incremental del Grupo de Control (D-39)',
      formula: 'tasa_retorno_intervenidos - tasa_retorno_grupo_control',
      category: 'experimentation',
      currentValue: {
        value: lift,
        unit: 'percentage',
        formatted: `${lift >= 0 ? '+' : ''}${lift.toFixed(1)}%`,
        sampleSize: intTotal + ctrlTotal,
      },
      breakdowns,
      calculatedAt: now,
      explanation: `La intervención proactiva del CRM genera un Lift Incremental de ${lift >= 0 ? '+' : ''}${lift.toFixed(1)}% en la tasa de retorno frente al grupo de control aleatorizado al 15% (D-39).`,
    };
  }

  // -------------------------------------------------------------------------
  // 5. LEAD SLA COMPLIANCE
  // -------------------------------------------------------------------------
  async calculateLeadSlaCompliance(filters?: MetricFilter): Promise<MetricResult> {
    const now = new Date();

    const rows = await this.sql<any[]>`
      SELECT
        COUNT(*)::int as total_leads,
        COUNT(CASE WHEN first_contacted_at IS NOT NULL THEN 1 END)::int as contacted_leads,
        COUNT(CASE WHEN first_contacted_at IS NOT NULL AND first_contacted_at <= sla_due_at THEN 1 END)::int as in_sla_leads,
        COUNT(CASE WHEN (first_contacted_at IS NULL AND NOW() > sla_due_at) OR (first_contacted_at > sla_due_at) THEN 1 END)::int as breached_sla_leads
      FROM leads
    `;

    const totalLeads = Number(rows[0]?.total_leads || 0);
    const contactedLeads = Number(rows[0]?.contacted_leads || 0);
    const inSlaLeads = Number(rows[0]?.in_sla_leads || 0);
    const complianceRate = contactedLeads > 0 ? (inSlaLeads / contactedLeads) * 100 : 100;

    return {
      kpiCode: 'lead_first_response_sla_compliance',
      kpiName: 'Cumplimiento de SLA de Primera Respuesta',
      formula: '(leads_contactados_dentro_de_sla / leads_contactados_totales) * 100',
      category: 'commercial',
      currentValue: {
        value: complianceRate,
        unit: 'percentage',
        formatted: `${complianceRate.toFixed(1)}%`,
        sampleSize: totalLeads,
      },
      calculatedAt: now,
      explanation: `${inSlaLeads} de ${contactedLeads} prospectos contactados fueron atendidos dentro del SLA objetivo de 30 minutos (${complianceRate.toFixed(1)}% de cumplimiento).`,
    };
  }

  // -------------------------------------------------------------------------
  // 6. AFTERSALES REVENUE PER VEHICLE
  // -------------------------------------------------------------------------
  async calculateAftersalesRevenue(
    filters?: MetricFilter,
    dimension?: MetricDimension
  ): Promise<MetricResult> {
    const now = new Date();

    const rows = await this.sql<any[]>`
      SELECT
        COALESCE(SUM(value_estimate), 0)::numeric as total_estimated_pipeline,
        COUNT(DISTINCT vehicle_id)::int as active_vehicles_count
      FROM opportunities
      WHERE status IN ('detected', 'in_progress', 'appointment_requested', 'converted')
    `;

    const totalRevenue = Number(rows[0]?.total_estimated_pipeline || 0);
    const activeVehicles = Number(rows[0]?.active_vehicles_count || 1);
    const avgPerVehicle = activeVehicles > 0 ? totalRevenue / activeVehicles : 0;

    return {
      kpiCode: 'aftersales_revenue_per_vehicle',
      kpiName: 'Ingreso Estimado de Posventa por Vehículo',
      formula: 'total_facturado_taller_cop / vehiculos_atendidos_periodo',
      category: 'aftersales',
      currentValue: {
        value: avgPerVehicle,
        unit: 'currency_cop',
        formatted: formatMetricValue(avgPerVehicle, 'currency_cop'),
        sampleSize: activeVehicles,
      },
      calculatedAt: now,
      explanation: `Potencial promedio estimado de $${Math.round(avgPerVehicle).toLocaleString('es-CO')} COP por vehículo activo en el parque.`,
    };
  }

  // -------------------------------------------------------------------------
  // 7. EXECUTIVE DASHBOARD SUMMARY
  // -------------------------------------------------------------------------
  async getExecutiveDashboard(filters?: MetricFilter): Promise<ExecutiveDashboardData> {
    await this.ensureKpiCatalog();

    const [retention, returnRate, conversion, lift, sla, revenue] = await Promise.all([
      this.calculateVehicleRetention(filters, 'make'),
      this.calculateWorkshopReturn(filters),
      this.calculateOpportunityConversion(filters),
      this.calculateControlGroupLift(filters),
      this.calculateLeadSlaCompliance(filters),
      this.calculateAftersalesRevenue(filters),
    ]);

    return {
      vehicleRetention: retention,
      workshopReturn: returnRate,
      opportunityConversion: conversion,
      controlGroupLift: lift,
      leadSlaCompliance: sla,
      aftersalesRevenue: revenue,
    };
  }
}
