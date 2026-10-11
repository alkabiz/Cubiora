import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from './layout';
import { ReceptionPage } from '../pages/reception-page';
import { DisplayPage } from '../pages/display-page';
import { CashierPage } from '../pages/cashier-page';
import { LoginPage } from '../pages/login-page';

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
