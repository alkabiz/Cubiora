import React from 'react';
import { Button as RadixButton } from '@radix-ui/themes';

type ButtonVariant = 'primary' | 'success' | 'surface' | 'ghost';
type ButtonSize = 'md' | 'lg';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

type RadixButtonColor = React.ComponentProps<typeof RadixButton>['color'];

const VARIANT_MAP: Record<ButtonVariant, { color: RadixButtonColor; variant: 'solid' | 'surface' | 'ghost' | 'soft' }> = {
  primary: { color: 'blue', variant: 'solid' },
  success: { color: 'green', variant: 'solid' },
  surface: { color: 'blue', variant: 'surface' },
  ghost: { color: 'blue', variant: 'ghost' },
};

const SIZE_MAP: Record<ButtonSize, '1' | '2' | '3' | '4'> = {
  md: '2',
  lg: '3',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'lg',
  fullWidth = true,
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  children,
  ...props
}) => {
  const { color, variant: radixVariant } = VARIANT_MAP[variant];
  const radixSize = SIZE_MAP[size];

  return (
    <RadixButton
      color={color}
      variant={radixVariant}
      size={radixSize}
      disabled={disabled}
      className={className}
      style={{ width: fullWidth ? '100%' : 'auto' }}
      {...props}
    >
      {leftIcon && <span aria-hidden="true">{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span aria-hidden="true">{rightIcon}</span>}
    </RadixButton>
  );
};