import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';
import { ChevronsUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'cursor-pointer uppercase inline-flex items-center justify-center gap-3 whitespace-nowrap px-4 py-3 text-action-button tracking-widest font-bold transition-all disabled:pointer-events-none disabled:bg-surface-disabled disabled:text-text-on-disabled [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white',
  {
    variants: {
      variant: {
        primary:
          'bg-surface-action text-text-on-action border-width-button border-transparent hover:bg-surface-action-hover rounded-button',
        secondary:
          'border-width-button border-border-secondary bg-transparent text-text-action disabled:border-border-disabled hover:border-border-action-hover hover:bg-surface-action-hover-2 hover:text-text-action-hover rounded-button',
        neutral:
          'border-width-button border-border-black px-2 py-1 disabled:border-transparent hover:bg-surface-neutral hover:text-text-on-action rounded-button',
        // Todo: red button needs to be designed in figma
        red: 'bg-surface-error text-text-error border-width-button border-transparent hover:bg-surface-error/80 rounded-button normal-case',
        link: 'text-text-action disabled:bg-transparent hover:text-text-action-hover rounded-button',
        input:
          'bg-surface-action text-text-on-action border-width-button border-transparent hover:bg-surface-action-hover rounded-r-sm',
        carouselControl:
          'absolute size-8 rounded-full border-width-button border-border-secondary bg-transparent text-text-action hover:border-border-action-hover hover:bg-surface-action-hover-2 hover:text-text-action-hover disabled:border-transparent',
      },
      size: {
        small: 'px-2 py-1',
        default: 'px-4 py-3',
        icon: 'p-3',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

function BackToTopButton({
  className,
  icon: Icon = ChevronsUp,
  ...props
}: React.ComponentProps<'button'> & { icon?: React.ElementType | null }) {
  return (
    <button
      className={cn(
        'cursor-pointer text-icon-on-action [&>svg]:size-8 p-2 rounded-full bg-linear-to-t from-gradient-secondary-end to-gradient-secondary-start hover:to-surface-action-hover transition disabled:bg-none disabled:bg-surface-disabled-selected disabled:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        className,
      )}
      {...props}
    >
      {Icon ? <Icon /> : null}
    </button>
  );
}

export { Button, buttonVariants, BackToTopButton };
