import React, { useState, useEffect } from 'react';
import type { DealItem, QuoteDto, QuoteItemDto } from '../types';
import { fetchDealQuotes, createQuote } from '../api';

interface QuoteModalProps {
  deal: DealItem;
  isOpen: boolean;
  onClose: () => void;
  onQuoteCreated?: () => void;
}

export const QuoteModal: React.FC<QuoteModalProps> = ({
  deal,
  isOpen,
  onClose,
  onQuoteCreated,
}) => {
  const [quotes, setQuotes] = useState<QuoteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'view' | 'new'>('view');

  // New quote form state
  const [quoteNumber, setQuoteNumber] = useState('');
  const [items, setItems] = useState<QuoteItemDto[]>([
    {
      id: '1',
      concept: deal.vehicleDescription || deal.title,
      unitPrice: deal.estimatedValue > 0 ? deal.estimatedValue : 120000000,
      quantity: 1,
      taxPct: 19,
    },
  ]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [tradeInAllowance, setTradeInAllowance] = useState<number>(
    deal.tradeInDescription ? 40000000 : 0
  );
  const [paymentTerms, setPaymentTerms] = useState('Financiamiento 70% + Cuota Inicial');
  const [notes, setNotes] = useState('Vigencia 15 días. Incluye kit de carretera y gastos de matrícula.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    loadQuotes();
    setQuoteNumber(`COT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  }, [isOpen, deal.id]);

  async function loadQuotes() {
    setLoading(true);
    try {
      const data = await fetchDealQuotes(deal.id);
      setQuotes(data);
      if (data.length === 0) {
        setActiveTab('new');
      } else {
        setActiveTab('view');
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Calculations
  const basePrice = items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const taxesAmount = items.reduce(
    (acc, item) => acc + item.unitPrice * item.quantity * (item.taxPct / 100),
    0
  );
  const subtotalWithDiscountAndTax = basePrice - discountAmount + taxesAmount;
  const netAmount = Math.max(0, subtotalWithDiscountAndTax - tradeInAllowance);

  function handleAddItem() {
    setItems([
      ...items,
      {
        id: String(Date.now()),
        concept: 'Accesorio / Trámite adicional',
        unitPrice: 1500000,
        quantity: 1,
        taxPct: 19,
      },
    ]);
  }

  function handleRemoveItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  function handleItemChange(idx: number, field: keyof QuoteItemDto, val: any) {
    const updated = [...items];
    const item = { ...updated[idx]! };
    if (field === 'concept') item.concept = val;
    if (field === 'unitPrice') item.unitPrice = Number(val) || 0;
    if (field === 'quantity') item.quantity = Number(val) || 1;
    if (field === 'taxPct') item.taxPct = Number(val) || 0;
    updated[idx] = item;
    setItems(updated);
  }

  async function handleSubmitQuote(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await createQuote(deal.id, {
        quoteNumber,
        items,
        discountAmount,
        tradeInAllowance,
        paymentTerms,
        validDays: 15,
        notes,
      });
      await loadQuotes();
      setActiveTab('view');
      if (onQuoteCreated) onQuoteCreated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al emitir cotización');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const latestQuote = quotes[0];

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>📄</span>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                Cotizaciones Comerciales
              </h2>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Negocio: <strong>{deal.title}</strong> — Cliente: {deal.customerName}
            </p>
          </div>
          <button style={closeBtnStyle} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Tab switch */}
        <div style={tabContainerStyle}>
          <button
            style={activeTab === 'view' ? activeTabStyle : tabStyle}
            onClick={() => setActiveTab('view')}
          >
            📋 Cotizaciones Emitidas ({quotes.length})
          </button>
          <button
            style={activeTab === 'new' ? activeTabStyle : tabStyle}
            onClick={() => setActiveTab('new')}
          >
            ➕ Nueva Cotización / Versión
          </button>
        </div>

        {/* Content */}
        <div style={bodyStyle}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              Cargando cotizaciones...
            </div>
          ) : activeTab === 'view' ? (
            <div>
              {quotes.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  <p style={{ margin: '0 0 12px 0' }}>No se han generado cotizaciones para esta oportunidad comercial.</p>
                  <button style={btnPrimaryStyle} onClick={() => setActiveTab('new')}>
                    Crear Primera Cotización
                  </button>
                </div>
              ) : (
                <div>
                  {quotes.map((q) => (
                    <div key={q.id} style={quoteCardStyle}>
                      <div style={quoteCardHeaderStyle}>
                        <div>
                          <span style={quoteNumBadgeStyle}>{q.quoteNumber}</span>
                          <span style={{ marginLeft: '8px', fontSize: '12px', color: '#64748b' }}>
                            Versión {q.currentVersion}
                          </span>
                        </div>
                        <span
                          style={{
                            ...statusPillStyle,
                            backgroundColor:
                              q.status === 'reconciled'
                                ? '#dcfce7'
                                : q.status === 'sent'
                                ? '#e0f2fe'
                                : '#f1f5f9',
                            color:
                              q.status === 'reconciled'
                                ? '#166534'
                                : q.status === 'sent'
                                ? '#0369a1'
                                : '#475569',
                          }}
                        >
                          {q.status === 'reconciled'
                            ? '✅ Venta Conciliada ERP'
                            : q.status === 'sent'
                            ? '📤 Enviada al Cliente'
                            : 'Borrador'}
                        </span>
                      </div>

                      {q.latestVersion && (
                        <div style={{ marginTop: '12px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
                            <div style={metricBoxStyle}>
                              <div style={metricLabelStyle}>Precio Base</div>
                              <div style={metricValueStyle}>
                                ${q.latestVersion.basePrice.toLocaleString('es-CO')}
                              </div>
                            </div>
                            <div style={metricBoxStyle}>
                              <div style={metricLabelStyle}>IVA (19%)</div>
                              <div style={metricValueStyle}>
                                +${q.latestVersion.taxesAmount.toLocaleString('es-CO')}
                              </div>
                            </div>
                            <div style={metricBoxStyle}>
                              <div style={metricLabelStyle}>Retoma Usado</div>
                              <div style={{ ...metricValueStyle, color: '#059669' }}>
                                -${q.latestVersion.tradeInAllowance.toLocaleString('es-CO')}
                              </div>
                            </div>
                            <div style={{ ...metricBoxStyle, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                              <div style={{ ...metricLabelStyle, color: '#166534' }}>Total Neto a Pagar</div>
                              <div style={{ ...metricValueStyle, color: '#166534', fontWeight: 800 }}>
                                ${q.latestVersion.netAmount.toLocaleString('es-CO')}
                              </div>
                            </div>
                          </div>

                          {/* Items table */}
                          <div style={{ fontSize: '12px', color: '#475569', fontWeight: 600, marginBottom: '6px' }}>
                            Desglose de Ítems:
                          </div>
                          <table style={itemTableStyle}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={thStyle}>Concepto</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Cant.</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Valor Unitario</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>IVA</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {q.latestVersion.items.map((it, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={tdStyle}>{it.concept}</td>
                                  <td style={{ ...tdStyle, textAlign: 'center' }}>{it.quantity}</td>
                                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                                    ${it.unitPrice.toLocaleString('es-CO')}
                                  </td>
                                  <td style={{ ...tdStyle, textAlign: 'right' }}>{it.taxPct}%</td>
                                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                                    ${(it.unitPrice * it.quantity).toLocaleString('es-CO')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                              Válida hasta: {new Date(q.latestVersion.validUntil).toLocaleDateString('es-CO')}
                            </div>
                            <a
                              href={`https://wa.me/${deal.customerPhone?.replace(/\D/g, '')}?text=${encodeURIComponent(
                                `Hola ${deal.customerName}, adjunto la cotización formal ${q.quoteNumber} por un valor neto de $${q.latestVersion.netAmount.toLocaleString('es-CO')} COP para tu nuevo ${deal.vehicleDescription || deal.title}.`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              style={whatsappBtnStyle}
                            >
                              💬 Compartir por WhatsApp
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmitQuote}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={labelStyle}>Número de Cotización</label>
                  <input
                    type="text"
                    style={inputStyle}
                    value={quoteNumber}
                    onChange={(e) => setQuoteNumber(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>Términos y Forma de Pago</label>
                  <input
                    type="text"
                    style={inputStyle}
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                  />
                </div>
              </div>

              {/* Items */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ ...labelStyle, margin: 0 }}>Ítems a Cotizar</label>
                  <button type="button" style={btnSmallStyle} onClick={handleAddItem}>
                    ➕ Agregar Ítem / Accesorio
                  </button>
                </div>

                {items.map((it, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 2fr 1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      style={inputStyle}
                      placeholder="Concepto (ej. Chasis, Accesorio, Furgón)"
                      value={it.concept}
                      onChange={(e) => handleItemChange(idx, 'concept', e.target.value)}
                      required
                    />
                    <input
                      type="number"
                      style={inputStyle}
                      min="1"
                      placeholder="Cant"
                      value={it.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      required
                    />
                    <input
                      type="number"
                      style={inputStyle}
                      step="50000"
                      placeholder="Precio Unitario"
                      value={it.unitPrice}
                      onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                      required
                    />
                    <select
                      style={inputStyle}
                      value={it.taxPct}
                      onChange={(e) => handleItemChange(idx, 'taxPct', e.target.value)}
                    >
                      <option value="19">19% IVA</option>
                      <option value="0">0% Exento</option>
                    </select>
                    {items.length > 1 && (
                      <button
                        type="button"
                        style={{ ...btnSmallStyle, background: '#fee2e2', color: '#991b1b', border: 'none' }}
                        onClick={() => handleRemoveItem(idx)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Discounts & Trade-in */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Descuento Comercial (COP)</label>
                  <input
                    type="number"
                    style={inputStyle}
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Avalúo Retoma Usado / Trade-in (COP)
                    {deal.tradeInDescription && (
                      <span style={{ fontSize: '11px', color: '#059669', marginLeft: '4px' }}>
                        (Aplica a {deal.tradeInDescription})
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    style={inputStyle}
                    value={tradeInAllowance}
                    onChange={(e) => setTradeInAllowance(Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Summary calculation card */}
              <div style={calcCardStyle}>
                <div style={calcRowStyle}>
                  <span>Subtotal Base:</span>
                  <span>${basePrice.toLocaleString('es-CO')}</span>
                </div>
                <div style={calcRowStyle}>
                  <span>Descuento Comercial:</span>
                  <span style={{ color: '#dc2626' }}>-${discountAmount.toLocaleString('es-CO')}</span>
                </div>
                <div style={calcRowStyle}>
                  <span>IVA Estimado (19%):</span>
                  <span>+${taxesAmount.toLocaleString('es-CO')}</span>
                </div>
                <div style={calcRowStyle}>
                  <span>Bono Retoma Vehículo Usado:</span>
                  <span style={{ color: '#059669' }}>-${tradeInAllowance.toLocaleString('es-CO')}</span>
                </div>
                <div style={{ ...calcRowStyle, borderTop: '2px solid #e2e8f0', paddingTop: '8px', marginTop: '4px', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  <span>Total Neto Propuesta:</span>
                  <span style={{ color: '#0284c7' }}>${netAmount.toLocaleString('es-CO')} COP</span>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Notas Comerciales & Condiciones</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '60px' }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {errorMsg && (
                <div style={{ padding: '10px', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '12px', fontSize: '13px' }}>
                  {errorMsg}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" style={btnSecondaryStyle} onClick={() => setActiveTab('view')}>
                  Cancelar
                </button>
                <button type="submit" style={btnPrimaryStyle} disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : '💾 Emitir Cotización'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// Styles
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

const modalStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '12px',
  width: '780px',
  maxWidth: '92vw',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderBottom: '1px solid #e2e8f0',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  background: '#f8fafc',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  fontSize: '18px',
  color: '#94a3b8',
  cursor: 'pointer',
  padding: '4px',
};

const tabContainerStyle: React.CSSProperties = {
  display: 'flex',
  background: '#f1f5f9',
  padding: '4px 20px 0 20px',
  borderBottom: '1px solid #e2e8f0',
  gap: '8px',
};

const tabStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: '10px 16px',
  fontSize: '13px',
  fontWeight: 600,
  color: '#64748b',
  cursor: 'pointer',
  borderBottom: '2px solid transparent',
};

const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  color: '#0284c7',
  background: '#ffffff',
  borderTopLeftRadius: '6px',
  borderTopRightRadius: '6px',
  borderBottom: '2px solid #0284c7',
};

const bodyStyle: React.CSSProperties = {
  padding: '20px',
  overflowY: 'auto',
};

const quoteCardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '16px',
  background: '#ffffff',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};

const quoteCardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingBottom: '12px',
  borderBottom: '1px solid #f1f5f9',
};

const quoteNumBadgeStyle: React.CSSProperties = {
  background: '#eff6ff',
  color: '#1d4ed8',
  fontWeight: 700,
  fontSize: '13px',
  padding: '4px 8px',
  borderRadius: '4px',
};

const statusPillStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  padding: '3px 8px',
  borderRadius: '12px',
};

const metricBoxStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#64748b',
  marginBottom: '2px',
};

const metricValueStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 700,
  color: '#0f172a',
};

const itemTableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '12px',
};

const thStyle: React.CSSProperties = {
  padding: '8px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#475569',
};

const tdStyle: React.CSSProperties = {
  padding: '8px',
  color: '#334155',
};

const whatsappBtnStyle: React.CSSProperties = {
  background: '#25D366',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '6px 12px',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
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

const calcCardStyle: React.CSSProperties = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '12px 16px',
  marginBottom: '16px',
};

const calcRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '13px',
  color: '#475569',
  marginBottom: '4px',
};

const btnSmallStyle: React.CSSProperties = {
  background: '#f1f5f9',
  border: '1px solid #cbd5e1',
  color: '#334155',
  padding: '4px 10px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
};

const btnPrimaryStyle: React.CSSProperties = {
  background: '#0284c7',
  color: '#ffffff',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '6px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
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
