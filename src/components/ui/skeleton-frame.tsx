import type { ComponentProps } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const roundedVariants = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
} as const;

const skeletonFrameVariants = cva('relative isolate overflow-hidden p-0.5', {
  variants: {
    rounded: roundedVariants,
  },
  defaultVariants: {
    rounded: 'xl',
  },
});

const skeletonFrameFillVariants = cva('relative z-10 h-full w-full bg-surface-hover-grey', {
  variants: {
    rounded: roundedVariants,
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

const SKELETON_BORDER_SPIN = 'skeleton-border-spin-fill animate-skeleton-border-spin';
const SKELETON_BORDER_SHIFT =
  'animate-skeleton-border bg-gradient-to-r from-border-information via-border-action to-border-information bg-[length:400%_400%]';

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
}: SkeletonFrameProps) {
  const showShiftBorder = animatedBorder && motion === 'shift';
  const showSpinBorder = animatedBorder && motion === 'spin';

  return (
    <div
      data-slot="skeleton-frame"
      data-motion={animatedBorder ? motion : 'none'}
      className={cn(skeletonFrameVariants({ rounded }), className)}
      {...props}
    >
      {animatedBorder ? (
        <div
          aria-hidden
          className={cn(
            'skeleton-border-ring pointer-events-none absolute inset-0 z-0',
            roundedVariants[rounded ?? 'xl'],
            showSpinBorder && SKELETON_BORDER_SPIN,
            showShiftBorder && SKELETON_BORDER_SHIFT,
          )}
        />
      ) : null}
      <div data-slot="skeleton-frame-fill" className={skeletonFrameFillVariants({ rounded, pulse })}>
        {children}
      </div>
    </div>
  );
}

export { SkeletonFrame, skeletonFrameVariants };
