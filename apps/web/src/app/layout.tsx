import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@radix-ui/themes';
import { AuthProvider } from '../context/auth-context';

export const Layout: React.FC = () => {
  return (
    <AuthProvider>
      <Box className="min-h-screen flex flex-col bg-[var(--color-background)]">
        <main className="flex-1">
          <Outlet />
        </main>
      </Box>
    </AuthProvider>
  );
};
