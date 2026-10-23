import React, { useState } from 'react';
import { MyDayView } from './components/MyDayView';
import { Vehicle360View } from './components/Vehicle360View';
import { MetricsView } from './components/MetricsView';
import { CommercialView } from './components/CommercialView';
import { CopilotDrawer } from './components/CopilotDrawer';

type TabType = 'my-day' | 'commercial' | 'vehicles' | 'metrics';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('commercial');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotPrompt, setCopilotPrompt] = useState<string | undefined>(undefined);

  const getRoleForTab = () => {
    if (activeTab === 'commercial') return 'sales_advisor';
    if (activeTab === 'metrics') return 'executive_manager';
    return 'service_advisor';
  };

  const handleSelectVehicleFromMyDay = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setActiveTab('vehicles');
  };

  const openCopilotWithPrompt = (prompt?: string) => {
    setCopilotPrompt(prompt);
    setCopilotOpen(true);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header */}
      <header
        style={{
          backgroundColor: '#1e293b',
          borderBottom: '1px solid #334155',
          padding: '0.85rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              backgroundColor: '#38bdf8',
              color: '#0f172a',
              fontWeight: 900,
              fontSize: '1.15rem',
              padding: '0.3rem 0.65rem',
              borderRadius: '6px',
              letterSpacing: '0.5px',
            }}
          >
            MIA
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#f8fafc', lineHeight: 1.2 }}>
                MIA CRM <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600 }}>Automotive AI-First</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: '999px',
                  padding: '2px 8px',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#34d399',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                }}
                title="Sistemas operativos: PostgreSQL 18 RLS, Redis 7, RabbitMQ y Capa Semántica"
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    boxShadow: '0 0 6px #10b981',
                  }}
                />
                <span>Piloto Operativo</span>
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Ciclo de Vida del Vehículo, Embudo Comercial & Posventa Predictiva
            </div>
          </div>
        </div>

        {/* Tab Navigation & Copilot Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <nav style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveTab('commercial')}
              style={{
                backgroundColor: activeTab === 'commercial' ? '#0284c7' : 'transparent',
                color: activeTab === 'commercial' ? '#ffffff' : '#94a3b8',
                border: activeTab === 'commercial' ? '1px solid #38bdf8' : '1px solid transparent',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              💼 Ventas & Comercial
            </button>

            <button
              onClick={() => setActiveTab('my-day')}
              style={{
                backgroundColor: activeTab === 'my-day' ? '#0284c7' : 'transparent',
                color: activeTab === 'my-day' ? '#ffffff' : '#94a3b8',
                border: activeTab === 'my-day' ? '1px solid #38bdf8' : '1px solid transparent',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              ⚡ Mi Día (Posventa)
            </button>

            <button
              onClick={() => {
                setSelectedVehicleId(null);
                setActiveTab('vehicles');
              }}
              style={{
                backgroundColor: activeTab === 'vehicles' ? '#0284c7' : 'transparent',
                color: activeTab === 'vehicles' ? '#ffffff' : '#94a3b8',
                border: activeTab === 'vehicles' ? '1px solid #38bdf8' : '1px solid transparent',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              🚗 Vehículos (Vehicle 360)
            </button>

            <button
              onClick={() => setActiveTab('metrics')}
              style={{
                backgroundColor: activeTab === 'metrics' ? '#0284c7' : 'transparent',
                color: activeTab === 'metrics' ? '#ffffff' : '#94a3b8',
                border: activeTab === 'metrics' ? '1px solid #38bdf8' : '1px solid transparent',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              📊 Panel de Control
            </button>
          </nav>

          {/* Copiloto MIA Button */}
          <button
            onClick={() => openCopilotWithPrompt()}
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '0.5rem 1.1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            <span style={{ fontSize: '1rem' }}>✨</span>
            <span>Copiloto MIA</span>
            <span
              style={{
                backgroundColor: 'rgba(255,255,255,0.25)',
                padding: '0.1rem 0.4rem',
                borderRadius: '4px',
                fontSize: '0.7rem',
                letterSpacing: '0.5px',
              }}
            >
              IA
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '2rem', maxWidth: '1440px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {activeTab === 'commercial' && <CommercialView />}
        {activeTab === 'my-day' && <MyDayView onSelectVehicle={handleSelectVehicleFromMyDay} />}
        {activeTab === 'vehicles' && (
          <Vehicle360View
            selectedVehicleId={selectedVehicleId}
            onCloseModal={() => setSelectedVehicleId(null)}
          />
        )}
        {activeTab === 'metrics' && <MetricsView />}
      </main>

      {/* Persistent Floating Action Button (FAB) */}
      <button
        onClick={() => openCopilotWithPrompt()}
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          zIndex: 90,
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          color: '#ffffff',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '50px',
          padding: '0.85rem 1.4rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.5), 0 8px 10px -6px rgba(99, 102, 241, 0.5)',
          cursor: 'pointer',
          fontWeight: 800,
          fontSize: '0.92rem',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <span style={{ fontSize: '1.25rem' }}>✨</span>
        <span>Asistente MIA</span>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
            boxShadow: '0 0 8px #10b981',
          }}
        />
      </button>

      {/* Copilot Drawer */}
      <CopilotDrawer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        initialRole={getRoleForTab()}
        contextualPrompt={copilotPrompt}
      />

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid #334155',
          padding: '1rem 2rem',
          textAlign: 'center',
          fontSize: '0.78rem',
          color: '#64748b',
          backgroundColor: '#0f172a',
        }}
      >
        MIA CRM • Stack Bun + Hono + React + PostgreSQL 18 RLS • Decisiones D-01 a D-50
      </footer>
    </div>
  );
}

