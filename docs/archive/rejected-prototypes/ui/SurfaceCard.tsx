import React from 'react';
import { Card as RadixCard } from '@radix-ui/themes';

interface SurfaceCardProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'section' | 'aside' | 'div' | 'article';
  variant?: 'default' | 'muted';
  children: React.ReactNode;
}

export const SurfaceCard: React.FC<SurfaceCardProps> = ({
  as: Component = 'section',
  variant = 'default',
  className = '',
  children,
  ...props
}) => {
  const radixVariant = variant === 'muted' ? 'surface' : 'classic';

  return (
    <RadixCard
      variant={radixVariant}
      className={className}
      style={{ display: 'flex', flexDirection: 'column' }}
      {...props}
    >
      {children}
    </RadixCard>
  );
};