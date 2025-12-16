import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'flex items-center justify-center border px-2 py-0.5 text-text-headings text-sm font-bold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-border-focus focus-visible:ring-border-focus focus-visible:ring-[3px] aria-invalid:ring-text-error/20 dark:aria-invalid:ring-text-error/40 aria-invalid:border-border-error transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        primary: 'border-border-secondary bg-surface-primary',
        default: 'border-border-primary bg-surface-primary',
        success: 'border-border-success bg-surface-success',
        warning: 'border-border-warning bg-surface-warning',
      },
      rounded: {
        none: 'rounded-none',
        roundedRight: 'rounded-r-md',
        default: 'rounded-md',
        lg: 'rounded-lg',
        sm: 'rounded-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      rounded: 'sm',
    },
  },
);

function Badge({
  className,
  variant,
  rounded,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';

  return <Comp data-slot="badge" className={cn(badgeVariants({ variant, rounded }), className)} {...props} />;
}

export { Badge, badgeVariants };
