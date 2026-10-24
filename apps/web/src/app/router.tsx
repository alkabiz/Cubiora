import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { Layout } from './layout';
import { AppShell } from './app-shell';
import { PublicDisplayLayout } from './public-display-layout';
import { DEFAULT_ROUTE_BY_ROLE } from './navigation-config';
import { ProtectedRoute } from '../components/protected-route';
import { useAuth } from '../context/auth-context';

const ReceptionPage = lazy(() =>
  import('../pages/reception-page').then((m) => ({ default: m.ReceptionPage })),
);
const CashierPage = lazy(() =>
  import('../pages/cashier-page').then((m) => ({ default: m.CashierPage })),
);
const AdminCubiclesPage = lazy(() =>
  import('../pages/admin-cubicles-page').then((m) => ({ default: m.AdminCubiclesPage })),
);
const AdminHistoryPage = lazy(() =>
  import('../pages/admin-history-page').then((m) => ({ default: m.AdminHistoryPage })),
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

const RootRedirect: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-sm text-slate-400">
        Cargando interfaz...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={DEFAULT_ROUTE_BY_ROLE[user.role]} replace />;
};

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <RootRedirect />,
      },
      {
        path: 'login',
        element: (
          <RouteWrapper>
            <LoginPage />
          </RouteWrapper>
        ),
      },
      {
        path: 'pantalla',
        element: <PublicDisplayLayout />,
        children: [
          {
            index: true,
            element: (
              <RouteWrapper>
                <DisplayPage />
              </RouteWrapper>
            ),
          },
        ],
      },
      {
        element: (
          <RouteWrapper>
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          </RouteWrapper>
        ),
        children: [
          {
            path: 'recepcion',
            element: (
              <RouteWrapper>
                <ProtectedRoute allowedRoles={['RECEPTION']}>
                  <ReceptionPage />
                </ProtectedRoute>
              </RouteWrapper>
            ),
          },
          {
            path: 'cajero',
            element: (
              <RouteWrapper>
                <ProtectedRoute allowedRoles={['CASHIER']}>
                  <CashierPage />
                </ProtectedRoute>
              </RouteWrapper>
            ),
          },
          {
            path: 'admin',
            children: [
              {
                index: true,
                element: <Navigate to="/admin/cubiculos" replace />,
              },
              {
                path: 'cubiculos',
                element: (
                  <RouteWrapper>
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminCubiclesPage />
                    </ProtectedRoute>
                  </RouteWrapper>
                ),
              },
              {
                path: 'historial',
                element: (
                  <RouteWrapper>
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminHistoryPage />
                    </ProtectedRoute>
                  </RouteWrapper>
                ),
              },
            ],
          },
        ],
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);
