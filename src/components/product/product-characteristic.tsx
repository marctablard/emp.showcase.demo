'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ProductCharacteristicProps {
  readonly value: string | number;
  readonly unit: string;
  /** Localized attribute name for the tooltip pair. Falls back to `unit`. */
  readonly attributeLabel?: string;
  readonly className?: string;
}

export function ProductCharacteristic({ value, unit, attributeLabel, className }: ProductCharacteristicProps) {
  const tooltipAttribute = attributeLabel?.trim() || unit;
  const tooltipLabel = tooltipAttribute ? `${tooltipAttribute}: ${value}` : String(value);

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <div
          className={cn(
            // Badge max width ≥120px (max-w-30). Newer than COP-6023's 64px cap.
            'flex min-w-0 max-w-30 flex-col overflow-hidden rounded-sm border',
            className,
          )}
        >
          <div className="min-w-0 truncate bg-surface-neutral px-1 py-0.5 text-center text-sm leading-tight text-text-on-action">
            {value}
          </div>
          <div className="min-w-0 truncate bg-surface-page px-1 py-0.5 text-center text-sm leading-tight">{unit}</div>
        </div>
      </TooltipTrigger>
      <TooltipContent data-testid="product-characteristic-tooltip">{tooltipLabel}</TooltipContent>
    </Tooltip>
  );
}
