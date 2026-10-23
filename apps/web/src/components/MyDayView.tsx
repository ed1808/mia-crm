import React, { useEffect, useState } from 'react';
import type { OpportunityItem } from '../types';
import { fetchOpportunities, updateOpportunityStatus } from '../api';
import { ColombianPlate } from './ColombianPlate';
import { ContactAssistantModal } from './ContactAssistantModal';
import { AppointmentBookingModal } from './AppointmentBookingModal';

const RULE_NAMES: Record<string, { label: string; icon: string; color: string }> = {
  'R-MNT-01': { label: 'Mantenimiento Próximo', icon: '⏱️', color: '#0284c7' },
  'R-MNT-02': { label: 'Mantenimiento Vencido', icon: '⚠️', color: '#e11d48' },
  'R-MNT-03': { label: 'Riesgo de Churn (>1 año)', icon: '🔄', color: '#d97706' },
  'R-WAR-01': { label: 'Fin de Garantía Próximo', icon: '🛡️', color: '#7c3aed' },
  'R-RET-01': { label: 'Renovación / Retoma', icon: '🤝', color: '#059669' },
  'R-FLT-01': { label: 'Consolidación de Flota', icon: '🚛', color: '#2563eb' },
  'R-RTM-01': { label: 'Revisión RTM Legal (D-47)', icon: '📋', color: '#ea580c' },
};

export function MyDayView({ onSelectVehicle }: { onSelectVehicle?: (vehicleId: string) => void }) {
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRule, setSelectedRule] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('detected,in_progress,appointment_requested');
  const [showControlGroup, setShowControlGroup] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Estados de modales interactivos
  const [contactOpp, setContactOpp] = useState<OpportunityItem | null>(null);
  const [bookingOpp, setBookingOpp] = useState<OpportunityItem | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchOpportunities({
        ruleId: selectedRule || undefined,
        status: statusFilter,
        isControlGroup: showControlGroup ? undefined : false,
      });
      setOpportunities(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar oportunidades');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedRule, statusFilter, showControlGroup]);

  const handleAction = async (
    oppId: string,
    action: 'start_progress' | 'request_appointment' | 'convert' | 'reject' | 'expire',
    reason?: string
  ) => {
    try {
      await updateOpportunityStatus(oppId, action, reason);
      const actionLabels = {
        start_progress: 'Oportunidad tomada en gestión.',
        request_appointment: 'Cita de taller solicitada exitosamente.',
        convert: '¡Oportunidad convertida en ingreso de posventa!',
        reject: 'Oportunidad rechazada. Se activó cooldown de contacto por 45 días (D-38).',
        expire: 'Oportunidad marcada como expirada.',
      };
      setActionMessage(actionLabels[action]);
      setTimeout(() => setActionMessage(null), 5000);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  const formatCOP = (val?: number | null) => {
    if (!val) return '$ 0 COP';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Banner de mensaje de acción */}
      {actionMessage && (
        <div
          style={{
            backgroundColor: '#065f46',
            color: '#a7f3d0',
            padding: '0.85rem 1.25rem',
            borderRadius: '8px',
            border: '1px solid #10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>✅ {actionMessage}</span>
          <button
            onClick={() => setActionMessage(null)}
            style={{ background: 'transparent', border: 'none', color: '#a7f3d0', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Barra de Filtros */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          backgroundColor: '#1e293b',
          padding: '1rem 1.25rem',
          borderRadius: '8px',
          border: '1px solid #334155',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Regla:</span>
          <select
            value={selectedRule}
            onChange={(e) => setSelectedRule(e.target.value)}
            style={{
              backgroundColor: '#0f172a',
              color: '#f8fafc',
              border: '1px solid #475569',
              borderRadius: '6px',
              padding: '0.4rem 0.75rem',
              fontSize: '0.85rem',
            }}
          >
            <option value="">Todas las reglas</option>
            {Object.entries(RULE_NAMES).map(([id, info]) => (
              <option key={id} value={id}>
                {info.icon} {id} — {info.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Estado:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              backgroundColor: '#0f172a',
              color: '#f8fafc',
              border: '1px solid #475569',
              borderRadius: '6px',
              padding: '0.4rem 0.75rem',
              fontSize: '0.85rem',
            }}
          >
            <option value="detected,in_progress,appointment_requested">Activas (Mi Día)</option>
            <option value="detected">Solo Detectadas</option>
            <option value="in_progress">En Gestión</option>
            <option value="appointment_requested">Cita Solicitada</option>
            <option value="converted">Convertidas</option>
            <option value="rejected">Rechazadas</option>
          </select>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: '#cbd5e1' }}>
          <input
            type="checkbox"
            checked={showControlGroup}
            onChange={(e) => setShowControlGroup(e.target.checked)}
            style={{ accentColor: '#8b5cf6' }}
          />
          Incluir Grupo de Control (15%)
        </label>

        <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#94a3b8' }}>
          Mostrando <strong>{opportunities.length}</strong> oportunidades
        </div>
      </div>

      {/* Contenido de la lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          Cargando oportunidades predictivas de Mi Día...
        </div>
      ) : error ? (
        <div style={{ backgroundColor: '#7f1d1d', color: '#fecaca', padding: '1rem', borderRadius: '8px' }}>
          {error}
        </div>
      ) : opportunities.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '3rem',
            backgroundColor: '#1e293b',
            borderRadius: '8px',
            border: '1px dashed #475569',
            color: '#94a3b8',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✨</div>
          <div style={{ fontWeight: 600, color: '#f1f5f9' }}>¡Al día! No hay oportunidades pendientes en este filtro.</div>
          <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
            A medida que el ERP envíe órdenes de trabajo o se cumplan los tiempos de proyección, se detectarán automáticamente.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {opportunities.map((opp) => {
            const ruleMeta = RULE_NAMES[opp.rule_id] || { label: opp.rule_id, icon: '⚡', color: '#38bdf8' };
            const scoreColor = opp.score >= 80 ? '#10b981' : opp.score >= 65 ? '#f59e0b' : '#38bdf8';

            return (
              <div
                key={opp.id}
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: '10px',
                  border: opp.is_control_group ? '2px solid #8b5cf6' : '1px solid #334155',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
                  position: 'relative',
                }}
              >
                {/* Cabecera de la tarjeta */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <ColombianPlate plate={opp.vehicle_plate} size="md" />
                    <div>
                      <span
                        onClick={() => onSelectVehicle?.(opp.vehicle_id)}
                        style={{
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          color: '#f8fafc',
                          cursor: onSelectVehicle ? 'pointer' : 'default',
                          textDecoration: onSelectVehicle ? 'underline' : 'none',
                        }}
                        title="Ver Vehicle 360"
                      >
                        {opp.vehicle_make} {opp.vehicle_model} {opp.vehicle_year ? `(${opp.vehicle_year})` : ''}
                      </span>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        VIN: {opp.vehicle_vin || 'Sin VIN'} • Tipo: {opp.vehicle_type} • Km actual:{' '}
                        {opp.vehicle_mileage ? `${opp.vehicle_mileage.toLocaleString()} km` : 'No registrado'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {/* Estado de gestión */}
                    {opp.status === 'in_progress' && (
                      <span
                        style={{
                          backgroundColor: '#0c4a6e',
                          color: '#7dd3fc',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.3rem 0.6rem',
                          borderRadius: '999px',
                          border: '1px solid #0284c7',
                        }}
                      >
                        💬 En Gestión
                      </span>
                    )}

                    {opp.status === 'appointment_requested' && (
                      <span
                        style={{
                          backgroundColor: '#1e3a8a',
                          color: '#93c5fd',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.3rem 0.6rem',
                          borderRadius: '999px',
                          border: '1px solid #3b82f6',
                        }}
                      >
                        📅 Cita Solicitada
                      </span>
                    )}

                    {/* Badge Grupo de Control */}
                    {opp.is_control_group && (
                      <span
                        style={{
                          backgroundColor: '#4c1d95',
                          color: '#e9d5ff',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.3rem 0.6rem',
                          borderRadius: '999px',
                          border: '1px solid #8b5cf6',
                        }}
                        title="Decisión D-39: Grupo de control para medir uplift contrafactual. No contactar comercialmente."
                      >
                        🛡️ Control 15% (No Contactar)
                      </span>
                    )}

                    {/* Badge de la Regla */}
                    <span
                      style={{
                        backgroundColor: '#0f172a',
                        color: ruleMeta.color,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.3rem 0.6rem',
                        borderRadius: '6px',
                        border: `1px solid ${ruleMeta.color}44`,
                      }}
                    >
                      {ruleMeta.icon} {opp.rule_id} — {ruleMeta.label}
                    </span>

                    {/* Pill de Score */}
                    <div
                      style={{
                        backgroundColor: '#0f172a',
                        border: `2px solid ${scoreColor}`,
                        color: scoreColor,
                        borderRadius: '999px',
                        padding: '0.2rem 0.6rem',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                      }}
                      title="Score predictivo de urgencia y valor (0 - 100)"
                    >
                      Score {opp.score}
                    </div>
                  </div>
                </div>

                {/* Sección de Cliente y Evidencia */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '1rem',
                    backgroundColor: '#0f172a',
                    padding: '0.9rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #1e293b',
                  }}
                >
                  {/* Datos del Cliente */}
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                      Titular del Vehículo
                    </div>
                    <div style={{ fontWeight: 600, color: '#f1f5f9', marginTop: '0.25rem' }}>
                      {opp.party_name} {opp.party_is_company ? '(Empresa)' : ''}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      Identificación: {opp.party_id_number || 'Sin documento'}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem', fontSize: '0.85rem' }}>
                      {opp.party_phone ? (
                        <>
                          <button
                            onClick={() => setContactOpp(opp)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#22c55e',
                              cursor: 'pointer',
                              fontWeight: 700,
                              padding: 0,
                              fontSize: '0.85rem',
                            }}
                          >
                            💬 Contactar WhatsApp
                          </button>
                          <a href={`tel:${opp.party_phone}`} style={{ color: '#38bdf8', textDecoration: 'none' }}>
                            📞 {opp.party_phone}
                          </a>
                        </>
                      ) : (
                        <span style={{ color: '#64748b' }}>Sin teléfono</span>
                      )}
                      {opp.party_email && (
                        <a href={`mailto:${opp.party_email}`} style={{ color: '#cbd5e1', textDecoration: 'none' }}>
                          ✉️ Correo
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Evidencia y Valor */}
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                      Evidencia Predictiva
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.25rem' }}>
                      {opp.evidence?.daysUntilProjected !== undefined && (
                        <div>
                          Próximo servicio proyectado en <strong>{String(opp.evidence.daysUntilProjected)} días</strong>
                          {opp.evidence?.projectedDate ? ` (${String(opp.evidence.projectedDate)})` : ''}.
                        </div>
                      )}
                      {opp.evidence?.overdueDays !== undefined && (
                        <div style={{ color: '#f87171' }}>
                          Servicio atrasado por <strong>{String(opp.evidence.overdueDays)} días</strong> frente a proyección.
                        </div>
                      )}
                      {opp.evidence?.daysUntilWarrantyEnd !== undefined && (
                        <div>
                          Garantía finaliza en <strong>{String(opp.evidence.daysUntilWarrantyEnd)} días</strong>.
                        </div>
                      )}
                      {opp.evidence?.daysUntilRtm !== undefined && (
                        <div>
                          Revisión RTM legal vence en <strong>{String(opp.evidence.daysUntilRtm)} días</strong>.
                        </div>
                      )}
                      {opp.evidence?.fleetUnitCount !== undefined && (
                        <div>
                          Flota empresarial con <strong>{String(opp.evidence.fleetUnitCount)} unidades</strong> que requieren atención.
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: '#34d399', fontWeight: 700 }}>
                      Valor estimado: {formatCOP(opp.value_estimate)}
                    </div>
                  </div>
                </div>

                {/* Botones de Acción Interactivos */}
                {!opp.is_control_group && opp.status !== 'converted' && opp.status !== 'rejected' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {/* Botón 1: Asistente de Contacto */}
                    <button
                      onClick={() => setContactOpp(opp)}
                      style={{
                        backgroundColor: opp.status === 'in_progress' ? '#1e293b' : '#0284c7',
                        color: '#ffffff',
                        border: opp.status === 'in_progress' ? '1px solid #38bdf8' : 'none',
                        padding: '0.5rem 1.1rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      💬 {opp.status === 'in_progress' ? 'Ver Asistente de Contacto' : 'Iniciar Contacto'}
                    </button>

                    {/* Botón 2: Agendar Cita en Taller */}
                    <button
                      onClick={() => setBookingOpp(opp)}
                      style={{
                        backgroundColor: opp.status === 'appointment_requested' ? '#1e293b' : '#2563eb',
                        color: '#ffffff',
                        border: opp.status === 'appointment_requested' ? '1px solid #60a5fa' : 'none',
                        padding: '0.5rem 1.1rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      📅 {opp.status === 'appointment_requested' ? 'Reagendar Cita Taller' : 'Agendar Cita Taller'}
                    </button>

                    {/* Botón 3: Marcar Convertida */}
                    <button
                      onClick={() => handleAction(opp.id, 'convert')}
                      style={{
                        backgroundColor: '#059669',
                        color: '#ffffff',
                        border: 'none',
                        padding: '0.5rem 1.1rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                      }}
                    >
                      ✓ Marcar Convertida
                    </button>

                    {/* Botón 4: Rechazar */}
                    <button
                      onClick={() => setContactOpp(opp)}
                      style={{
                        backgroundColor: 'transparent',
                        color: '#f87171',
                        border: '1px solid #f8717144',
                        padding: '0.5rem 0.85rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      ✕ Rechazar
                    </button>
                  </div>
                )}

                {opp.status === 'rejected' && (
                  <div style={{ fontSize: '0.8rem', color: '#f87171', backgroundColor: '#450a0a', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                    Motivo de rechazo: {opp.rejection_reason || 'Rechazado'} (Bajo cooldown de contacto activo de 45 días)
                  </div>
                )}

                {opp.status === 'converted' && (
                  <div style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 600, backgroundColor: '#064e3b', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                    ✓ Oportunidad convertida en ingreso de posventa
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal 1: Asistente de Contacto con Guión IA y WhatsApp */}
      {contactOpp && (
        <ContactAssistantModal
          opportunity={contactOpp}
          onClose={() => setContactOpp(null)}
          onAppointmentRequested={() => {
            const target = contactOpp;
            setContactOpp(null);
            setBookingOpp(target);
          }}
          onMarkInProgress={() => {
            handleAction(contactOpp.id, 'start_progress');
            setContactOpp(null);
          }}
          onReject={(reason) => {
            handleAction(contactOpp.id, 'reject', reason);
            setContactOpp(null);
          }}
        />
      )}

      {/* Modal 2: Agendamiento de Cita en Taller (D-19) */}
      {bookingOpp && (
        <AppointmentBookingModal
          opportunity={bookingOpp}
          onClose={() => setBookingOpp(null)}
          onSuccess={() => {
            handleAction(bookingOpp.id, 'request_appointment');
          }}
        />
      )}
    </div>
  );
}
