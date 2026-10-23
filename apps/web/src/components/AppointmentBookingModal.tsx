import React, { useState } from 'react';
import type { OpportunityItem } from '../types';
import { scheduleOpportunityAppointment } from '../api';
import { ColombianPlate } from './ColombianPlate';

interface AppointmentBookingModalProps {
  opportunity: OpportunityItem;
  onClose: () => void;
  onSuccess: () => void;
}

export function AppointmentBookingModal({
  opportunity: opp,
  onClose,
  onSuccess,
}: AppointmentBookingModalProps) {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

  const [date, setDate] = useState<string>(tomorrow);
  const [time, setTime] = useState<string>('08:00');
  const [branch, setBranch] = useState<string>('Sede Principal Calle 26 Bogotá');
  const [serviceType, setServiceType] = useState<string>(() => {
    if (opp.rule_id === 'R-RTM-01') return 'Revisión Técnico-Mecánica (RTM)';
    if (opp.rule_id === 'R-WAR-01') return 'Revisión Preventiva Fin de Garantía';
    if (opp.rule_id === 'R-FLT-01') return 'Mantenimiento Preventivo de Flota';
    return 'Mantenimiento Preventivo Periódico';
  });
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedData, setConfirmedData] = useState<{ id: string; scheduled_at: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const scheduledAt = `${date}T${time}:00`;
      const fullNotes = `Sede: ${branch}. ${notes ? `Obs: ${notes}` : ''}`;
      const appt = await scheduleOpportunityAppointment(opp.id, scheduledAt, fullNotes, serviceType);
      setConfirmedData(appt);
      onSuccess();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al agendar cita');
      setSubmitting(false);
    }
  };

  const cleanPhone = opp.party_phone ? opp.party_phone.replace(/\D/g, '') : '';
  const confirmationWaMessage = confirmedData
    ? `Hola ${opp.party_name}, te confirmamos tu cita de taller en ${branch} para tu ${opp.vehicle_make} ${opp.vehicle_model} (${opp.vehicle_plate}) el día ${date} a las ${time} (${serviceType}). ¡Te esperamos!`
    : '';
  const waUrl = cleanPhone
    ? `https://wa.me/57${cleanPhone}?text=${encodeURIComponent(confirmationWaMessage)}`
    : null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1200,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1e293b',
          width: '100%',
          maxWidth: '640px',
          borderRadius: '12px',
          border: '1px solid #475569',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #334155',
            backgroundColor: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <ColombianPlate plate={opp.vehicle_plate} size="md" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc' }}>
                Agendar Cita en Taller (Decisión D-19)
              </h3>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                {opp.vehicle_make} {opp.vehicle_model} • Cliente: {opp.party_name}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Pantalla de Éxito o Formulario */}
        {confirmedData ? (
          <div style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center' }}>
            <div style={{ fontSize: '3rem' }}>🎉</div>
            <h3 style={{ margin: 0, color: '#34d399', fontSize: '1.35rem' }}>
              ¡Cita de Taller Agendada con Éxito!
            </h3>
            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', maxWidth: '480px', lineHeight: '1.5', margin: 0 }}>
              La solicitud fue registrada en el sistema con origen <strong>CRM</strong> y vinculada a la oportunidad. Se ha
              reservado el cupo para el <strong>{date}</strong> a las <strong>{time}</strong> en {branch}.
            </p>

            <div style={{ backgroundColor: '#0f172a', padding: '0.85rem 1.25rem', borderRadius: '8px', border: '1px solid #334155', fontSize: '0.85rem', color: '#94a3b8' }}>
              ID de Cita: <code>{confirmedData.id}</code>
            </div>

            <div style={{ display: 'flex', gap: '0.85rem', marginTop: '0.5rem' }}>
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    padding: '0.6rem 1.2rem',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  💬 Enviar Comprobante por WhatsApp
                </a>
              )}

              <button
                onClick={onClose}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.6rem 1.5rem',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            {/* Sede y Servicio */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Sede de Taller:
                </label>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#0f172a',
                    color: '#f8fafc',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    padding: '0.5rem',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="Sede Principal Calle 26 Bogotá">Sede Principal Calle 26 (Bogotá)</option>
                  <option value="Sede Taller Pesados Yumbo">Sede Taller Pesados Yumbo (Cali)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Tipo de Servicio:
                </label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#0f172a',
                    color: '#f8fafc',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    padding: '0.5rem',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="Mantenimiento Preventivo Periódico">Mantenimiento Preventivo Periódico</option>
                  <option value="Revisión Técnico-Mecánica (RTM)">Revisión Técnico-Mecánica (RTM)</option>
                  <option value="Revisión Preventiva Fin de Garantía">Revisión Preventiva Fin de Garantía</option>
                  <option value="Mantenimiento Preventivo de Flota">Mantenimiento Preventivo de Flota</option>
                  <option value="Diagnóstico de Frenos / Suspensión">Diagnóstico de Frenos / Suspensión</option>
                  <option value="Reparación General">Reparación General</option>
                </select>
              </div>
            </div>

            {/* Fecha y Hora */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Fecha Preferida:
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    backgroundColor: '#0f172a',
                    color: '#f8fafc',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    padding: '0.5rem',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Hora / Turno:
                </label>
                <select
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#0f172a',
                    color: '#f8fafc',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    padding: '0.5rem',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="07:30">07:30 AM (Turno mañana temprano)</option>
                  <option value="08:30">08:30 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="11:30">11:30 AM</option>
                  <option value="14:00">02:00 PM (Turno tarde)</option>
                  <option value="15:30">03:30 PM</option>
                </select>
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '0.4rem' }}>
                Observaciones para el Asesor de Servicio / Jefe de Taller (Opcional):
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. El cliente solicita revisar pastillas de freno delanteras y cambio de plumillas..."
                rows={3}
                style={{
                  width: '100%',
                  backgroundColor: '#0f172a',
                  color: '#f8fafc',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  padding: '0.5rem',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Botones de acción */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  backgroundColor: 'transparent',
                  color: '#94a3b8',
                  border: '1px solid #475569',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  backgroundColor: submitting ? '#64748b' : '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.5rem 1.5rem',
                  borderRadius: '6px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                {submitting ? 'Registrando...' : '📅 Confirmar y Registrar Cita'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
