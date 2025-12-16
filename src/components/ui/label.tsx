'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import * as LabelPrimitive from '@radix-ui/react-label';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

export interface LabelProps extends React.ComponentProps<typeof LabelPrimitive.Root> {
  isOptional?: boolean;
  hasTooltip?: boolean;
  tooltipText?: string;
}
function Label({ className, isOptional, hasTooltip, tooltipText, ...props }: LabelProps) {
  const t = useTranslations('common');

  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        'flex items-center gap-2 text-base leading-none font-semibold select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:text-text-disabled peer-disabled:cursor-not-allowed peer-disabled:text-text-disabled',
        className,
      )}
      {...props}
    >
      {props.children}
      {hasTooltip && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="text-icon-action" />
          </TooltipTrigger>
          <TooltipContent>
            <p className="w-full">{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      )}
      {isOptional && <p className="text-sm font-medium text-text-placeholders">{t('optional')}</p>}
    </LabelPrimitive.Root>
  );
}

export { Label };
