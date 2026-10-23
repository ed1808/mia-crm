// apps/web/src/components/CopilotDrawer.tsx
import React, { useState, useEffect, useRef } from 'react';
import { chatWithCopilot, fetchAiTools, approveAiExecution, fetchPendingAiApprovals } from '../api';
import type { CopilotMessage, AiToolMetadataDto, AiToolExecutionDto } from '../types';
import { ColombianPlate } from './ColombianPlate';

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: 'sales_advisor' | 'service_advisor' | 'executive_manager';
  contextualPrompt?: string;
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({
  isOpen,
  onClose,
  initialRole = 'sales_advisor',
  contextualPrompt,
}) => {
  const [role, setRole] = useState<'sales_advisor' | 'service_advisor' | 'executive_manager'>(
    initialRole,
  );
  const [activeTab, setActiveTab] = useState<'chat' | 'approvals' | 'tools'>('chat');
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      content:
        '¡Hola! Soy MIA, tu copiloto de inteligencia artificial automotriz. Estoy conectada a la capa semántica gobernada bajo PostgreSQL RLS (Decisión D-16) y sigo la política de autonomía D-15. ¿En qué te puedo apoyar hoy?',
      timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [tools, setTools] = useState<AiToolMetadataDto[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialRole) {
      setRole(initialRole);
    }
  }, [initialRole]);

  useEffect(() => {
    if (contextualPrompt && isOpen) {
      setInputMessage(contextualPrompt);
    }
  }, [contextualPrompt, isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadTools(role);
      loadPendingApprovals();
    }
  }, [isOpen, role]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const loadTools = async (selectedRole: string) => {
    try {
      const data = await fetchAiTools(selectedRole);
      setTools(data);
    } catch (e) {
      console.error('Error cargando tools:', e);
    }
  };

  const loadPendingApprovals = async () => {
    try {
      const data = await fetchPendingAiApprovals();
      setPendingApprovals(data);
    } catch (e) {
      console.error('Error cargando aprobaciones pendientes:', e);
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputMessage.trim();
    if (!textToSend || loading) return;

    const userMsg: CopilotMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    try {
      const history = messages.slice(-5).map((m) => ({
        role: (m.sender === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.content,
      }));

      const res = await chatWithCopilot({
        role,
        message: textToSend,
        conversationHistory: history,
      });

      const assistantMsg: CopilotMessage = {
        id: crypto.randomUUID(),
        sender: 'assistant',
        content: res.response,
        toolExecutions: res.toolExecutions,
        pendingApprovals: res.pendingApprovals,
        timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      if (res.pendingApprovals && res.pendingApprovals.length > 0) {
        loadPendingApprovals();
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: 'assistant',
          content: `⚠️ Error de comunicación con el motor de IA: ${err.message}`,
          timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveProposal = async (executionId: string, action: 'approve' | 'reject') => {
    try {
      await approveAiExecution({ executionId, action });
      loadPendingApprovals();

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: 'system',
          content:
            action === 'approve'
              ? '✅ Propuesta confirmada y aprobada por el asesor humano.'
              : '❌ Propuesta rechazada por el asesor.',
          timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      alert(`Error al procesar: ${err.message}`);
    }
  };

  const getRoleQuickPills = () => {
    if (role === 'sales_advisor') {
      return [
        {
          label: '🚨 ¿Qué leads tienen SLA crítico hoy?',
          prompt: '¿Qué hago hoy con mis leads y cuáles tienen SLA en riesgo de vencimiento?',
        },
        {
          label: '🚗 Consultar vehículo y retoma',
          prompt: 'Consulta el estado 360 del vehículo con placa ABC123',
        },
        {
          label: '💬 Redactar WhatsApp de seguimiento',
          prompt: 'Redacta un mensaje de WhatsApp para seguimiento de cotización a un cliente',
        },
        {
          label: '📝 Crear recordatorio de llamada',
          prompt: 'Crea una tarea para hacer seguimiento a la cotización de cliente mañana',
        },
      ];
    }
    if (role === 'service_advisor') {
      return [
        {
          label: '🔧 ¿Qué vehículos deben ingresar al taller?',
          prompt: '¿Cuáles son los vehículos que tienen servicio preventivo próximo o vencido?',
        },
        {
          label: '📅 Agendar cita taller para cliente',
          prompt:
            'Prepara una solicitud de agendamiento de cita en taller para el vehículo con placa ABC123',
        },
        {
          label: '⏱️ Consultar estado odómetro y proyección',
          prompt: 'Consulta el estado de mantenimiento y proyección para el vehículo ABC123',
        },
        {
          label: '💬 Mensaje WhatsApp para servicio',
          prompt: 'Redactar un mensaje de WhatsApp recordando el mantenimiento preventivo',
        },
      ];
    }
    return [
      {
        label: '📈 Tasa de retención de vehículos (D-13)',
        prompt:
          '¿Cómo está la tasa de retención de vehículos del concesionario desglosada por marca?',
      },
      {
        label: '📐 Explicar fórmula del KPI de retención',
        prompt: 'Explica la fórmula matemática y significado de negocio de vehicle_retention_rate',
      },
      {
        label: '⚖️ Lift incremental grupo de control (15%)',
        prompt:
          '¿Cuál es el impacto incremental del grupo de control frente a los vehículos intervenidos (D-39)?',
      },
      {
        label: '⏱️ Cumplimiento de SLA en primer contacto',
        prompt: '¿Cuál es el porcentaje de cumplimiento de SLA en primer contacto de leads?',
      },
    ];
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          height: '100vh',
          backgroundColor: '#0f172a',
          borderLeft: '1px solid #334155',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          color: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#1e293b',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f59e0b, #6366f1, #06b6d4)',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#090d16',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '13px',
                  color: '#facc15',
                  letterSpacing: '1px',
                }}
              >
                MIA
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: 700,
                    color: '#ffffff',
                    letterSpacing: '-0.3px',
                  }}
                >
                  Copiloto Inteligente MIA
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '2px 8px',
                    borderRadius: '999px',
                  }}
                >
                  AI-First • D-15 Gobernado
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Asistencia contextual por rol • Concesionarios y talleres Colombia
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Cerrar Copiloto"
          >
            <svg
              style={{ width: '22px', height: '22px' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Rol y Pestañas */}
        <div
          style={{
            padding: '10px 16px',
            backgroundColor: '#151f30',
            borderBottom: '1px solid #334155',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Rol activo:</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              style={{
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #475569',
                borderRadius: '8px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="sales_advisor">💼 Asesor Comercial (Ventas)</option>
              <option value="service_advisor">🔧 Asesor de Servicio (Posventa)</option>
              <option value="executive_manager">📊 Gerente / Director (KPIs)</option>
            </select>
          </div>

          <div
            style={{
              display: 'flex',
              backgroundColor: '#0f172a',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid #334155',
              gap: '4px',
            }}
          >
            <button
              onClick={() => setActiveTab('chat')}
              style={{
                backgroundColor: activeTab === 'chat' ? '#2563eb' : 'transparent',
                color: activeTab === 'chat' ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Conversación
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              style={{
                backgroundColor: activeTab === 'approvals' ? '#d97706' : 'transparent',
                color: activeTab === 'approvals' ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Aprobaciones</span>
              {pendingApprovals.length > 0 && (
                <span
                  style={{
                    backgroundColor: '#f59e0b',
                    color: '#0f172a',
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: '999px',
                  }}
                >
                  {pendingApprovals.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('tools')}
              style={{
                backgroundColor: activeTab === 'tools' ? '#475569' : 'transparent',
                color: activeTab === 'tools' ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Tools D-15 ({tools.length})
            </button>
          </div>
        </div>

        {/* Body Container */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {activeTab === 'chat' && (
            <>
              {/* Acciones Rápidas */}
              <div
                style={{
                  backgroundColor: '#151f30',
                  borderRadius: '12px',
                  padding: '12px',
                  border: '1px solid #293548',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: '#94a3b8',
                    }}
                  >
                    ⚡ Acciones Rápidas Sugeridas (1-Clic)
                  </span>
                  <span style={{ fontSize: '11px', color: '#38bdf8' }}>Atajos de rol</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {getRoleQuickPills().map((pill, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(pill.prompt)}
                      style={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        color: '#cbd5e1',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#26334d';
                        e.currentTarget.style.borderColor = '#38bdf8';
                        e.currentTarget.style.color = '#ffffff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#1e293b';
                        e.currentTarget.style.borderColor = '#334155';
                        e.currentTarget.style.color = '#cbd5e1';
                      }}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mensajes del Chat */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems:
                        msg.sender === 'user'
                          ? 'flex-end'
                          : msg.sender === 'system'
                            ? 'center'
                            : 'flex-start',
                    }}
                  >
                    {msg.sender === 'system' ? (
                      <div
                        style={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '999px',
                          padding: '4px 14px',
                          fontSize: '11px',
                          color: '#94a3b8',
                          fontStyle: 'italic',
                        }}
                      >
                        {msg.content}
                      </div>
                    ) : (
                      <div
                        style={{
                          maxWidth: '92%',
                          borderRadius:
                            msg.sender === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                          padding: '14px 16px',
                          fontSize: '13px',
                          lineHeight: 1.6,
                          backgroundColor: msg.sender === 'user' ? '#1d4ed8' : '#1e293b',
                          border: msg.sender === 'user' ? 'none' : '1px solid #334155',
                          color: msg.sender === 'user' ? '#ffffff' : '#f1f5f9',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                        }}
                      >
                        <FormattedText content={msg.content} />

                        {/* Renderizado de herramientas ejecutadas con tarjetas visuales */}
                        {msg.toolExecutions && msg.toolExecutions.length > 0 && (
                          <div
                            style={{
                              marginTop: '12px',
                              paddingTop: '12px',
                              borderTop: '1px solid #334155',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#38bdf8',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                              }}
                            >
                              <svg
                                style={{ width: '14px', height: '14px' }}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M13 10V3L4 14h7v7l9-11h-7z"
                                />
                              </svg>
                              <span>Operaciones Gobernadas Ejecutadas (D-15):</span>
                            </div>

                            {msg.toolExecutions.map((tool, tIdx) => (
                              <ToolExecutionVisualCard
                                key={tIdx}
                                execution={tool}
                                onApprove={handleApproveProposal}
                                onSelectLeadPrompt={(prompt) => handleSendMessage(prompt)}
                              />
                            ))}
                          </div>
                        )}

                        <div
                          style={{
                            marginTop: '6px',
                            fontSize: '10px',
                            color: msg.sender === 'user' ? '#93c5fd' : '#64748b',
                            textAlign: 'right',
                          }}
                        >
                          {msg.timestamp}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      padding: '12px 16px',
                      borderRadius: '16px 16px 16px 2px',
                      width: 'fit-content',
                      color: '#38bdf8',
                      fontSize: '12px',
                      fontWeight: 500,
                    }}
                  >
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: '#38bdf8',
                        }}
                      />
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: '#818cf8',
                        }}
                      />
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: '#f59e0b',
                        }}
                      />
                    </div>
                    <span>MIA está consultando tools gobernadas bajo PostgreSQL RLS...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </>
          )}

          {activeTab === 'approvals' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: '#94a3b8',
                  }}
                >
                  Bandeja de Aprobaciones Pendientes (Nivel 2)
                </h3>
                <button
                  onClick={loadPendingApprovals}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#38bdf8',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  🔄 Actualizar
                </button>
              </div>

              {pendingApprovals.length === 0 ? (
                <div
                  style={{
                    padding: '36px 20px',
                    textAlign: 'center',
                    backgroundColor: '#1e293b',
                    borderRadius: '12px',
                    border: '1px dashed #334155',
                    color: '#94a3b8',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>🛡️</div>
                  <strong>No hay propuestas pendientes de aprobación humana.</strong>
                  <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    Las acciones autónomas Nivel 2 aparecerán aquí antes de impactar a clientes o la
                    base de datos.
                  </p>
                </div>
              ) : (
                pendingApprovals.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #d97706',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: '#facc15',
                        }}
                      >
                        {item.tool_name}
                      </span>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: 'rgba(245, 158, 11, 0.2)',
                          color: '#fbbf24',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                        }}
                      >
                        Requiere Aprobación Humana
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', color: '#e2e8f0' }}>
                      {item.result?.actionPrompt || 'Propuesta de acción preparada para confirmación'}
                    </div>

                    {item.result?.messageBody && (
                      <div
                        style={{
                          backgroundColor: '#090d16',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          fontSize: '12px',
                          color: '#94a3b8',
                          fontStyle: 'italic',
                        }}
                      >
                        "{item.result?.messageBody}"
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button
                        onClick={() => handleApproveProposal(item.id, 'approve')}
                        style={{
                          backgroundColor: '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 16px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        ✅ Aprobar y Ejecutar
                      </button>
                      <button
                        onClick={() => handleApproveProposal(item.id, 'reject')}
                        style={{
                          backgroundColor: '#881337',
                          color: '#fecdd3',
                          border: '1px solid #e11d48',
                          borderRadius: '8px',
                          padding: '8px 16px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        ❌ Rechazar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'tools' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                Herramientas autorizadas para el rol{' '}
                <strong style={{ color: '#ffffff' }}>{role}</strong> bajo la Matriz de Tareas D-36
                y Gobernanza D-15:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {tools.map((t) => (
                  <div
                    key={t.name}
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: '#38bdf8',
                        }}
                      >
                        {t.name}
                      </span>
                      <AutonomyBadge level={t.autonomyLevel} />
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
                      {t.description}
                    </p>
                    {t.parameters && t.parameters.length > 0 && (
                      <div
                        style={{
                          marginTop: '4px',
                          fontSize: '11px',
                          color: '#64748b',
                          fontFamily: 'monospace',
                        }}
                      >
                        Parámetros:{' '}
                        {t.parameters.map((p) => `${p.name}${p.required ? '*' : ''}`).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Input */}
        {activeTab === 'chat' && (
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#151f30',
              borderTop: '1px solid #334155',
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={`Pregunta a MIA como ${
                  role === 'sales_advisor'
                    ? 'Asesor Comercial (ej. "leads con SLA", "placa ABC123")...'
                    : role === 'service_advisor'
                      ? 'Asesor de Posventa (ej. "mantenimiento ABC123", "agendar cita")...'
                      : 'Gerente General (ej. "tasa retención", "lift grupo control")...'
                }`}
                disabled={loading}
                style={{
                  flex: 1,
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '13px',
                  color: '#ffffff',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={loading || !inputMessage.trim()}
                style={{
                  backgroundColor: loading || !inputMessage.trim() ? '#1e293b' : '#2563eb',
                  color: loading || !inputMessage.trim() ? '#64748b' : '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: loading || !inputMessage.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <span>Enviar</span>
                <svg
                  style={{ width: '14px', height: '14px' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------
// Subcomponentes visuales especializados para herramientas
// ---------------------------------------------------------

function AutonomyBadge({ level }: { level: number }) {
  const styles: Record<number, { bg: string; color: string; border: string; text: string }> = {
    0: {
      bg: 'rgba(16, 185, 129, 0.15)',
      color: '#34d399',
      border: '1px solid rgba(16, 185, 129, 0.3)',
      text: 'Nivel 0: Solo Lectura',
    },
    1: {
      bg: 'rgba(56, 189, 248, 0.15)',
      color: '#38bdf8',
      border: '1px solid rgba(56, 189, 248, 0.3)',
      text: 'Nivel 1: Escritura Reversible',
    },
    2: {
      bg: 'rgba(245, 158, 11, 0.15)',
      color: '#fbbf24',
      border: '1px solid rgba(245, 158, 11, 0.3)',
      text: 'Nivel 2: Requiere Aprobación',
    },
    3: {
      bg: 'rgba(239, 68, 68, 0.15)',
      color: '#f87171',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      text: 'Nivel 3: Prohibido',
    },
  };

  const current = styles[level] || styles[0];

  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 700,
        backgroundColor: current.bg,
        color: current.color,
        border: current.border,
        textTransform: 'uppercase',
        letterSpacing: '0.4px',
      }}
    >
      {current.text}
    </span>
  );
}

function FormattedText({ content }: { content: string }) {
  // Renderizado limpio de párrafos, listas con viñetas y texto resaltado
  const lines = content.split('\n');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {lines.map((line, idx) => {
        if (!line.trim()) {
          return <div key={idx} style={{ height: '4px' }} />;
        }

        // Si es viñeta
        if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
          const bulletContent = line.trim().replace(/^[•\-]\s*/, '');
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                paddingLeft: '6px',
              }}
            >
              <span style={{ color: '#38bdf8', fontWeight: 800 }}>•</span>
              <span dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(bulletContent) }} />
            </div>
          );
        }

        return (
          <div key={idx} dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(line) }} />
        );
      })}
    </div>
  );
}

function renderInlineMarkdown(text: string): string {
  // Bold **texto**
  let res = text.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #ffffff;">$1</strong>');
  // Italic *texto*
  res = res.replace(/\*(.*?)\*/g, '<em style="color: #cbd5e1;">$1</em>');
  // Monospace `codigo`
  res = res.replace(
    /`(.*?)`/g,
    '<code style="background-color: #090d16; color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 11px; border: 1px solid #334155;">$1</code>',
  );
  return res;
}

interface ToolVisualCardProps {
  execution: AiToolExecutionDto;
  onApprove: (id: string, action: 'approve' | 'reject') => void;
  onSelectLeadPrompt?: (prompt: string) => void;
}

function ToolExecutionVisualCard({ execution, onApprove, onSelectLeadPrompt }: ToolVisualCardProps) {
  const { toolName, autonomyLevel, data, proposal, executionId } = execution;

  // 1. Tarjeta para Vehicle 360 y Mantenimiento
  if (toolName === 'get_vehicle_360' && data?.vehicle) {
    const v = data.vehicle;
    const owner = data.primaryOwner;
    const proj = data.maintenanceProjection;
    const opps = data.activeOpportunities || [];

    return (
      <div
        style={{
          backgroundColor: '#090d16',
          border: '1px solid #334155',
          borderRadius: '10px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ColombianPlate plate={v.current_plate} size="sm" />
            <span style={{ fontWeight: 700, fontSize: '13px', color: '#ffffff' }}>
              {v.make} {v.model} ({v.model_year || 'S/A'})
            </span>
          </div>
          <AutonomyBadge level={autonomyLevel} />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '8px',
            fontSize: '11px',
            backgroundColor: '#151f30',
            padding: '8px 10px',
            borderRadius: '6px',
          }}
        >
          <div>
            <span style={{ color: '#94a3b8' }}>Odómetro: </span>
            <strong style={{ color: '#f8fafc' }}>
              {v.current_mileage ? `${Number(v.current_mileage).toLocaleString('es-CO')} km` : 'N/D'}
            </strong>
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Propietario: </span>
            <strong style={{ color: '#f8fafc' }}>{owner?.name || 'No asignado'}</strong>
          </div>
          {proj && (
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: '#94a3b8' }}>Próx. Servicio Proyectado: </span>
              <span style={{ color: '#facc15', fontWeight: 600 }}>
                {new Date(proj.projected_date).toLocaleDateString('es-CO', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>{' '}
              <span style={{ color: '#64748b' }}>
                (~{proj.projected_mileage ? Number(proj.projected_mileage).toLocaleString('es-CO') + ' km' : ''})
              </span>
            </div>
          )}
        </div>

        {opps.length > 0 && (
          <div
            style={{
              fontSize: '11px',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '6px',
              padding: '6px 10px',
              color: '#c7d2fe',
            }}
          >
            ⚡ <strong>Oportunidad:</strong> {opps[0].title} (Score: {opps[0].score}/100)
          </div>
        )}
      </div>
    );
  }

  // 2. Tarjeta para Mantenimiento Predictivo
  if (toolName === 'get_maintenance_status' && data?.plate) {
    return (
      <div
        style={{
          backgroundColor: '#090d16',
          border: '1px solid #334155',
          borderRadius: '10px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ColombianPlate plate={data.plate} size="sm" />
            <span style={{ fontWeight: 700, fontSize: '13px', color: '#ffffff' }}>
              {data.make} {data.model}
            </span>
          </div>
          <AutonomyBadge level={autonomyLevel} />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#151f30',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
          }}
        >
          <div>
            <div style={{ color: '#94a3b8', fontSize: '10px' }}>ESTADO DE VISITA</div>
            <div
              style={{
                fontWeight: 700,
                color: data.isOverdue ? '#f87171' : data.daysRemaining <= 15 ? '#fbbf24' : '#34d399',
              }}
            >
              {data.isOverdue
                ? `Vencido hace ${Math.abs(data.daysRemaining)} días`
                : `Faltan ${data.daysRemaining} días`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#94a3b8', fontSize: '10px' }}>CONFIANZA (D-35)</div>
            <div style={{ color: '#38bdf8', fontWeight: 600 }}>{data.confidenceText}</div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Tarjeta para Lista de Leads Comerciales y SLA
  if (toolName === 'list_my_leads' && Array.isArray(data)) {
    return (
      <div
        style={{
          backgroundColor: '#090d16',
          border: '1px solid #334155',
          borderRadius: '10px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: '12px', color: '#ffffff' }}>
            📋 Bandeja de Leads Comerciales ({data.length})
          </span>
          <AutonomyBadge level={autonomyLevel} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {data.slice(0, 4).map((lead: any) => {
            const isBreached = lead.slaBreached;
            const isCritical = lead.slaCritical;
            const slaColor = isBreached ? '#ef4444' : isCritical ? '#f59e0b' : '#10b981';
            const slaLabel = isBreached
              ? `Vencido hace ${Math.abs(lead.minutesRemainingSla || 0)}m`
              : `SLA: ${lead.minutesRemainingSla || 0}m`;

            return (
              <div
                key={lead.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#151f30',
                  border: `1px solid ${isCritical || isBreached ? slaColor : '#334155'}`,
                  borderRadius: '6px',
                  padding: '8px 10px',
                  fontSize: '11px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: '#ffffff' }}>{lead.fullName}</div>
                  <div style={{ color: '#94a3b8', fontSize: '10px' }}>
                    {lead.interestedVehicleModel || 'Interés general'} • Canal: {lead.channel}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: `${slaColor}25`,
                      color: slaColor,
                      fontWeight: 700,
                      fontSize: '10px',
                    }}
                  >
                    {slaLabel}
                  </span>
                  {onSelectLeadPrompt && (
                    <button
                      onClick={() =>
                        onSelectLeadPrompt(
                          `Redacta un mensaje de WhatsApp para el lead ${lead.fullName} (${lead.phone || ''}) interesado en ${lead.interestedVehicleModel || 'vehículo'}`,
                        )
                      }
                      style={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #475569',
                        color: '#38bdf8',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                      title="Redactar mensaje"
                    >
                      💬 WhatsApp
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 4. Tarjeta para Métricas Gobernadas (query_metric / explain_metric)
  if ((toolName === 'query_metric' || toolName === 'explain_metric') && data) {
    const isQuery = toolName === 'query_metric';
    return (
      <div
        style={{
          backgroundColor: '#090d16',
          border: '1px solid #334155',
          borderRadius: '10px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              fontWeight: 700,
              color: '#38bdf8',
            }}
          >
            {data.kpiCode || data.name}
          </span>
          <AutonomyBadge level={autonomyLevel} />
        </div>

        {isQuery && (data.currentValue !== undefined || data.globalValue !== undefined) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '8px',
              margin: '4px 0',
            }}
          >
            <span style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff' }}>
              {data.currentValue?.formatted ||
                (data.unit === 'percentage'
                  ? `${Number(data.currentValue?.value ?? data.globalValue).toFixed(1)}%`
                  : `$ ${Number(data.currentValue?.value ?? data.globalValue).toLocaleString('es-CO')}`)}
            </span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              {data.kpiName || 'Valor Consolidado'}
            </span>
          </div>
        )}

        <div
          style={{
            backgroundColor: '#151f30',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '11px',
            fontFamily: 'monospace',
            color: '#a5b4fc',
            border: '1px solid #293548',
          }}
        >
          Fórmula: {data.formula || 'Gobernada en capa semántica'}
        </div>

        {(data.breakdowns || data.breakdown) &&
          Array.isArray(data.breakdowns || data.breakdown) &&
          (data.breakdowns || data.breakdown).length > 0 && (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}
            >
              {(data.breakdowns || data.breakdown).slice(0, 5).map((b: any, bIdx: number) => {
                const pct =
                  typeof b.percentage === 'number'
                    ? b.percentage
                    : typeof b.value === 'number'
                      ? Math.min(100, Math.max(0, b.value))
                      : 50;
                const formattedVal =
                  b.formatted || (typeof b.value === 'number' ? `${b.value}%` : b.value);
                const label = b.label || b.dimensionValue || b.key || 'Segmento';
                return (
                  <div key={bIdx} style={{ fontSize: '11px' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '2px',
                      }}
                    >
                      <span style={{ color: '#cbd5e1' }}>{label}</span>
                      <strong style={{ color: '#ffffff' }}>{formattedVal}</strong>
                    </div>
                    <div
                      style={{
                        height: '4px',
                        backgroundColor: '#1e293b',
                        borderRadius: '2px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          backgroundColor: '#38bdf8',
                          borderRadius: '2px',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    );
  }

  // 5. Tarjeta para Propuestas Nivel 2 (WhatsApp o Cita de Taller)
  if (proposal) {
    return (
      <div
        style={{
          backgroundColor: '#090d16',
          border: '1px solid #d97706',
          borderRadius: '10px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#facc15' }}>
            ⚡ Propuesta de Acción Exterior
          </span>
          <AutonomyBadge level={autonomyLevel} />
        </div>

        <p style={{ margin: 0, fontSize: '12px', color: '#e2e8f0', fontWeight: 500 }}>
          {proposal.actionPrompt || 'Propuesta estructurada'}
        </p>

        {proposal.messageBody && (
          <div
            style={{
              backgroundColor: '#0b141a',
              border: '1px solid #005c4b',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '12px',
              color: '#e9edef',
              position: 'relative',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                color: '#25d366',
                fontWeight: 700,
                marginBottom: '4px',
                textTransform: 'uppercase',
              }}
            >
              Vista Previa WhatsApp
            </div>
            "{proposal.messageBody}"
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
          {proposal.waMeUrl && (
            <a
              href={proposal.waMeUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                backgroundColor: '#25d366',
                color: '#090d16',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '11px',
                padding: '6px 12px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>Abrir WhatsApp Web</span>
              <svg style={{ width: '12px', height: '12px' }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.072-2.146-.525-1.745-.718-2.883-2.483-2.97-2.599-.088-.116-.71-1.026-.71-1.956 0-.93.486-1.385.659-1.574.173-.189.378-.237.504-.237.126 0 .252.001.36.006.115.006.269-.044.421.32.158.378.539 1.314.586 1.409.047.095.079.206.016.332-.063.126-.095.205-.189.316-.095.11-.199.246-.284.331-.095.095-.194.198-.083.389.111.191.493.813 1.057 1.316.726.647 1.339.847 1.53.942.191.095.302.079.414-.047.111-.126.475-.553.602-.743.126-.19.253-.158.428-.095.174.063 1.109.522 1.299.617.19.095.317.143.364.222.048.079.048.459-.096.864z" />
              </svg>
            </a>
          )}

          {executionId && (
            <button
              onClick={() => onApprove(executionId, 'approve')}
              style={{
                backgroundColor: '#d97706',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Confirmar Envío
            </button>
          )}
        </div>
      </div>
    );
  }

  // 6. Tarjeta para Tareas de Asesor (create_task_for_me)
  if (toolName === 'create_task_for_me' && data) {
    return (
      <div
        style={{
          backgroundColor: '#090d16',
          border: '1px solid #0284c7',
          borderRadius: '10px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8' }}>
            📌 Tarea Personal Agendada
          </span>
          <AutonomyBadge level={autonomyLevel} />
        </div>
        <div style={{ fontSize: '12px', color: '#ffffff', fontWeight: 600 }}>
          {data.title || 'Nueva tarea'}
        </div>
        {data.dueDate && (
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            Vence:{' '}
            {new Date(data.dueDate).toLocaleDateString('es-CO', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        )}
      </div>
    );
  }

  // Fallback si la herramienta no tiene tarjeta especializada
  return (
    <div
      style={{
        backgroundColor: '#090d16',
        border: '1px solid #334155',
        borderRadius: '8px',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#38bdf8' }}>
          {toolName}
        </span>
        <AutonomyBadge level={autonomyLevel} />
      </div>
      {data && (
        <details style={{ fontSize: '11px', color: '#94a3b8' }}>
          <summary style={{ cursor: 'pointer', color: '#38bdf8' }}>Ver datos crudos</summary>
          <pre
            style={{
              backgroundColor: '#000000',
              padding: '6px',
              borderRadius: '4px',
              fontSize: '10px',
              overflowX: 'auto',
              maxHeight: '120px',
              color: '#94a3b8',
              margin: '4px 0 0 0',
            }}
          >
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
