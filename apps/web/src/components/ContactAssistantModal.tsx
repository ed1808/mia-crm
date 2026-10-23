import React, { useState } from 'react';
import type { OpportunityItem } from '../types';
import { ColombianPlate } from './ColombianPlate';

interface ContactAssistantModalProps {
  opportunity: OpportunityItem;
  onClose: () => void;
  onAppointmentRequested: () => void;
  onMarkInProgress: () => void;
  onReject: (reason: string) => void;
}

export function ContactAssistantModal({
  opportunity: opp,
  onClose,
  onAppointmentRequested,
  onMarkInProgress,
  onReject,
}: ContactAssistantModalProps) {
  // Generar borrador contextual sugerido por IA según la regla predictiva
  const getDefaultMessage = () => {
    const owner = opp.party_name;
    const vehicle = `${opp.vehicle_make} ${opp.vehicle_model}`;
    const plate = opp.vehicle_plate || '';

    switch (opp.rule_id) {
      case 'R-MNT-01':
        return `Hola ${owner}, te saludamos de Los Coches Taller Posventa. Queremos recordarte que tu ${vehicle} (${plate}) está próximo a cumplir el kilometraje para su mantenimiento preventivo de acuerdo con nuestra proyección técnica. ¿Te gustaría que reservemos tu cita esta semana para asegurar tu turno prioritario?`;
      case 'R-MNT-02':
        return `Hola ${owner}, te saludamos de Los Coches Taller. Notamos que tu ${vehicle} (${plate}) tiene pendiente su mantenimiento periódico preventivo desde hace algunos días. Mantenerlo al día protege su rendimiento y vida útil. ¿Qué día de esta semana te queda cómodo para ingresar al taller?`;
      case 'R-WAR-01':
        return `Hola ${owner}, te saludamos de Los Coches. Te informamos que la garantía de fábrica de tu ${vehicle} (${plate}) está próxima a finalizar. Queremos invitarte a una revisión preventiva completa de cortesía antes del vencimiento para validar que todo esté en perfecto estado sin costo para ti.`;
      case 'R-RTM-01':
        return `Hola ${owner}, te recordamos desde Los Coches que la Revisión Técnico-Mecánica (RTM) obligatoria de tu ${vehicle} (${plate}) está próxima a vencer. Te invitamos a agendar tu cita de inspección con nosotros para evitar contratiempos y multas de tránsito.`;
      case 'R-RET-01':
        return `Hola ${owner}, te saludamos de Los Coches. Tu ${vehicle} (${plate}) modelo ${opp.vehicle_year || ''} cuenta actualmente con una excelente valoración comercial de retoma. Si has pensado en estrenar un modelo 0 km, tenemos una oferta especial para ti con condiciones exclusivas de financiamiento.`;
      case 'R-FLT-01':
        return `Estimado equipo de ${owner}, desde Los Coches Taller Corporativo detectamos que varias unidades de su flota (${opp.vehicle_make}) requieren servicio preventivo. Podemos coordinar un esquema de atención escalonada para no afectar la disponibilidad de su operación logística.`;
      case 'R-MNT-03':
        return `Hola ${owner}, hace más de un año no tenemos el gusto de atender tu ${vehicle} (${plate}) en nuestro taller. Para tu próximo mantenimiento queremos ofrecerte un bono especial de cortesía en mano de obra. ¿Te gustaría que verifiquemos disponibilidad de agenda?`;
      default:
        return `Hola ${owner}, te saludamos de Los Coches Taller para hacerte seguimiento del servicio de tu ${vehicle} (${plate}).`;
    }
  };

  const [message, setMessage] = useState(getDefaultMessage());
  const [copied, setCopied] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('Cliente realizó el servicio en otro taller');

  const cleanPhone = opp.party_phone ? opp.party_phone.replace(/\D/g, '') : '';
  const waUrl = cleanPhone
    ? `https://wa.me/57${cleanPhone}?text=${encodeURIComponent(message)}`
    : null;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

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
        zIndex: 1100,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1e293b',
          width: '100%',
          maxWidth: '720px',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <ColombianPlate plate={opp.vehicle_plate} size="md" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc' }}>
                Asistente de Contacto — {opp.party_name}
              </h3>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                {opp.vehicle_make} {opp.vehicle_model} {opp.vehicle_year ? `(${opp.vehicle_year})` : ''} • Regla:{' '}
                <strong style={{ color: '#38bdf8' }}>{opp.rule_id}</strong>
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

        {/* Cuerpo */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Canales disponibles */}
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              backgroundColor: '#0f172a',
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              border: '1px solid #334155',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Canales de Contacto Directo
              </span>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.3rem', fontSize: '0.9rem' }}>
                <span style={{ color: '#f8fafc' }}>
                  📱 Celular: <strong>{opp.party_phone || 'No registrado'}</strong>
                </span>
                {opp.party_email && (
                  <span style={{ color: '#cbd5e1' }}>
                    ✉️ Correo: <strong>{opp.party_email}</strong>
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {waUrl ? (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={onMarkInProgress}
                  style={{
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  💬 Enviar WhatsApp
                </a>
              ) : null}

              {opp.party_phone ? (
                <a
                  href={`tel:${opp.party_phone}`}
                  onClick={onMarkInProgress}
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  📞 Llamar
                </a>
              ) : null}
            </div>
          </div>

          {/* Mensaje contextual sugerido */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>
                🤖 Mensaje / Guión de Conversación Sugerido (Personalizable):
              </label>
              <button
                onClick={copyToClipboard}
                style={{
                  background: 'transparent',
                  border: '1px solid #475569',
                  color: copied ? '#34d399' : '#94a3b8',
                  borderRadius: '4px',
                  padding: '0.2rem 0.6rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                {copied ? '✓ Copiado' : '📋 Copiar texto'}
              </button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              style={{
                width: '100%',
                backgroundColor: '#0f172a',
                color: '#f8fafc',
                border: '1px solid #475569',
                borderRadius: '8px',
                padding: '0.85rem',
                fontSize: '0.9rem',
                lineHeight: '1.4',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Formulario de rechazo desplegable si aplica */}
          {rejecting ? (
            <div
              style={{
                backgroundColor: '#271b2d',
                border: '1px solid #701a75',
                padding: '1rem',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ fontSize: '0.85rem', color: '#f5d0fe', fontWeight: 600 }}>
                Selecciona el motivo por el cual el cliente no toma el servicio:
              </div>
              <select
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                style={{
                  backgroundColor: '#0f172a',
                  color: '#f8fafc',
                  border: '1px solid #86198f',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                }}
              >
                <option value="Cliente realizó el servicio en otro taller">Cliente realizó el servicio en otro taller</option>
                <option value="Cliente vendió el vehículo">Cliente vendió el vehículo</option>
                <option value="Precio muy alto / Sin presupuesto en este momento">Precio muy alto / Sin presupuesto en este momento</option>
                <option value="Inconformidad previa con el servicio del taller">Inconformidad previa con el servicio del taller</option>
                <option value="Número equivocado / No responde">Número equivocado / No responde</option>
              </select>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setRejecting(false)}
                  style={{ background: 'transparent', border: '1px solid #64748b', color: '#cbd5e1', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => onReject(rejectionReason)}
                  style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Confirmar Rechazo y Activar Cooldown (45d)
                </button>
              </div>
            </div>
          ) : (
            /* Botones de Resultado del Contacto */
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #334155', paddingTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <button
                onClick={() => setRejecting(true)}
                style={{
                  background: 'transparent',
                  border: '1px solid #f8717144',
                  color: '#f87171',
                  padding: '0.5rem 0.9rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                ✕ Cliente Rechaza / No Interesado
              </button>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={onMarkInProgress}
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#f1f5f9',
                    border: '1px solid #475569',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                  }}
                >
                  ✓ Dejar en Seguimiento
                </button>

                <button
                  onClick={onAppointmentRequested}
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.4)',
                  }}
                >
                  📅 Agendar Cita en Taller →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
