'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { CheckIcon, MinusIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'group peer h-6 w-6 shrink-0 rounded-sm border data-[state=checked]:bg-surface-action data-[state=indeterminate]:bg-surface-action data-[state=checked]:text-text-on-action data-[state=indeterminate]:text-text-on-action',
      'transition-all hover:border-border-action-hover hover:bg-surface-action-hover-2',
      'focus:outline-2 focus:outline-offset-2 focus:outline-border-focus',
      'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-disabled disabled:!text-text-on-disabled disabled:border-border-disabled aria-invalid:disabled:border-border-disabled',
      'aria-invalid:text-text-error aria-invalid:border-border-error hover:aria-invalid:border-border-action hover:aria-invalid:text-text-action-hover aria-invalid:data-[state=indeterminate]:bg-surface-error aria-invalid:data-[state=indeterminate]:text-text-error aria-invalid:data-[state=checked]:bg-surface-error aria-invalid:data-[state=checked]:text-text-error',
      'hover:data-[state=checked]:bg-surface-action-hover hover:data-[state=checked]:border-border-action-hover hover:data-[state=indeterminate]:bg-surface-action-hover hover:data-[state=indeterminate]:border-border-action-hover',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn('flex items-center justify-center text-current')}>
      <MinusIcon className="h-6 w-6 hidden group-data-[state=indeterminate]:block" />
      <CheckIcon className="h-6 w-6 hidden group-data-[state=checked]:block" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
