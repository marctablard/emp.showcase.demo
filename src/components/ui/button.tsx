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
        outlineError:
          'border-width-button border-border-error bg-transparent text-text-error disabled:border-border-disabled hover:bg-surface-error rounded-button',
        outlineSuccess:
          'border-width-button border-border-success bg-transparent text-text-success disabled:border-border-disabled hover:bg-surface-success rounded-button',
        neutral:
          'border-width-button border-border-black px-2 py-1 disabled:border-transparent hover:bg-surface-neutral hover:text-text-on-action rounded-button',
        // Todo: red button needs to be designed in figma
        red: 'bg-surface-error text-text-error border-width-button border-transparent hover:bg-surface-error/80 rounded-button normal-case',
        link: 'text-text-action disabled:bg-transparent hover:text-text-action-hover rounded-button',
        input:
          'bg-surface-action text-text-on-action border-width-button border-transparent hover:bg-surface-action-hover rounded-r-sm',
        carouselControl:
          'absolute size-8 rounded-full border-width-button border-border-secondary bg-transparent text-text-action hover:border-border-action-hover hover:bg-surface-action-hover-2 hover:text-text-action-hover disabled:border-transparent',
        iconSelector:
          'border-width-button border-border-primary bg-surface-page !p-2 w-12 h-12 rounded-sm data-[active=true]:border-2 data-[active=true]:border-border-black hover:border-border-black disabled:!border-border-primary disabled:!border-1 disabled:bg-surface-disabled disabled:text-text-on-disabled',
      },
      size: {
        small: 'px-2 py-1',
        default: '',
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
        'text-icon-on-action from-gradient-secondary-end to-gradient-secondary-start hover:to-surface-action-hover disabled:bg-surface-disabled-selected focus-visible:ring-border-focus shrink-0 cursor-pointer rounded-full bg-linear-to-t p-2 transition outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:bg-none [&_svg]:shrink-0 [&>svg]:size-8',
        className,
      )}
      {...props}
    >
      {Icon ? <Icon /> : null}
    </button>
  );
}

export { Button, buttonVariants, BackToTopButton };
