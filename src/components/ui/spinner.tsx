'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface SpinnerProps {
  variant?: 'xs' | 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'white' | 'default';
  className?: string;
  loadingText?: string;
}

/**
 * Spinner component for loading states
 */
export const Spinner: React.FC<SpinnerProps> = ({ loadingText, variant = 'md', color = 'default', className }) => {
  const t = useTranslations('common.UI.spinner');
  const variants = {
    xs: 'h-2 w-2 border-1',
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };

  const colors = {
    default: 'border-border-primary/20 border-t-border-primary',
    primary: 'border-border-action/20 border-t-border-action',
    secondary: 'border-border-secondary/20 border-t-border-secondary',
    white: 'border-border-white/20 border-t-border-white',
  };

  return (
    <div
      className={cn('animate-spin rounded-full border-solid', variants[variant], colors[color], className)}
      role="status"
      aria-label={loadingText || t('loading')}
    >
      <span className="sr-only">{loadingText || t('loading')}</span>
    </div>
  );
};
