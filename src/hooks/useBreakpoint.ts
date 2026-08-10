'use client';

import { useEffect, useState } from 'react';
import { type Breakpoint, breakpoints } from '@/lib/breakpoints';

// Re-exported so existing `@/hooks/useBreakpoint` imports of the constant keep working.
export { breakpoints } from '@/lib/breakpoints';
export type { Breakpoint } from '@/lib/breakpoints';

/**
 * React hook that detects whether the current viewport width is at or above a given
 * design-system breakpoint.
 *
 * The breakpoints (`sm` 768 / `md` 1024 / `lg` 1280) are this project's own scale,
 * defined once in `@/lib/breakpoints` and mirrored in `globals.css`. They are NOT
 * Tailwind's defaults (which would be 640/768/1024/1280/1536).
 *
 * @param breakpoint - 'sm' | 'md' | 'lg'
 * @returns true when `window.innerWidth >= breakpoints[breakpoint]`
 *
 * @example
 * const isLargeScreen = useBreakpoint('lg'); // ≥ 1280px
 * const isMobile = !useBreakpoint('md');     // < 1024px
 */
export function useBreakpoint(breakpoint: Breakpoint): boolean {
  // Track whether the current viewport width is at or above the specified breakpoint
  const [isAboveBreakpoint, setIsAboveBreakpoint] = useState(false);

  useEffect(() => {
    const checkSize = () => {
      setIsAboveBreakpoint(window.innerWidth >= breakpoints[breakpoint]);
    };

    // Initial check when component mounts
    checkSize();

    // Update when the viewport is resized
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, [breakpoint]);

  return isAboveBreakpoint;
}
