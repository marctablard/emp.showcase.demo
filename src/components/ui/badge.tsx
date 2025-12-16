import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'flex items-center justify-center border px-2 py-0.5 text-sm w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-border-focus focus-visible:ring-border-focus focus-visible:ring-[3px] aria-invalid:ring-surface-error/20 dark:aria-invalid:ring-surface-error/40 aria-invalid:border-border-error transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-surface-action text-text-on-action [a&]:hover:bg-surface-action/90',
        success: 'border-transparent bg-surface-success text-text-body [a&]:hover:bg-surface-success/90',
        secondary: 'border-transparent bg-surface-secondary text-text-secondary [a&]:hover:bg-surface-secondary/90',
        warning: 'border-transparent bg-surface-warning text-text-warning [a&]:hover:bg-surface-warning/90',
        white: 'border-transparent bg-surface-page text-text-action [a&]:hover:bg-surface-page/90',
        black: 'border-transparent bg-surface-neutral text-text-on-action [a&]:hover:bg-surface-neutral/90',
        destructive: 'border-transparent bg-surface-error text-text-error [a&]:hover:bg-surface-error/90',
        sale: 'border-transparent bg-icon-error text-text-on-action [a&]:hover:bg-surface-icon-error/90',
        outline: 'text-text-body [a&]:hover:bg-surface-page [a&]:hover:bg-surface-page/90',
        information:
          'border-transparent bg-surface-information text-text-action-hover [a&]:hover:bg-surface-information/90',
        info: 'border-transparent bg-surface-warning uppercase [a&]:hover:bg-surface-error/90',
      },
      rounded: {
        none: 'rounded-none',
        roundedRight: 'rounded-r-pill',
        default: 'rounded-pill',
        full: 'rounded-full',
      },
      fontWeight: {
        bold: 'font-bold',
        medium: 'font-medium',
      },
    },
    defaultVariants: {
      variant: 'default',
      rounded: 'default',
      fontWeight: 'medium',
    },
  },
);

function Badge({
  className,
  variant,
  rounded,
  fontWeight,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant, rounded, fontWeight }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
