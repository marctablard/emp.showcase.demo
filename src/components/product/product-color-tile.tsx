'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useL10n } from '@/hooks/useL10n';
import { cn } from '@/lib/utils';
import { getColorValue } from '@/utils/colors';

interface ProductColorTileProps {
  attributeKey: string;
  attributeName?: string;
  isSelected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showCheckmark?: boolean;
  className?: string;
}

export function ProductColorTile({
  attributeKey,
  attributeName,
  isSelected = false,
  onClick,
  size = 'md',
  showCheckmark = true,
  className,
}: ProductColorTileProps) {
  const { l10n } = useL10n();

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const checkmarkSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <>
      <style type="text/css">
        {`.color-tile-${attributeKey} { background-color: ${getColorValue(attributeKey)}; }`}
      </style>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'tile border-2 transition-all duration-200 relative',
          sizeClasses[size],
          isSelected ? 'border-primary scale-100' : 'border-neutral-500 hover:border-neutral-600',
          `color-tile-${attributeKey}`,
          className,
        )}
        title={attributeName ? l10n(attributeName) : attributeKey}
      >
        {isSelected && showCheckmark && (
          <CheckCircle2
            className={cn('absolute -top-1 -right-1 text-primary bg-white rounded-full', checkmarkSizes[size])}
          />
        )}
      </button>
    </>
  );
}
