import * as React from 'react';
import { VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva('flex flex-col gap-6 py-6', {
  variants: {
    variant: {
      default: 'bg-surface-primary text-text-body',
      stat: 'bg-surface-primary text-text-body border border-1 border-border-primary border-t-4 ',
      gray: 'bg-surface-image-background text-text-body',
      primary: 'bg-gradient-to-t from-gradient-secondary-end to-gradient-secondary-start text-text-on-action',
      secondary: 'bg-gradient-to-t from-gradient-primary-end to-gradient-primary-start text-text-on-action',
    },
    shadow: {
      none: 'px-4 py-3',
      default: 'shadow-sm',
    },
    rounded: {
      md: 'rounded-md',
      lg: 'rounded-lg',
      none: 'rounded-none',
    },
  },
  defaultVariants: {
    variant: 'default',
    shadow: 'default',
    rounded: 'md',
  },
});

function Card({
  variant,
  shadow,
  rounded,
  className,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof cardVariants>) {
  return <div data-slot="card" className={cn(cardVariants({ variant, shadow, rounded }), className)} {...props} />;
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-3',
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-title" {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-description" className={cn('text-text-placeholders text-sm', className)} {...props} />;
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('px-6', className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="card-footer" className={cn('flex items-center px-6 [.border-t]:pt-6', className)} {...props} />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
