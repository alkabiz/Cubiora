import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@radix-ui/themes';

export const Layout: React.FC = () => {
  return (
    <Box className="min-h-screen flex flex-col bg-[var(--color-background)]">
      <main className="flex-1">
        <Outlet />
      </main>
    </Box>
  );
};
