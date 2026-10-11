import React, { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Theme } from '@radix-ui/themes';
import { queryClient } from '../lib/query-client';

interface ProvidersProps {
  children: ReactNode;
}

export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <Theme accentColor="teal" grayColor="slate" radius="medium" scaling="100%">
        {children}
      </Theme>
    </QueryClientProvider>
  );
};
