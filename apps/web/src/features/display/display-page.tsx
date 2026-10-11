import React, { useState } from 'react';
import { PublicCall } from '@cubiora/shared';

// Datos ficticios iniciales para demostración visual de la pantalla
const INITIAL_CALLS: PublicCall[] = [
  {
    publicCode: 'TUR-000101-A1',
    cubicleDisplayName: 'Cubículo 1',
    calledAt: new Date().toISOString(),
    callNumber: 1,
  },
  {
    publicCode: 'TUR-000098-B2',
    cubicleDisplayName: 'Cubículo 2',
    calledAt: new Date(Date.now() - 1000 * 120).toISOString(),
    callNumber: 2,
  },
  {
    publicCode: 'TUR-000095-C3',
    cubicleDisplayName: 'Cubículo 3',
    calledAt: new Date(Date.now() - 1000 * 300).toISOString(),
    callNumber: 1,
  },
];

export const DisplayPage: React.FC = () => {
  const [calls] = useState<PublicCall[]>(INITIAL_CALLS);
  const currentCall = calls[0];
  const recentHistory = calls.slice(1);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '1rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>
            Pantalla de Llamados
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Entrega de Medicamentos — Sala de Espera
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-emerald)',
              boxShadow: '0 0 10px var(--accent-emerald)',
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: '0.85rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>
            EN VIVO
          </span>
        </div>
      </header>

      <div className="display-grid">
        {/* Turno Principal Llamado Actual */}
        <section aria-label="Turno Actual">
          <div className="ticket-hero">
            <span
              style={{
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                fontSize: '0.9rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
              }}
            >
              Turno en Atención
            </span>
            <div id="pantalla-turno-actual" className="ticket-number-big">
              {currentCall ? currentCall.publicCode : 'SIN LLAMADOS'}
            </div>
            <div id="pantalla-cubiculo-actual" className="cubicle-number-big">
              {currentCall ? currentCall.cubicleDisplayName : 'Por favor espere'}
            </div>
            {currentCall && currentCall.callNumber > 1 && (
              <div style={{ marginTop: '0.75rem' }}>
                <span className="badge badge-waiting">
                  Llamado #{currentCall.callNumber}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Turnos Anteriores Recientes */}
        <section aria-label="Llamados Recientes">
          <div className="glass-panel" style={{ padding: '1.5rem', height: '100%' }}>
            <h3
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                marginBottom: '1rem',
                color: 'var(--text-secondary)',
              }}
            >
              Llamados Recientes
            </h3>
            <div className="recent-calls-list">
              {recentHistory.map((call, idx) => (
                <div key={idx} className="recent-call-item">
                  <span style={{ fontWeight: 700, color: '#fff' }}>
                    {call.publicCode}
                  </span>
                  <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                    {call.cubicleDisplayName}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
