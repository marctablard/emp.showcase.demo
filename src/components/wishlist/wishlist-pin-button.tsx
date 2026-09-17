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
  /**
   * The article the button acts on. Icon-only buttons otherwise all carry the same name, and a list
   * of controls shows four identical entries where the comparison has one per column.
   */
  itemName?: string;
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
  itemName,
}: WishlistPinButtonProps) {
  const tProduct = useTranslations('product');
  const isBlocked = disabled || isAdding;
  const tooltip = disabled && disabledTooltip ? disabledTooltip : tProduct('addToWishlist');
  // The tooltip keeps the short wording, the accessible name names the article — two different
  // texts rather than the same one twice.
  const accessibleName = itemName ? `${tProduct('addToWishlist')} ${itemName}` : tProduct('addToWishlist');

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            variant="secondary"
            size="icon"
            aria-label={accessibleName}
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
