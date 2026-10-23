import React from 'react';

interface ColombianPlateProps {
  plate?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

export function ColombianPlate({ plate, size = 'md' }: ColombianPlateProps) {
  if (!plate) {
    return <span style={{ color: '#64748b', fontStyle: 'italic' }}>Sin placa</span>;
  }

  const clean = plate.toUpperCase().replace(/\s+/g, '');
  const formatted = clean.length === 6 ? `${clean.slice(0, 3)}·${clean.slice(3)}` : clean;

  const fontSizes = {
    sm: '0.75rem',
    md: '0.9rem',
    lg: '1.25rem',
  };

  const padding = {
    sm: '2px 6px',
    md: '3px 10px',
    lg: '6px 16px',
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#facc15', // Amarillo reflectivo clásico placa particular Colombia
        color: '#0f172a',
        fontFamily: 'monospace, -apple-system, sans-serif',
        fontWeight: 800,
        fontSize: fontSizes[size],
        padding: padding[size],
        borderRadius: '4px',
        border: '2px solid #000000',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        letterSpacing: '1px',
        userSelect: 'none',
      }}
      title={`Placa automotriz: ${clean}`}
    >
      {formatted}
    </div>
  );
}
