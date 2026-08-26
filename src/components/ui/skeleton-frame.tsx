import type { ComponentProps } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const roundedVariants = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
} as const;

const skeletonFrameVariants = cva('relative isolate', {
  variants: {
    rounded: roundedVariants,
  },
  defaultVariants: {
    rounded: 'xl',
  },
});

/* Match the padding-box curve so the fill cannot cover the border at corners. */
const roundedFillVariants = {
  sm: 'rounded-[calc(var(--radius-sm)-0.175rem)]',
  md: 'rounded-[calc(var(--radius-md)-0.175rem)]',
  lg: 'rounded-[calc(var(--radius-lg)-0.175rem)]',
  xl: 'rounded-[calc(var(--radius-xl)-0.175rem)]',
} as const;

const skeletonFrameFillVariants = cva('relative z-10 h-full w-full overflow-hidden bg-surface-hover-grey', {
  variants: {
    rounded: roundedFillVariants,
    pulse: {
      true: 'animate-pulse',
      false: '',
    },
  },
  defaultVariants: {
    rounded: 'xl',
    pulse: true,
  },
});

const SKELETON_BORDER_SPIN = 'skeleton-border-spin-layer skeleton-border-spin-fill animate-skeleton-border-spin';
const SKELETON_BORDER_SHIFT =
  'animate-skeleton-border bg-gradient-to-r from-border-action via-border-white to-border-action bg-[length:400%_400%]';

export interface SkeletonFrameProps extends ComponentProps<'div'>, VariantProps<typeof skeletonFrameVariants> {
  pulse?: boolean;
  animatedBorder?: boolean;
  motion?: 'spin' | 'shift';
}

function SkeletonFrame({
  className,
  children,
  pulse = true,
  animatedBorder = true,
  motion = 'spin',
  rounded = 'xl',
  ...props
}: Readonly<SkeletonFrameProps>) {
  const showShiftBorder = animatedBorder && motion === 'shift';
  const showSpinBorder = animatedBorder && motion === 'spin';

  return (
    <div
      data-slot="skeleton-frame"
      data-motion={animatedBorder ? motion : 'none'}
      className={cn(
        skeletonFrameVariants({ rounded }),
        animatedBorder
          ? 'skeleton-border-width border-solid border-transparent bg-surface-hover-grey bg-clip-padding'
          : 'overflow-hidden',
        className,
      )}
      {...props}
    >
      {animatedBorder ? (
        <div
          aria-hidden
          className={cn(
            'skeleton-border-spinner skeleton-border-ring pointer-events-none z-0 overflow-hidden',
            roundedVariants[rounded ?? 'xl'],
          )}
        >
          <div
            className={cn(
              showSpinBorder && SKELETON_BORDER_SPIN,
              showShiftBorder && cn('absolute inset-0', SKELETON_BORDER_SHIFT),
            )}
          />
        </div>
      ) : null}
      <div data-slot="skeleton-frame-fill" className={skeletonFrameFillVariants({ rounded, pulse })}>
        {children}
      </div>
    </div>
  );
}

export { SkeletonFrame, skeletonFrameVariants };
