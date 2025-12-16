'use client';

import * as React from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { CircleIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn('grid gap-4', className)} {...props} />;
}

function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        'bg-surface-page border border-border-primary data-[state=checked]bg-surface-action size-6 shrink-0 rounded-full',
        'transition-all hover:border-border-action-hover hover:bg-surface-action-hover-2',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
        'aria-invalid:text-text-error aria-invalid:border-border-error hover:aria-invalid:border-border-action-hover hover:aria-invalid:text-text-action-hover aria-invalid:data-[state=checked]:bg-surface-error',
        'data-[state=checked]:bg-surface-action hover:data-[state=checked]:bg-surface-action-hover',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:text-text-on-disabled disabled:bg-surface-disabled disabled:border-border-disabled disabled:aria-invalid:border-border-disabled',
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="relative flex items-center justify-center"
      >
        <CircleIcon
          className={cn(
            'fill-surface-primary stroke-none absolute top-1/2 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2',
            props['aria-invalid'] && props['checked'] && 'fill-text-error',
          )}
        />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
