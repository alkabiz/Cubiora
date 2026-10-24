import React from 'react';
import { Outlet } from 'react-router-dom';
import { AuthProvider } from '../context/auth-context';

export const Layout: React.FC = () => {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
};
