import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

export const Layout: React.FC = () => {
  const location = useLocation();

  const isCurrent = (path: string) => location.pathname === path;

  // Si estamos en la pantalla pública /pantalla, mostrar modo pantalla completa sin header complejo
  const isDisplayMode = location.pathname === '/pantalla';

  return (
    <div className="app-container">
      {!isDisplayMode && (
        <header className="glass-panel" style={{ margin: '1rem', padding: '1rem 2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-cyan))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  color: '#fff',
                  fontSize: '1.2rem',
                }}
              >
                C
              </div>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Cubiora
              </h1>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  background: 'rgba(6, 182, 212, 0.15)',
                  color: 'var(--accent-cyan)',
                  fontWeight: 600,
                }}
              >
                FarmaTurnos PMV
              </span>
            </div>

            <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Link
                to="/recepcion"
                className={`btn ${isCurrent('/recepcion') ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                Recepción
              </Link>
              <Link
                to="/cajero"
                className={`btn ${isCurrent('/cajero') ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                Atención (Cubículo)
              </Link>
              <Link
                to="/pantalla"
                className={`btn ${isCurrent('/pantalla') ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                Pantalla Sala
              </Link>
              <Link
                to="/login"
                className={`btn ${isCurrent('/login') ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                Acceso
              </Link>
            </nav>
          </div>
        </header>
      )}

      <main className="main-content">
        <Outlet />
      </main>

      {!isDisplayMode && (
        <footer
          style={{
            textAlign: 'center',
            padding: '1.5rem',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          Cubiora &copy; {new Date().getFullYear()} — Sistema Presencial de Gestión de Turnos de Medicamentos
        </footer>
      )}
    </div>
  );
};
