import React from 'react';
import { Outlet } from 'react-router-dom';

/**
 * Layout independiente para la pantalla pública de sala de espera.
 * No comparte navbar, sidebar, sesión ni navegación privada.
 */
export const PublicDisplayLayout: React.FC = () => (
  <div className="public-display-layout">
    <Outlet />
  </div>
);
