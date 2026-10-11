import React, { useState } from 'react';

export const CashierPage: React.FC = () => {
  const [cubicleNumber, setCubicleNumber] = useState(1);
  const [currentTicket, setCurrentTicket] = useState<string | null>(null);
  const [callCount, setCallCount] = useState(0);

  const handleCallNext = () => {
    const nextTicket = `TUR-000${Math.floor(100 + Math.random() * 900)}-X1`;
    setCurrentTicket(nextTicket);
    setCallCount(1);
  };

  const handleRepeatCall = () => {
    if (callCount < 3) {
      setCallCount((prev) => prev + 1);
    }
  };

  const handleComplete = () => {
    setCurrentTicket(null);
    setCallCount(0);
  };

  const handleNoShow = () => {
    setCurrentTicket(null);
    setCallCount(0);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>
              Atención en Cubículo
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Gestión de atención y llamado presencial
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label htmlFor="cubicle-select" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Cubículo:
            </label>
            <select
              id="cubicle-select"
              value={cubicleNumber}
              onChange={(e) => setCubicleNumber(Number(e.target.value))}
              className="form-input"
              style={{ width: 'auto', padding: '0.4rem 0.8rem' }}
            >
              <option value={1}>Cubículo 1</option>
              <option value={2}>Cubículo 2</option>
              <option value={3}>Cubículo 3</option>
            </select>
          </div>
        </div>

        {/* Estado actual del turno */}
        <div
          className="card"
          style={{
            marginBottom: '2rem',
            textAlign: 'center',
            padding: '2.5rem',
            background: 'var(--bg-secondary)',
          }}
        >
          {currentTicket ? (
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                TURNO EN ATENCIÓN ACTUAL
              </span>
              <div
                style={{
                  fontSize: '3rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: '#fff',
                  margin: '0.5rem 0',
                }}
              >
                {currentTicket}
              </div>
              <div>
                <span className="badge badge-waiting">
                  Llamados: {callCount} de 3
                </span>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>
              <p style={{ fontSize: '1.2rem', fontWeight: 600 }}>Cubículo disponible</p>
              <p style={{ fontSize: '0.9rem' }}>Presione "Llamar Siguiente" para avanzar la cola FIFO</p>
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {!currentTicket ? (
            <button
              id="btn-llamar-siguiente"
              onClick={handleCallNext}
              className="btn btn-primary"
              style={{ flex: 1, padding: '1rem' }}
            >
              Llamar Siguiente Turno
            </button>
          ) : (
            <>
              <button
                id="btn-rellamar"
                onClick={handleRepeatCall}
                disabled={callCount >= 3}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Re-Llamar ({callCount}/3)
              </button>
              <button
                id="btn-finalizar"
                onClick={handleComplete}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Completar Entrega
              </button>
              <button
                id="btn-no-show"
                onClick={handleNoShow}
                className="btn btn-secondary"
                style={{
                  borderColor: 'var(--accent-amber)',
                  color: 'var(--accent-amber)',
                }}
              >
                No Presentado
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
