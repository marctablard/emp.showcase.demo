'use client';

import type { MouseEvent, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface WishlistPinButtonProps {
  disabled: boolean;
  disabledTooltip?: string;
  isAdding: boolean;
  onClick: (e: MouseEvent) => void;
  className?: string;
  iconSize?: number;
  iconChildren?: ReactNode;
  testId?: string;
}

export function WishlistPinButton({
  disabled,
  disabledTooltip,
  isAdding,
  onClick,
  className,
  iconSize = 24,
  iconChildren,
  testId,
}: WishlistPinButtonProps) {
  const tProduct = useTranslations('product');
  const isBlocked = disabled || isAdding;
  const tooltip = disabled && disabledTooltip ? disabledTooltip : tProduct('addToWishlist');

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            variant="secondary"
            size="icon"
            aria-label={tProduct('addToWishlist')}
            aria-busy={isAdding || undefined}
            title={tProduct('addToWishlist')}
            onClick={onClick}
            disabled={isBlocked}
            data-testid={testId}
            className={cn(className)}
          >
            {isAdding ? (
              <Loader2 className="animate-spin" width={iconSize} height={iconSize} aria-hidden="true" />
            ) : (
              (iconChildren ?? <Pin width={iconSize} height={iconSize} aria-hidden="true" />)
            )}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
