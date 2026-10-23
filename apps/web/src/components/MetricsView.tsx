import React, { useEffect, useState } from 'react';
import type {
  ExecutiveDashboardDto,
  KpiDefinitionDto,
  KpiExplanationDto,
  MetricResultDto,
} from '../types';
import {
  fetchExecutiveDashboard,
  fetchKpiDefinitions,
  explainKpi,
  queryKpi,
} from '../api';

export function MetricsView() {
  const [dashboard, setDashboard] = useState<ExecutiveDashboardDto | null>(null);
  const [kpiDefinitions, setKpiDefinitions] = useState<KpiDefinitionDto[]>([]);
  const [retentionBreakdown, setRetentionBreakdown] = useState<MetricResultDto | null>(null);
  const [retentionDimension, setRetentionDimension] = useState<'make' | 'vehicle_type'>('make');
  const [selectedExplanation, setSelectedExplanation] = useState<KpiExplanationDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  async function loadMetrics() {
    setLoading(true);
    try {
      const [dashData, kpiData, retentionData] = await Promise.all([
        fetchExecutiveDashboard(),
        fetchKpiDefinitions(),
        queryKpi({ kpi: 'vehicle_retention_rate', dimension: 'make' }),
      ]);
      setDashboard(dashData);
      setKpiDefinitions(kpiData);
      setRetentionBreakdown(retentionData);
    } catch (err) {
      console.error('Error cargando métricas gobernadas:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDimensionChange(dim: 'make' | 'vehicle_type') {
    setRetentionDimension(dim);
    try {
      const data = await queryKpi({ kpi: 'vehicle_retention_rate', dimension: dim });
      setRetentionBreakdown(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleExplainKpi(code: string) {
    try {
      const explanation = await explainKpi(code);
      setSelectedExplanation(explanation);
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>📊</div>
        Cargando Capa Semántica de Métricas y KPIs Gobernados...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header Banner */}
      <div style={bannerStyle}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '22px' }}>🏛️</span>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#f8fafc' }}>
              Capa Semántica & Gobernanza de Métricas
            </h2>
            <span style={governanceBadgeStyle}>Decisiones D-13, D-16, D-27, D-39</span>
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
            <strong>Cero cifras sin trazabilidad:</strong> Toda métrica para directores, jefes y agentes de IA
            proviene de fórmulas matemáticas gobernadas bajo Row-Level Security.
          </p>
        </div>
      </div>

      {/* 6 Executive Governed KPI Cards */}
      {dashboard && (
        <div style={kpiGridStyle}>
          {/* Card 1: Retención del Vehículo */}
          <div style={kpiCardStyle}>
            <div style={cardTopStyle}>
              <span style={kpiCategoryStyle}>RETENCIÓN • D-13</span>
              <button
                style={infoBtnStyle}
                onClick={() => handleExplainKpi('vehicle_retention_rate')}
                title="Ver fórmula e interpretación de negocio"
              >
                ℹ️
              </button>
            </div>
            <div style={kpiNameStyle}>{dashboard.vehicleRetention.kpiName}</div>
            <div style={{ ...kpiValueStyle, color: '#38bdf8' }}>
              {dashboard.vehicleRetention.currentValue.formatted}
            </div>
            <div style={kpiSubtextStyle}>
              {dashboard.vehicleRetention.explanation}
            </div>
            <div style={formulaBoxStyle}>
              <code>{dashboard.vehicleRetention.formula}</code>
            </div>
          </div>

          {/* Card 2: Lift Incremental Grupo de Control */}
          <div style={{ ...kpiCardStyle, borderColor: '#8b5cf6' }}>
            <div style={cardTopStyle}>
              <span style={{ ...kpiCategoryStyle, color: '#c084fc' }}>EXPERIMENTO A/B • D-39</span>
              <button
                style={infoBtnStyle}
                onClick={() => handleExplainKpi('control_group_incremental_lift')}
                title="Ver fórmula e interpretación de negocio"
              >
                ℹ️
              </button>
            </div>
            <div style={kpiNameStyle}>{dashboard.controlGroupLift.kpiName}</div>
            <div style={{ ...kpiValueStyle, color: '#a855f7' }}>
              {dashboard.controlGroupLift.currentValue.formatted}
            </div>
            <div style={kpiSubtextStyle}>
              {dashboard.controlGroupLift.explanation}
            </div>
            <div style={formulaBoxStyle}>
              <code>{dashboard.controlGroupLift.formula}</code>
            </div>
          </div>

          {/* Card 3: Tasa de Retorno al Taller */}
          <div style={kpiCardStyle}>
            <div style={cardTopStyle}>
              <span style={kpiCategoryStyle}>POSVENTA</span>
              <button
                style={infoBtnStyle}
                onClick={() => handleExplainKpi('workshop_return_rate')}
                title="Ver fórmula e interpretación de negocio"
              >
                ℹ️
              </button>
            </div>
            <div style={kpiNameStyle}>{dashboard.workshopReturn.kpiName}</div>
            <div style={{ ...kpiValueStyle, color: '#10b981' }}>
              {dashboard.workshopReturn.currentValue.formatted}
            </div>
            <div style={kpiSubtextStyle}>
              {dashboard.workshopReturn.explanation}
            </div>
            <div style={formulaBoxStyle}>
              <code>{dashboard.workshopReturn.formula}</code>
            </div>
          </div>

          {/* Card 4: Conversión de Oportunidades */}
          <div style={kpiCardStyle}>
            <div style={cardTopStyle}>
              <span style={kpiCategoryStyle}>MOTOR PREDICTIVO</span>
              <button
                style={infoBtnStyle}
                onClick={() => handleExplainKpi('opportunity_conversion_rate')}
                title="Ver fórmula e interpretación de negocio"
              >
                ℹ️
              </button>
            </div>
            <div style={kpiNameStyle}>{dashboard.opportunityConversion.kpiName}</div>
            <div style={{ ...kpiValueStyle, color: '#f59e0b' }}>
              {dashboard.opportunityConversion.currentValue.formatted}
            </div>
            <div style={kpiSubtextStyle}>
              {dashboard.opportunityConversion.explanation}
            </div>
            <div style={formulaBoxStyle}>
              <code>{dashboard.opportunityConversion.formula}</code>
            </div>
          </div>

          {/* Card 5: SLA de Primer Contacto */}
          <div style={kpiCardStyle}>
            <div style={cardTopStyle}>
              <span style={kpiCategoryStyle}>COMERCIAL</span>
              <button
                style={infoBtnStyle}
                onClick={() => handleExplainKpi('lead_first_response_sla_compliance')}
                title="Ver fórmula e interpretación de negocio"
              >
                ℹ️
              </button>
            </div>
            <div style={kpiNameStyle}>{dashboard.leadSlaCompliance.kpiName}</div>
            <div style={{ ...kpiValueStyle, color: '#ec4899' }}>
              {dashboard.leadSlaCompliance.currentValue.formatted}
            </div>
            <div style={kpiSubtextStyle}>
              {dashboard.leadSlaCompliance.explanation}
            </div>
            <div style={formulaBoxStyle}>
              <code>{dashboard.leadSlaCompliance.formula}</code>
            </div>
          </div>

          {/* Card 6: Ingreso Promedio Posventa */}
          <div style={kpiCardStyle}>
            <div style={cardTopStyle}>
              <span style={kpiCategoryStyle}>VALOR PARQUE</span>
              <button
                style={infoBtnStyle}
                onClick={() => handleExplainKpi('aftersales_revenue_per_vehicle')}
                title="Ver fórmula e interpretación de negocio"
              >
                ℹ️
              </button>
            </div>
            <div style={kpiNameStyle}>{dashboard.aftersalesRevenue.kpiName}</div>
            <div style={{ ...kpiValueStyle, color: '#38bdf8', fontSize: '1.6rem' }}>
              {dashboard.aftersalesRevenue.currentValue.formatted}
            </div>
            <div style={kpiSubtextStyle}>
              {dashboard.aftersalesRevenue.explanation}
            </div>
            <div style={formulaBoxStyle}>
              <code>{dashboard.aftersalesRevenue.formula}</code>
            </div>
          </div>
        </div>
      )}

      {/* Row 2: Deep Dive Retención por Dimensiones & Grupo de Control A/B */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Retention Dimensional Breakdown */}
        <div style={sectionCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#f8fafc', fontWeight: 700 }}>
                Retención por Cohorte / Dimensión
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Desglose analítico del parque atribuible activo
              </p>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                style={retentionDimension === 'make' ? activeDimBtnStyle : dimBtnStyle}
                onClick={() => handleDimensionChange('make')}
              >
                Por Marca
              </button>
              <button
                style={retentionDimension === 'vehicle_type' ? activeDimBtnStyle : dimBtnStyle}
                onClick={() => handleDimensionChange('vehicle_type')}
              >
                Por Tipo
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {retentionBreakdown?.breakdowns?.map((item) => (
              <div key={item.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{item.label}</span>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                    {item.formatted} ({item.count} unidades)
                  </span>
                </div>
                <div style={progressBarBgStyle}>
                  <div
                    style={{
                      ...progressBarFillStyle,
                      width: `${Math.min(item.percentage || 0, 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Grupo de Control A/B Card */}
        <div style={sectionCardStyle}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '15px', color: '#f8fafc', fontWeight: 700 }}>
              Calibración Contrafactual: Experimento 15% (D-39)
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              Medición del ROI atribuible real del CRM frente al grupo de control ciego
            </p>
          </div>

          {dashboard && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1rem' }}>
                <div style={experimentBoxStyle}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Intervenidos (85%)
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
                    {dashboard.controlGroupLift.breakdowns?.[0]?.formatted || '0%'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                    Gestión proactiva WhatsApp / Llamada
                  </div>
                </div>

                <div style={{ ...experimentBoxStyle, borderColor: '#8b5cf6' }}>
                  <div style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: 700, textTransform: 'uppercase' }}>
                    Grupo Control Ciego (15%)
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#c084fc', marginTop: '4px' }}>
                    {dashboard.controlGroupLift.breakdowns?.[1]?.formatted || '0%'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                    Comportamiento natural sin contacto
                  </div>
                </div>
              </div>

              <div style={liftCalloutStyle}>
                <div style={{ fontSize: '12px', color: '#166534', fontWeight: 700 }}>
                  🚀 Impacto Atribuible (Lift Neto del CRM):
                </div>
                <div style={{ fontSize: '22px', fontWeight: 900, color: '#15803d', margin: '4px 0' }}>
                  {dashboard.controlGroupLift.currentValue.formatted}
                </div>
                <div style={{ fontSize: '11px', color: '#166534' }}>
                  Los vehículos gestionados mediante las 7 reglas predictivas retornan a una tasa
                  sustancialmente superior que el parque no intervenido.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Catálogo Gobernado de Métricas & Trazabilidad */}
      <div style={sectionCardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', color: '#f8fafc', fontWeight: 700 }}>
              Catálogo de Definiciones de Métricas Gobernadas
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              Base semántica consumida por la capa analítica y las herramientas de Inteligencia Artificial
            </p>
          </div>
        </div>

        <table style={tableStyle}>
          <thead>
            <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155' }}>
              <th style={thStyle}>Código del KPI</th>
              <th style={thStyle}>Nombre Oficial</th>
              <th style={thStyle}>Categoría</th>
              <th style={thStyle}>Fórmula Matemática</th>
              <th style={thStyle}>Unidad</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {kpiDefinitions.map((kpi) => (
              <tr key={kpi.code} style={{ borderBottom: '1px solid #334155' }}>
                <td style={tdStyle}>
                  <code style={{ color: '#38bdf8', fontWeight: 700 }}>{kpi.code}</code>
                </td>
                <td style={{ ...tdStyle, color: '#f8fafc', fontWeight: 600 }}>{kpi.name}</td>
                <td style={tdStyle}>
                  <span style={getCategoryBadgeStyle(kpi.category)}>{kpi.category.toUpperCase()}</span>
                </td>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>
                  {kpi.formula}
                </td>
                <td style={{ ...tdStyle, color: '#cbd5e1' }}>{kpi.unit}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <button
                    style={explainBtnStyle}
                    onClick={() => handleExplainKpi(kpi.code)}
                  >
                    ℹ️ Explicar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Explanation Modal */}
      {selectedExplanation && (
        <div style={modalBackdropStyle} onClick={() => setSelectedExplanation(null)}>
          <div style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div>
                <span style={kpiCategoryStyle}>{selectedExplanation.category.toUpperCase()}</span>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '16px', color: '#f8fafc' }}>
                  {selectedExplanation.name}
                </h3>
                <code style={{ fontSize: '11px', color: '#38bdf8' }}>{selectedExplanation.code}</code>
              </div>
              <button
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}
                onClick={() => setSelectedExplanation(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={modalSubheadStyle}>Descripción de Negocio:</div>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>
                  {selectedExplanation.description}
                </p>
              </div>

              <div>
                <div style={modalSubheadStyle}>Fórmula Matemática Gobernada:</div>
                <div style={formulaBoxStyle}>
                  <code>{selectedExplanation.formula}</code>
                </div>
              </div>

              <div>
                <div style={modalSubheadStyle}>Interpretación en el Contexto Automotriz Colombiano:</div>
                <div style={interpretationBoxStyle}>
                  💡 {selectedExplanation.businessInterpretation}
                </div>
              </div>
            </div>

            <div style={modalFooterStyle}>
              <button
                style={closeModalBtnStyle}
                onClick={() => setSelectedExplanation(null)}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Styling definitions
const bannerStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
  border: '1px solid #334155',
  borderRadius: '12px',
  padding: '20px 24px',
};

const governanceBadgeStyle: React.CSSProperties = {
  background: '#0284c7',
  color: '#ffffff',
  fontSize: '11px',
  fontWeight: 700,
  padding: '3px 8px',
  borderRadius: '12px',
};

const kpiGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '16px',
};

const kpiCardStyle: React.CSSProperties = {
  backgroundColor: '#1e293b',
  padding: '18px 20px',
  borderRadius: '10px',
  border: '1px solid #334155',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
};

const cardTopStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '6px',
};

const kpiCategoryStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 800,
  color: '#38bdf8',
  letterSpacing: '0.05em',
};

const infoBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: '14px',
  padding: '2px',
};

const kpiNameStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: '#f8fafc',
};

const kpiValueStyle: React.CSSProperties = {
  fontSize: '2rem',
  fontWeight: 800,
  marginTop: '6px',
  marginBottom: '4px',
};

const kpiSubtextStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#94a3b8',
  lineHeight: 1.4,
  marginBottom: '10px',
};

const formulaBoxStyle: React.CSSProperties = {
  background: '#0f172a',
  padding: '6px 10px',
  borderRadius: '6px',
  border: '1px solid #334155',
  fontSize: '11px',
  color: '#38bdf8',
  overflowX: 'auto',
};

const sectionCardStyle: React.CSSProperties = {
  backgroundColor: '#1e293b',
  padding: '20px 24px',
  borderRadius: '12px',
  border: '1px solid #334155',
};

const dimBtnStyle: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid #334155',
  color: '#94a3b8',
  padding: '4px 10px',
  borderRadius: '6px',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
};

const activeDimBtnStyle: React.CSSProperties = {
  ...dimBtnStyle,
  background: '#0284c7',
  color: '#ffffff',
  borderColor: '#38bdf8',
};

const progressBarBgStyle: React.CSSProperties = {
  width: '100%',
  height: '8px',
  backgroundColor: '#0f172a',
  borderRadius: '4px',
  overflow: 'hidden',
};

const progressBarFillStyle: React.CSSProperties = {
  height: '100%',
  backgroundColor: '#0284c7',
  borderRadius: '4px',
  transition: 'width 0.3s ease',
};

const experimentBoxStyle: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '8px',
  padding: '12px 14px',
};

const liftCalloutStyle: React.CSSProperties = {
  background: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '8px',
  padding: '12px 16px',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '12px',
};

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontWeight: 700,
  color: '#94a3b8',
};

const tdStyle: React.CSSProperties = {
  padding: '12px',
  color: '#cbd5e1',
};

const explainBtnStyle: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid #38bdf8',
  color: '#38bdf8',
  padding: '4px 10px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: 700,
  cursor: 'pointer',
};

function getCategoryBadgeStyle(cat: string): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 700,
  };
  if (cat === 'retention') return { ...base, background: '#0369a1', color: '#e0f2fe' };
  if (cat === 'experimentation') return { ...base, background: '#6d28d9', color: '#ede9fe' };
  if (cat === 'aftersales') return { ...base, background: '#047857', color: '#d1fae5' };
  return { ...base, background: '#b45309', color: '#fef3c7' };
}

const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  backdropFilter: 'blur(3px)',
};

const modalBoxStyle: React.CSSProperties = {
  background: '#1e293b',
  borderRadius: '12px',
  border: '1px solid #334155',
  width: '580px',
  maxWidth: '92vw',
  overflow: 'hidden',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
};

const modalHeaderStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderBottom: '1px solid #334155',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  background: '#0f172a',
};

const modalSubheadStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const interpretationBoxStyle: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid #38bdf8',
  borderRadius: '8px',
  padding: '12px 14px',
  fontSize: '12px',
  color: '#e2e8f0',
  lineHeight: 1.5,
};

const modalFooterStyle: React.CSSProperties = {
  padding: '12px 20px',
  borderTop: '1px solid #334155',
  display: 'flex',
  justifyContent: 'flex-end',
  background: '#0f172a',
};

const closeModalBtnStyle: React.CSSProperties = {
  background: '#0284c7',
  color: '#ffffff',
  border: 'none',
  padding: '6px 16px',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
};
