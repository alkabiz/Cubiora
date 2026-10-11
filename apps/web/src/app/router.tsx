import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from './layout';
import { ReceptionPage } from '../features/reception/reception-page';
import { DisplayPage } from '../features/display/display-page';
import { CashierPage } from '../features/cashier/cashier-page';
import { LoginPage } from '../features/auth/login-page';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Navigate to="/recepcion" replace />,
      },
      {
        path: 'recepcion',
        element: <ReceptionPage />,
      },
      {
        path: 'cajero',
        element: <CashierPage />,
      },
      {
        path: 'pantalla',
        element: <DisplayPage />,
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
    ],
  },
]);
