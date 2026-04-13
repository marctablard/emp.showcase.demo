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
        /** Figma Tags — final / inactive (surface/disabled + border/primary) */
        muted: 'border-transparent bg-surface-disabled text-text-secondary [a&]:hover:bg-surface-disabled/90',
        information:
          'border-transparent bg-surface-information text-text-action-hover [a&]:hover:bg-surface-information/90',
        info: 'border-transparent bg-surface-warning uppercase [a&]:hover:bg-surface-error/90',
      },
      size: {
        default: '',
        /** Figma Molecules / Tags — same on mobile and desktop */
        status:
          'h-7 min-h-[28px] min-w-0 px-4 py-1 text-[12px] leading-3 tracking-[2px] uppercase font-primary text-text-headings',
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
    compoundVariants: [
      {
        size: 'status',
        class: 'rounded-[4px]',
      },
      {
        variant: 'success',
        size: 'status',
        class: 'border-border-success bg-surface-success text-text-headings',
      },
      {
        variant: 'warning',
        size: 'status',
        class: 'border-border-warning bg-surface-warning text-text-headings',
      },
      {
        variant: 'destructive',
        size: 'status',
        class: 'border-border-error bg-surface-error text-text-headings',
      },
      {
        variant: 'information',
        size: 'status',
        class: 'border-border-information bg-surface-information text-text-headings',
      },
      {
        variant: 'secondary',
        size: 'status',
        class: 'border-border-primary bg-surface-secondary text-text-headings',
      },
      {
        variant: 'muted',
        size: 'status',
        class: 'border-border-primary bg-surface-disabled text-text-headings',
      },
      {
        variant: 'outline',
        size: 'status',
        class: 'border-border-primary bg-surface-primary text-text-headings',
      },
      {
        variant: 'default',
        size: 'status',
        class: 'border-border-primary bg-surface-primary text-text-headings',
      },
    ],
    defaultVariants: {
      variant: 'default',
      rounded: 'default',
      fontWeight: 'medium',
      size: 'default',
    },
  },
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

function Badge({
  className,
  variant,
  rounded,
  fontWeight,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';
  const effectiveFontWeight = size === 'status' ? 'bold' : (fontWeight ?? 'medium');

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, rounded, fontWeight: effectiveFontWeight, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
