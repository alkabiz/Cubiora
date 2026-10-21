import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from './layout';

import { ProtectedRoute } from '../components/protected-route';

const ReceptionPage = lazy(() =>
  import('../pages/reception-page').then((m) => ({ default: m.ReceptionPage })),
);
const CashierPage = lazy(() =>
  import('../pages/cashier-page').then((m) => ({ default: m.CashierPage })),
);
const DisplayPage = lazy(() =>
  import('../pages/display-page').then((m) => ({ default: m.DisplayPage })),
);
const LoginPage = lazy(() =>
  import('../pages/login-page').then((m) => ({ default: m.LoginPage })),
);

const RouteWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense
    fallback={
      <div className="flex items-center justify-center min-h-[50vh] text-sm text-slate-400">
        Cargando interfaz...
      </div>
    }
  >
    {children}
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Navigate to="/login" replace />,
      },
      {
        path: 'recepcion',
        element: (
          <RouteWrapper>
            <ProtectedRoute allowedRoles={['RECEPTION', 'ADMIN']}>
              <ReceptionPage />
            </ProtectedRoute>
          </RouteWrapper>
        ),
      },
      {
        path: 'cajero',
        element: (
          <RouteWrapper>
            <ProtectedRoute allowedRoles={['CASHIER', 'ADMIN']}>
              <CashierPage />
            </ProtectedRoute>
          </RouteWrapper>
        ),
      },
      {
        path: 'pantalla',
        element: (
          <RouteWrapper>
            <DisplayPage />
          </RouteWrapper>
        ),
      },
      {
        path: 'login',
        element: (
          <RouteWrapper>
            <LoginPage />
          </RouteWrapper>
        ),
      },
    ],
  },
]);
