import React, { useEffect, useState } from 'react';
import type { VehicleSummary, Vehicle360Data } from '../types';
import { fetchVehicles, fetchVehicle360 } from '../api';
import { ColombianPlate } from './ColombianPlate';

export function Vehicle360View({ selectedVehicleId, onCloseModal }: { selectedVehicleId?: string | null; onCloseModal?: () => void }) {
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('');
  const [detailData, setDetailData] = useState<Vehicle360Data | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeModalId, setActiveModalId] = useState<string | null>(selectedVehicleId ?? null);

  const loadList = async () => {
    try {
      setLoading(true);
      const data = await fetchVehicles(search || undefined, vehicleTypeFilter || undefined);
      setVehicles(data);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, [search, vehicleTypeFilter]);

  useEffect(() => {
    if (selectedVehicleId) {
      openDetail(selectedVehicleId);
    }
  }, [selectedVehicleId]);

  const openDetail = async (id: string) => {
    try {
      setActiveModalId(id);
      setLoadingDetail(true);
      const data = await fetchVehicle360(id);
      setDetailData(data);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al cargar Vehicle 360');
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setActiveModalId(null);
    setDetailData(null);
    onCloseModal?.();
  };

  const formatConfidence = (level?: string | null) => {
    if (level === 'high') return { label: 'Alta', color: '#10b981' };
    if (level === 'medium') return { label: 'Media', color: '#f59e0b' };
    return { label: 'Baja', color: '#94a3b8' };
  };

  const formatMethod = (method?: string | null) => {
    if (method === 'own_history') return 'Historial Propio (Mediana de días D-35)';
    if (method === 'cohort') return 'Cohorte (Modelo / Flota D-35)';
    if (method === 'plan') return 'Plan Estándar (Fabricante)';
    return method || 'N/A';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Barra de búsqueda y filtros */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          backgroundColor: '#1e293b',
          padding: '1rem 1.25rem',
          borderRadius: '8px',
          border: '1px solid #334155',
        }}
      >
        <input
          type="text"
          placeholder="Buscar por placa, VIN, marca, modelo o cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: '260px',
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            border: '1px solid #475569',
            borderRadius: '6px',
            padding: '0.5rem 0.85rem',
            fontSize: '0.9rem',
          }}
        />

        <select
          value={vehicleTypeFilter}
          onChange={(e) => setVehicleTypeFilter(e.target.value)}
          style={{
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            border: '1px solid #475569',
            borderRadius: '6px',
            padding: '0.5rem 0.85rem',
            fontSize: '0.9rem',
          }}
        >
          <option value="">Todos los tipos</option>
          <option value="car">Automóvil / Liviano</option>
          <option value="truck">Camión / Pesado</option>
          <option value="bus">Bus / Pasajeros</option>
          <option value="pickup">Pickup</option>
        </select>

        <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
          {vehicles.length} vehículos encontrados
        </span>
      </div>

      {/* Grid de vehículos */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          Consultando parque de vehículos...
        </div>
      ) : vehicles.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '3rem',
            backgroundColor: '#1e293b',
            borderRadius: '8px',
            color: '#94a3b8',
          }}
        >
          No se encontraron vehículos registrados con esos criterios.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
          {vehicles.map((v) => {
            const conf = formatConfidence(v.confidence_level);
            const oppCount = Number(v.active_opportunities_count ?? '0');

            return (
              <div
                key={v.id}
                onClick={() => openDetail(v.id)}
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, transform 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#38bdf8';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#334155';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Placa y Tipo */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <ColombianPlate plate={v.current_plate} size="md" />
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        backgroundColor: '#0f172a',
                        color: '#94a3b8',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                      }}
                    >
                      {v.vehicle_type}
                    </span>
                    {oppCount > 0 && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          backgroundColor: '#0284c7',
                          color: '#ffffff',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '999px',
                          fontWeight: 700,
                        }}
                        title={`${oppCount} oportunidad(es) activa(s)`}
                      >
                        ⚡ {oppCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Marca / Modelo / Año */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc' }}>
                    {v.make} {v.model} {v.model_year ? `(${v.model_year})` : ''}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                    VIN: {v.vin || 'Sin VIN'}
                  </div>
                </div>

                {/* Propietario */}
                <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                  <span style={{ color: '#64748b' }}>Titular: </span>
                  <strong>{v.owner_name || 'Sin titular asignado'}</strong>
                </div>

                {/* Odómetro y Próxima Visita */}
                <div
                  style={{
                    backgroundColor: '#0f172a',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Odómetro:</span>
                    <strong style={{ color: '#f1f5f9' }}>
                      {v.current_mileage ? `${v.current_mileage.toLocaleString()} km` : 'No registrado'}
                    </strong>
                  </div>
                  {v.projected_date && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#94a3b8' }}>Próx. Servicio:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <strong style={{ color: '#38bdf8' }}>{v.projected_date}</strong>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: conf.color,
                            backgroundColor: `${conf.color}22`,
                            padding: '1px 5px',
                            borderRadius: '3px',
                          }}
                        >
                          {conf.label}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal / Drawer Vehicle 360 */}
      {activeModalId && (
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
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={closeDetail}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              width: '100%',
              maxWidth: '900px',
              maxHeight: '90vh',
              borderRadius: '12px',
              border: '1px solid #475569',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#0f172a',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <ColombianPlate plate={detailData?.vehicle.current_plate} size="lg" />
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc' }}>
                    {detailData?.vehicle.make} {detailData?.vehicle.model}{' '}
                    {detailData?.vehicle.model_year ? `(${detailData?.vehicle.model_year})` : ''}
                  </h2>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    VIN: {detailData?.vehicle.vin} • Tipo: {detailData?.vehicle.vehicle_type} • ID Inmutable:{' '}
                    {detailData?.vehicle.id}
                  </div>
                </div>
              </div>
              <button
                onClick={closeDetail}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.25rem',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {loadingDetail || !detailData ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  Cargando expediente 360 del vehículo...
                </div>
              ) : (
                <>
                  {/* Resumen Superior */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>TITULAR ACTUAL (VIGENTE)</div>
                      <div style={{ fontWeight: 600, color: '#f8fafc', marginTop: '0.3rem' }}>
                        {detailData.ownership.currentPrimaryOwner?.party_name || 'Sin titular'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        {detailData.ownership.currentPrimaryOwner?.id_type}:{' '}
                        {detailData.ownership.currentPrimaryOwner?.id_number}
                      </div>
                      {detailData.ownership.currentPrimaryOwner?.phone && (
                        <div style={{ fontSize: '0.8rem', color: '#38bdf8', marginTop: '0.2rem' }}>
                          Tel: {detailData.ownership.currentPrimaryOwner.phone}
                        </div>
                      )}
                    </div>

                    <div style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>USO Y KILOMETRAJE</div>
                      <div style={{ fontWeight: 600, color: '#38bdf8', fontSize: '1.25rem', marginTop: '0.3rem' }}>
                        {detailData.vehicle.current_mileage
                          ? `${detailData.vehicle.current_mileage.toLocaleString()} km`
                          : 'Sin lecturas'}
                      </div>
                      {detailData.vehicle.current_operating_hours && (
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          Horómetro: {detailData.vehicle.current_operating_hours} hrs
                        </div>
                      )}
                    </div>

                    <div style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>PRÓXIMA VISITA PROYECTADA (D-35)</div>
                      <div style={{ fontWeight: 600, color: '#10b981', fontSize: '1.15rem', marginTop: '0.3rem' }}>
                        {detailData.projection?.projected_date || 'Sin proyección calculada'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        Método: {formatMethod(detailData.projection?.projection_method)}
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>FECHAS CRÍTICAS</div>
                      <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.3rem' }}>
                        Fin Garantía: {detailData.vehicle.warranty_end_date || 'No registrada'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                        Vencimiento RTM: {detailData.vehicle.rtm_due_date || 'No registrada'}
                      </div>
                    </div>
                  </div>

                  {/* Historial de Relaciones de Propiedad (D-43) */}
                  <div>
                    <h3 style={{ fontSize: '1rem', color: '#f1f5f9', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
                      Historial de Propiedad y Titulares (Decisión D-43)
                    </h3>
                    {detailData.ownership.history.length === 0 ? (
                      <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Sin historial registrado.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {detailData.ownership.history.map((h) => (
                          <div
                            key={h.id}
                            style={{
                              backgroundColor: h.valid_to ? '#1e293b' : '#0f172a',
                              border: h.valid_to ? '1px solid #334155' : '1px solid #10b981',
                              padding: '0.75rem 1rem',
                              borderRadius: '6px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <strong style={{ color: '#f8fafc' }}>{h.party_name}</strong> ({h.role}
                              {h.is_primary ? ' - Propietario Principal' : ''})
                              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                Vigencia: {h.valid_from} {h.valid_to ? `hasta ${h.valid_to}` : '(Actualmente Vigente)'} •
                                Participación: {h.share_pct}%
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                color: h.valid_to ? '#94a3b8' : '#10b981',
                                fontWeight: 700,
                              }}
                            >
                              {h.valid_to ? 'Histórico' : 'Vigente'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Línea de Tiempo de Posventa / Órdenes de Trabajo (D-46) */}
                  <div>
                    <h3 style={{ fontSize: '1rem', color: '#f1f5f9', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
                      Historial de Taller / Órdenes de Trabajo ERP (Decisión D-46)
                    </h3>
                    {detailData.workOrders.length === 0 ? (
                      <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No hay órdenes de taller registradas aún.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {detailData.workOrders.map((wo) => (
                          <div
                            key={wo.id}
                            style={{
                              backgroundColor: '#0f172a',
                              padding: '0.75rem 1rem',
                              borderRadius: '6px',
                              border: '1px solid #334155',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <strong style={{ color: '#f8fafc' }}>
                                OT #{wo.order_number} ({wo.order_type})
                              </strong>
                              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                Ingreso: {wo.entered_at} • Km en OT:{' '}
                                {wo.mileage ? `${wo.mileage.toLocaleString()} km` : 'N/A'} • Estado: {wo.status}
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                backgroundColor: wo.is_billed ? '#065f46' : '#1e293b',
                                color: wo.is_billed ? '#a7f3d0' : '#cbd5e1',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '4px',
                                fontWeight: 600,
                              }}
                            >
                              {wo.is_billed ? 'Facturada' : 'En proceso'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Oportunidades Predictivas Detectadas */}
                  <div>
                    <h3 style={{ fontSize: '1rem', color: '#f1f5f9', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
                      Oportunidades Predictivas Generadas
                    </h3>
                    {detailData.opportunities.length === 0 ? (
                      <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No hay oportunidades generadas para este vehículo.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {detailData.opportunities.map((opp) => (
                          <div
                            key={opp.id}
                            style={{
                              backgroundColor: '#0f172a',
                              padding: '0.75rem 1rem',
                              borderRadius: '6px',
                              border: '1px solid #334155',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <strong style={{ color: '#38bdf8' }}>{opp.rule_id}</strong> — Score: {opp.score}
                              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                Estado: {opp.status} • Creada: {opp.created_at}
                              </div>
                            </div>
                            {opp.is_control_group && (
                              <span style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: 700 }}>
                                🛡️ Control 15%
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
