import React, { useState, useEffect } from 'react';
import type {
  DealItem,
  LeadItem,
  PipelineItem,
  PipelineStageItem,
  SaleItem,
} from '../types';
import {
  fetchPipelines,
  fetchLeads,
  fetchDeals,
  fetchSales,
  moveDealStage,
  contactLead,
  convertLeadToDeal,
  createLead,
} from '../api';
import { QuoteModal } from './QuoteModal';
import { ColombianPlate } from './ColombianPlate';

export const CommercialView: React.FC = () => {
  const [subTab, setSubTab] = useState<'kanban' | 'leads' | 'sales'>('kanban');
  const [loading, setLoading] = useState(true);

  // Data states
  const [pipelines, setPipelines] = useState<PipelineItem[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [sales, setSales] = useState<SaleItem[]>([]);

  // Modals state
  const [quoteDeal, setQuoteDeal] = useState<DealItem | null>(null);
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);

  // New lead form
  const [newLeadForm, setNewLeadForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    source: 'showroom_walk_in',
    interestedVehicleModel: '',
    notes: '',
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedPipelineId) {
      loadDeals(selectedPipelineId);
    }
  }, [selectedPipelineId]);

  async function loadInitialData() {
    setLoading(true);
    try {
      const [pipeData, leadData, saleData] = await Promise.all([
        fetchPipelines(),
        fetchLeads(),
        fetchSales(),
      ]);
      setPipelines(pipeData);
      setLeads(leadData);
      setSales(saleData);

      const defaultPipe = pipeData.find((p) => p.isDefault) || pipeData[0];
      if (defaultPipe) {
        setSelectedPipelineId(defaultPipe.id);
        await loadDeals(defaultPipe.id);
      }
    } catch (err: any) {
      console.error('Error cargando módulo comercial:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadDeals(pipelineId: string) {
    try {
      const dealsData = await fetchDeals(pipelineId);
      setDeals(dealsData);
    } catch (err: any) {
      console.error('Error cargando deals:', err);
    }
  }

  async function handleMoveStage(dealId: string, newStageId: string) {
    try {
      await moveDealStage(dealId, newStageId);
      if (selectedPipelineId) {
        await loadDeals(selectedPipelineId);
      }
    } catch (err: any) {
      alert(`Error al mover etapa: ${err.message}`);
    }
  }

  async function handleContactLead(leadId: string) {
    try {
      await contactLead(leadId);
      const updatedLeads = await fetchLeads();
      setLeads(updatedLeads);
    } catch (err: any) {
      console.error(err);
    }
  }

  async function handleConvertLead(lead: LeadItem) {
    const defaultPipe = pipelines.find((p) => p.isDefault) || pipelines[0];
    const pipeId = defaultPipe?.id;

    try {
      await convertLeadToDeal(lead.id, {
        pipelineId: pipeId,
        dealTitle: `Compra: ${lead.interestedVehicleModel || 'Vehículo'} — ${lead.fullName}`,
      });
      const [updatedLeads, updatedDeals] = await Promise.all([
        fetchLeads(),
        selectedPipelineId ? fetchDeals(selectedPipelineId) : Promise.resolve([]),
      ]);
      setLeads(updatedLeads);
      setDeals(updatedDeals);
      alert(`¡Lead ${lead.fullName} convertido exitosamente en Oportunidad Comercial!`);
    } catch (err: any) {
      alert(`Error al convertir lead: ${err.message}`);
    }
  }

  async function handleCreateNewLead(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createLead(newLeadForm);
      setIsNewLeadModalOpen(false);
      setNewLeadForm({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        source: 'showroom_walk_in',
        interestedVehicleModel: '',
        notes: '',
      });
      const updatedLeads = await fetchLeads();
      setLeads(updatedLeads);
    } catch (err: any) {
      alert(`Error creando lead: ${err.message}`);
    }
  }

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);

  // Calculations for summary KPI cards
  const totalPipelineValue = deals
    .filter((d) => d.status === 'open')
    .reduce((acc, d) => acc + d.estimatedValue, 0);
  const totalReconciledSalesAmount = sales.reduce((acc, s) => acc + s.saleAmount, 0);
  const leadsPendingContact = leads.filter((l) => l.status === 'new' || l.status === 'assigned').length;

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
      {/* KPI Cards Row */}
      <div style={kpiRowStyle}>
        <div style={kpiCardStyle}>
          <div style={kpiTitleStyle}>Leads por Contactar</div>
          <div style={kpiValueStyle}>{leadsPendingContact}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            {leads.filter((l) => l.isSlaBreached).length > 0 ? (
              <span style={{ color: '#dc2626', fontWeight: 600 }}>
                ⚠️ {leads.filter((l) => l.isSlaBreached).length} con SLA en riesgo
              </span>
            ) : (
              '✅ Todos dentro de SLA'
            )}
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiTitleStyle}>Valor del Embudo Abierto</div>
          <div style={{ ...kpiValueStyle, color: '#0284c7' }}>
            ${totalPipelineValue.toLocaleString('es-CO')}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            {deals.filter((d) => d.status === 'open').length} negocios en curso
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiTitleStyle}>Ventas Conciliadas ERP (D-44)</div>
          <div style={{ ...kpiValueStyle, color: '#16a34a' }}>
            ${totalReconciledSalesAmount.toLocaleString('es-CO')}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            {sales.length} pedidos facturados / entregados
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiTitleStyle}>Pipelines Especializados</div>
          <div style={kpiValueStyle}>{pipelines.length}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Livianos, Pesados, Retoma y Flotas
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={navTabsBarStyle}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            style={subTab === 'kanban' ? activeSubTabStyle : subTabStyle}
            onClick={() => setSubTab('kanban')}
          >
            📊 Tablero Kanban (Embudo Comercial)
          </button>
          <button
            style={subTab === 'leads' ? activeSubTabStyle : subTabStyle}
            onClick={() => setSubTab('leads')}
          >
            📥 Bandeja de Leads & SLA ({leads.length})
          </button>
          <button
            style={subTab === 'sales' ? activeSubTabStyle : subTabStyle}
            onClick={() => setSubTab('sales')}
          >
            🏁 Ventas & Conciliación ERP ({sales.length})
          </button>
        </div>

        {subTab === 'leads' && (
          <button style={btnActionPrimaryStyle} onClick={() => setIsNewLeadModalOpen(true)}>
            ➕ Registrar Nuevo Lead
          </button>
        )}
      </div>

      {/* SUBTAB 1: KANBAN BOARD */}
      {subTab === 'kanban' && (
        <div>
          {/* Pipeline Selector Toolbar */}
          <div style={pipelineSelectorBarStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                Pipeline Automotriz:
              </span>
              <select
                style={pipelineSelectStyle}
                value={selectedPipelineId}
                onChange={(e) => setSelectedPipelineId(e.target.value)}
              >
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.isDefault ? ' (Predeterminado)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ fontSize: '12px', color: '#64748b' }}>
              {deals.length} oportunidades en este pipeline
            </div>
          </div>

          {/* Kanban Columns */}
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
              Cargando tablero Kanban...
            </div>
          ) : !selectedPipeline ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>No hay pipeline seleccionado</div>
          ) : (
            <div style={kanbanContainerStyle}>
              {selectedPipeline.stages.map((stage) => {
                const stageDeals = deals.filter((d) => d.stageId === stage.id);
                const stageTotalValue = stageDeals.reduce((acc, d) => acc + d.estimatedValue, 0);

                return (
                  <div key={stage.id} style={kanbanColStyle}>
                    {/* Stage Header */}
                    <div style={stageHeaderStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={stageNameStyle}>{stage.name}</span>
                        <span style={probBadgeStyle}>{stage.probabilityPct}%</span>
                      </div>
                      <div style={stageSubStyle}>
                        <span>{stageDeals.length} negocios</span>
                        {stageTotalValue > 0 && (
                          <span style={{ fontWeight: 600 }}>
                            ${(stageTotalValue / 1000000).toFixed(1)}M COP
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stage Deal Cards */}
                    <div style={stageBodyStyle}>
                      {stageDeals.length === 0 ? (
                        <div style={emptyStageStyle}>Sin oportunidades</div>
                      ) : (
                        stageDeals.map((deal) => (
                          <div key={deal.id} style={dealCardStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                              <h4 style={dealTitleStyle}>{deal.title}</h4>
                              {deal.status === 'won' && <span style={wonBadgeStyle}>Ganada</span>}
                              {deal.status === 'lost' && <span style={lostBadgeStyle}>Perdida</span>}
                            </div>

                            <div style={customerInfoStyle}>
                              👤 <strong>{deal.customerName}</strong>
                            </div>

                            {deal.vehiclePlate && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '6px 0' }}>
                                <ColombianPlate plate={deal.vehiclePlate} size="small" />
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                  {deal.vehicleDescription}
                                </span>
                              </div>
                            )}

                            {/* Trade-in badge if retoma */}
                            {deal.tradeInDescription && (
                              <div style={tradeInBadgeStyle}>
                                🔄 Retoma: <strong>{deal.tradeInDescription}</strong>
                              </div>
                            )}

                            <div style={dealValueStyle}>
                              ${deal.estimatedValue.toLocaleString('es-CO')} {deal.currency}
                            </div>

                            {/* Actions footer */}
                            <div style={dealCardActionsStyle}>
                              <button
                                style={btnQuoteStyle}
                                onClick={() => setQuoteDeal(deal)}
                              >
                                📄 Cotizar
                              </button>

                              <select
                                style={stageChangeSelectStyle}
                                value={deal.stageId}
                                onChange={(e) => handleMoveStage(deal.id, e.target.value)}
                              >
                                <option disabled value="">
                                  Mover etapa...
                                </option>
                                {selectedPipeline.stages.map((st) => (
                                  <option key={st.id} value={st.id}>
                                    {st.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: LEADS INBOX */}
      {subTab === 'leads' && (
        <div style={leadsContainerStyle}>
          <div style={leadsHeaderRowStyle}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>
                Bandeja de Entrada de Leads Inbound
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Monitoreo de tiempo de primera respuesta (SLA de atención) y calificación
              </p>
            </div>
          </div>

          <table style={leadTableStyle}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={thLeadStyle}>Prospecto / Titular</th>
                <th style={thLeadStyle}>Vehículo de Interés</th>
                <th style={thLeadStyle}>Canal de Origen</th>
                <th style={thLeadStyle}>SLA de Atención</th>
                <th style={thLeadStyle}>Estado</th>
                <th style={{ ...thLeadStyle, textAlign: 'right' }}>Acciones Rápidas</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={tdLeadStyle}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{l.fullName}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {l.phone || 'Sin teléfono'} {l.email ? `• ${l.email}` : ''}
                    </div>
                  </td>
                  <td style={tdLeadStyle}>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>
                      {l.interestedVehicleModel || 'Vehículo General'}
                    </div>
                    {l.notes && (
                      <div style={{ fontSize: '11px', color: '#64748b', maxWidth: '300px' }}>
                        {l.notes}
                      </div>
                    )}
                  </td>
                  <td style={tdLeadStyle}>
                    <span style={getSourceBadgeStyle(l.source)}>
                      {formatSource(l.source)}
                    </span>
                  </td>
                  <td style={tdLeadStyle}>
                    {l.firstContactedAt ? (
                      <div style={{ fontSize: '12px', color: '#16a34a' }}>
                        ✅ Contactado ({new Date(l.firstContactedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })})
                      </div>
                    ) : l.isSlaBreached ? (
                      <div style={slaBreachedBadgeStyle}>
                        ⏱️ SLA Vencido
                      </div>
                    ) : (
                      <div style={slaActiveBadgeStyle}>
                        🟢 En tiempo (SLA 30m)
                      </div>
                    )}
                  </td>
                  <td style={tdLeadStyle}>
                    <span style={getLeadStatusBadgeStyle(l.status)}>
                      {formatLeadStatus(l.status)}
                    </span>
                  </td>
                  <td style={{ ...tdLeadStyle, textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      {l.phone && (
                        <a
                          href={`https://wa.me/${l.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                            `Hola ${l.firstName}, gracias por contactar a MIA CRM. Respecto a tu consulta sobre el ${l.interestedVehicleModel || 'vehículo'}, ¿cuándo podríamos coordinar una llamada o test drive?`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          style={whatsappSmallBtnStyle}
                          onClick={() => handleContactLead(l.id)}
                        >
                          💬 WhatsApp
                        </a>
                      )}
                      {l.status !== 'converted' && l.status !== 'discarded' && (
                        <button
                          style={btnConvertStyle}
                          onClick={() => handleConvertLead(l)}
                        >
                          Convertir a Negocio ➡️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SUBTAB 3: SALES RECONCILIATION */}
      {subTab === 'sales' && (
        <div style={leadsContainerStyle}>
          <div style={leadsHeaderRowStyle}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>
                Ventas Conciliadas con Pedidos del ERP (Decisión D-44)
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Cierre comercial con pedido de venta (`vh_documentos_ped`), factura y entrega al parque atribuible
              </p>
            </div>
          </div>

          <table style={leadTableStyle}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={thLeadStyle}>Pedido ERP / Factura</th>
                <th style={thLeadStyle}>Vehículo Vendido</th>
                <th style={thLeadStyle}>Comprador / Titular</th>
                <th style={thLeadStyle}>Valor Venta (COP)</th>
                <th style={thLeadStyle}>Fecha Venta</th>
                <th style={thLeadStyle}>Fecha Entrega</th>
                <th style={thLeadStyle}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={tdLeadStyle}>
                    <div style={{ fontWeight: 700, color: '#0369a1' }}>
                      {s.externalOrderNumber || 'PED-CRM'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      Factura: {s.externalInvoiceNumber || 'Pendiente'}
                    </div>
                  </td>
                  <td style={tdLeadStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ColombianPlate plate={s.vehiclePlate} size="small" />
                      <div>
                        <div style={{ fontWeight: 600 }}>{s.vehicleDescription}</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>{s.vehicleVin}</div>
                      </div>
                    </div>
                  </td>
                  <td style={tdLeadStyle}>
                    <div style={{ fontWeight: 600 }}>{s.customerName}</div>
                  </td>
                  <td style={tdLeadStyle}>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>
                      ${s.saleAmount.toLocaleString('es-CO')}
                    </div>
                  </td>
                  <td style={tdLeadStyle}>
                    {new Date(s.saleDate).toLocaleDateString('es-CO')}
                  </td>
                  <td style={tdLeadStyle}>
                    {s.deliveryDate ? (
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>
                        {new Date(s.deliveryDate).toLocaleDateString('es-CO')}
                      </span>
                    ) : (
                      <span style={{ color: '#d97706' }}>Pendiente Entrega</span>
                    )}
                  </td>
                  <td style={tdLeadStyle}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: s.status === 'completed' ? '#dcfce7' : '#fef3c7',
                        color: s.status === 'completed' ? '#166534' : '#92400e',
                      }}
                    >
                      {s.status === 'completed' ? 'Vehículo Entregado' : 'En Preparación'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Quote Modal */}
      {quoteDeal && (
        <QuoteModal
          deal={quoteDeal}
          isOpen={Boolean(quoteDeal)}
          onClose={() => setQuoteDeal(null)}
          onQuoteCreated={() => {
            if (selectedPipelineId) loadDeals(selectedPipelineId);
          }}
        />
      )}

      {/* New Lead Modal */}
      {isNewLeadModalOpen && (
        <div style={backdropStyle} onClick={() => setIsNewLeadModalOpen(false)}>
          <div style={newLeadModalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={newLeadHeaderStyle}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>
                Registrar Nuevo Lead
              </h3>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}
                onClick={() => setIsNewLeadModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateNewLead} style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>Nombres *</label>
                  <input
                    type="text"
                    style={inputStyle}
                    required
                    value={newLeadForm.firstName}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Apellidos</label>
                  <input
                    type="text"
                    style={inputStyle}
                    value={newLeadForm.lastName}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>Teléfono / WhatsApp *</label>
                  <input
                    type="text"
                    style={inputStyle}
                    placeholder="+573001234567"
                    required
                    value={newLeadForm.phone}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Correo Electrónico</label>
                  <input
                    type="email"
                    style={inputStyle}
                    value={newLeadForm.email}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>Canal de Captación</label>
                  <select
                    style={inputStyle}
                    value={newLeadForm.source}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, source: e.target.value })}
                  >
                    <option value="showroom_walk_in">Visita Sala (Showroom)</option>
                    <option value="meta_lead_ads">Meta Lead Ads (Facebook/Instagram)</option>
                    <option value="web_form">Formulario Web Concesionario</option>
                    <option value="phone_inbound">Llamada Entrante</option>
                    <option value="referral">Referido</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Modelo de Interés</label>
                  <input
                    type="text"
                    style={inputStyle}
                    placeholder="ej. Toyota Hilux, Mazda CX-30, Camión Hino"
                    value={newLeadForm.interestedVehicleModel}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, interestedVehicleModel: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Notas Iniciales del Asesor</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '60px' }}
                  placeholder="Detalles de interés, retoma de usado o condiciones de pago..."
                  value={newLeadForm.notes}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  style={btnSecondaryStyle}
                  onClick={() => setIsNewLeadModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" style={btnActionPrimaryStyle}>
                  Guardar Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Formatting helpers
function formatSource(source: string) {
  switch (source) {
    case 'meta_lead_ads':
      return 'Meta Ads';
    case 'web_form':
      return 'Web Form';
    case 'showroom_walk_in':
      return 'Sala Showroom';
    case 'phone_inbound':
      return 'Llamada';
    case 'referral':
      return 'Referido';
    default:
      return source;
  }
}

function getSourceBadgeStyle(source: string): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '3px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 600,
  };
  if (source === 'meta_lead_ads') {
    return { ...base, background: '#eff6ff', color: '#1d4ed8' };
  }
  if (source === 'showroom_walk_in') {
    return { ...base, background: '#fdf4ff', color: '#a21caf' };
  }
  if (source === 'web_form') {
    return { ...base, background: '#f0fdf4', color: '#15803d' };
  }
  return { ...base, background: '#f1f5f9', color: '#475569' };
}

function formatLeadStatus(status: string) {
  switch (status) {
    case 'new':
      return 'Nuevo';
    case 'assigned':
      return 'Asignado';
    case 'contacted':
      return 'Contactado';
    case 'qualified':
      return 'Calificado';
    case 'converted':
      return 'Convertido';
    case 'discarded':
      return 'Descartado';
    default:
      return status;
  }
}

function getLeadStatusBadgeStyle(status: string): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '3px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 600,
  };
  if (status === 'new') return { ...base, background: '#fee2e2', color: '#991b1b' };
  if (status === 'contacted') return { ...base, background: '#e0f2fe', color: '#0369a1' };
  if (status === 'converted') return { ...base, background: '#dcfce7', color: '#166534' };
  return { ...base, background: '#f1f5f9', color: '#475569' };
}

// Styling definitions
const kpiRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '16px',
  marginBottom: '20px',
};

const kpiCardStyle: React.CSSProperties = {
  background: '#ffffff',
  padding: '16px 20px',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};

const kpiTitleStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const kpiValueStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 800,
  color: '#0f172a',
  marginTop: '4px',
};

const navTabsBarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '16px',
  borderBottom: '1px solid #e2e8f0',
  paddingBottom: '8px',
};

const subTabStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: '8px 16px',
  fontSize: '13px',
  fontWeight: 600,
  color: '#64748b',
  cursor: 'pointer',
  borderRadius: '6px',
};

const activeSubTabStyle: React.CSSProperties = {
  ...subTabStyle,
  background: '#0284c7',
  color: '#ffffff',
};

const btnActionPrimaryStyle: React.CSSProperties = {
  background: '#0284c7',
  color: '#ffffff',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '6px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
};

const pipelineSelectorBarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  background: '#ffffff',
  padding: '12px 16px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  marginBottom: '16px',
};

const pipelineSelectStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  fontSize: '13px',
  fontWeight: 600,
  color: '#0f172a',
};

const kanbanContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '14px',
  overflowX: 'auto',
  paddingBottom: '20px',
  alignItems: 'flex-start',
};

const kanbanColStyle: React.CSSProperties = {
  flex: '0 0 280px',
  background: '#f8fafc',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  maxHeight: 'calc(100vh - 280px)',
  display: 'flex',
  flexDirection: 'column',
};

const stageHeaderStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderBottom: '1px solid #e2e8f0',
  background: '#ffffff',
  borderTopLeftRadius: '8px',
  borderTopRightRadius: '8px',
};

const stageNameStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: '#0f172a',
};

const probBadgeStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  background: '#e0f2fe',
  color: '#0369a1',
  padding: '2px 6px',
  borderRadius: '10px',
};

const stageSubStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '11px',
  color: '#64748b',
  marginTop: '4px',
};

const stageBodyStyle: React.CSSProperties = {
  padding: '10px',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const emptyStageStyle: React.CSSProperties = {
  padding: '24px 10px',
  textAlign: 'center',
  fontSize: '12px',
  color: '#94a3b8',
  border: '1px dashed #cbd5e1',
  borderRadius: '6px',
};

const dealCardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '8px',
  padding: '12px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};

const dealTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '13px',
  fontWeight: 700,
  color: '#0f172a',
};

const wonBadgeStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  background: '#dcfce7',
  color: '#166534',
  padding: '2px 6px',
  borderRadius: '4px',
};

const lostBadgeStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  background: '#fee2e2',
  color: '#991b1b',
  padding: '2px 6px',
  borderRadius: '4px',
};

const customerInfoStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#475569',
  marginBottom: '4px',
};

const tradeInBadgeStyle: React.CSSProperties = {
  fontSize: '11px',
  background: '#f0fdf4',
  color: '#166534',
  padding: '4px 6px',
  borderRadius: '4px',
  margin: '6px 0',
  border: '1px solid #bbf7d0',
};

const dealValueStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 800,
  color: '#0284c7',
  marginTop: '6px',
};

const dealCardActionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '10px',
  paddingTop: '8px',
  borderTop: '1px solid #f1f5f9',
};

const btnQuoteStyle: React.CSSProperties = {
  background: '#eff6ff',
  color: '#1d4ed8',
  border: '1px solid #bfdbfe',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
};

const stageChangeSelectStyle: React.CSSProperties = {
  fontSize: '11px',
  padding: '3px 6px',
  borderRadius: '4px',
  border: '1px solid #cbd5e1',
  maxWidth: '120px',
};

const leadsContainerStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  overflow: 'hidden',
};

const leadsHeaderRowStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderBottom: '1px solid #e2e8f0',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const leadTableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '13px',
};

const thLeadStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#475569',
  fontSize: '12px',
};

const tdLeadStyle: React.CSSProperties = {
  padding: '12px 16px',
  color: '#334155',
};

const slaActiveBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 8px',
  borderRadius: '12px',
  fontSize: '11px',
  fontWeight: 700,
  background: '#f0fdf4',
  color: '#166534',
  border: '1px solid #bbf7d0',
};

const slaBreachedBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 8px',
  borderRadius: '12px',
  fontSize: '11px',
  fontWeight: 700,
  background: '#fee2e2',
  color: '#991b1b',
  border: '1px solid #fecaca',
};

const whatsappSmallBtnStyle: React.CSSProperties = {
  background: '#25D366',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '5px 10px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
};

const btnConvertStyle: React.CSSProperties = {
  background: '#0284c7',
  color: '#ffffff',
  border: 'none',
  padding: '5px 10px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
};

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.65)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  backdropFilter: 'blur(3px)',
};

const newLeadModalStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '12px',
  width: '560px',
  maxWidth: '92vw',
  overflow: 'hidden',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
};

const newLeadHeaderStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderBottom: '1px solid #e2e8f0',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  background: '#f8fafc',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#334155',
  marginBottom: '4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  fontSize: '13px',
  boxSizing: 'border-box',
};

const btnSecondaryStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #cbd5e1',
  color: '#475569',
  padding: '8px 16px',
  borderRadius: '6px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
};
