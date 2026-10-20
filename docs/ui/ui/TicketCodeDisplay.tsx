import React from 'react';
import { TicketCategory } from '../../types/queue';

interface TicketCodeDisplayProps {
  code: string;
  category?: TicketCategory;
  size?: 'md' | 'lg' | 'xl';
  framed?: boolean;
}

const CATEGORY_ACCENTS: Record<
  TicketCategory,
  { glow: string; border: string; badgeText: string }
> = {
  general: {
    glow: 'text-shadow-glow',
    border: 'border-brand-primary shadow-[0_0_40px_rgba(57,184,253,0.15)]',
    badgeText: 'text-brand-primary',
  },
  preferencial: {
    glow: 'text-shadow-glow-amber',
    border: 'border-status-called shadow-[0_0_40px_rgba(245,158,11,0.18)]',
    badgeText: 'text-status-called',
  },
  especial: {
    glow: 'text-shadow-glow-iris',
    border: 'border-purple-400 shadow-[0_0_40px_rgba(139,92,246,0.2)]',
    badgeText: 'text-purple-300',
  },
  triage: {
    glow: 'text-shadow-glow-amber',
    border: 'border-status-called shadow-[0_0_40px_rgba(245,158,11,0.18)]',
    badgeText: 'text-status-called',
  },
};

const SIZE_CLASSES: Record<'md' | 'lg' | 'xl', string> = {
  md: 'text-4xl sm:text-5xl',
  lg: 'text-5xl sm:text-6xl',
  xl: 'text-[clamp(2rem,5.2vw,5.5rem)]',
};

export const TicketCodeDisplay: React.FC<TicketCodeDisplayProps> = ({
  code,
  category = 'general',
  size = 'lg',
  framed = true,
}) => {
  const accent = CATEGORY_ACCENTS[category];

  if (!framed) {
    return (
      <span
        className={`font-mono-code ${SIZE_CLASSES[size]} font-black text-text-primary tracking-widest ${accent.glow} whitespace-nowrap`}
      >
        {code}
      </span>
    );
  }

  return (
    <div
      className={`w-full py-6 sm:py-10 px-6 sm:px-12 rounded-2xl bg-surface-base border-2 ${accent.border} flex items-center justify-center`}
    >
      <span
        className={`font-mono-code ${SIZE_CLASSES[size]} font-black text-text-primary tracking-widest ${accent.glow} whitespace-nowrap`}
      >
        {code}
      </span>
    </div>
  );
};
