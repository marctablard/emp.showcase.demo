'use client';

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex w-full touch-none select-none items-center', className)}
    {...props}
  >
    <SliderPrimitive.Track
      className={cn(
        'relative h-2.5 w-full grow overflow-hidden rounded-full bg-surface-information border border-border-primary',
        'data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:bg-surface-disabled',
      )}
    >
      <SliderPrimitive.Range
        className={cn('absolute h-full bg-surface-action data-[disabled]:bg-surface-disabled-selected')}
      />
    </SliderPrimitive.Track>
    {(props.value ?? props.defaultValue)?.map((_, index) => (
      <SliderPrimitive.Thumb
        key={index}
        className={cn(
          'block h-6 w-6 rounded-full border-2 border-border-white bg-surface-action shadow transition-colors',
          'hover:bg-surface-action-hover',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
          'data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:bg-surface-disabled data-[disabled]:border-border-disabled',
        )}
      />
    ))}
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
