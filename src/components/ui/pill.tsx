'use client';

import * as React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const pillVariants = cva(
  'flex items-center gap-2 normal-case h-auto min-h-[48px] py-1 whitespace-normal break-words text-left !whitespace-normal',
  {
    variants: {
      variant: {
        default:
          'bg-surface-disabled text-text-headings border-none hover:bg-surface-hover-grey hover:text-text-headings focus:ring-2 focus:ring-border-action focus:ring-offset-2 justify-between',
        reset:
          'bg-surface-page text-text-headings border-[1px] border-border-black hover:bg-surface-hover-grey hover:text-text-headings focus:ring-2 focus:ring-border-action focus:ring-offset-2',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface PillProps extends React.ComponentProps<'button'>, VariantProps<typeof pillVariants> {
  /**
   * The main label text to display
   */
  label: string;
  /**
   * Optional value to display in parentheses after the label
   */
  value?: string;
  /**
   * Visual style variant of the pill
   */
  variant?: 'default' | 'reset';
  /**
   * Optional leading icon to display before the label
   */
  leadingIcon?: React.ReactNode;
  /**
   * Optional trailing icon to display after the label/value
   */
  trailingIcon?: React.ReactNode;
}

const Pill = React.forwardRef<HTMLButtonElement, PillProps>(
  ({ label, value, variant = 'default', className, leadingIcon, trailingIcon, ...props }, ref) => {
    return (
      <Button ref={ref} className={cn(pillVariants({ variant }), className)} {...props}>
        {leadingIcon && <span className="flex-shrink-0 flex items-center">{leadingIcon}</span>}
        <span className="flex flex-wrap items-start gap-1 flex-1 break-words text-left">
          <span className="break-words max-w-full">{label}</span>
          {value && <span className="text-text-secondary">({value})</span>}
        </span>
        {trailingIcon && <span className="flex-shrink-0 flex items-center">{trailingIcon}</span>}
      </Button>
    );
  },
);

Pill.displayName = 'Pill';

export { Pill, pillVariants };
