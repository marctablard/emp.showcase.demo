import { useEffect, useState } from 'react';

/**
 * Standard Tailwind CSS breakpoints in pixels
 * These match the min-width values defined in Tailwind's default configuration
 * @see https://tailwindcss.com/docs/responsive-design
 */
export const breakpoints = {
  sm: 768, // Small screens, like mobile phones in landscape
  md: 1024, // Medium screens, like tablets
  lg: 1280, // Large screens, like laptops
};

/**
 * Type representing valid Tailwind breakpoint names
 */
type Breakpoint = keyof typeof breakpoints;

/**
 * React hook that detects if the current viewport width is at or above a specified Tailwind breakpoint
 *
 * @param breakpoint - The Tailwind breakpoint to check against ('sm', 'md', 'lg')
 * @returns boolean - True if the current viewport width is >= the specified breakpoint width, otherwise false
 *
 * @example
 * // Check if the screen is at least 'lg' (1280px) wide
 * const isLargeScreen = useBreakpoint('lg');
 *
 * // Use with negation to check if the screen is below a breakpoint
 * const isMobile = !useBreakpoint('md'); // True when screen width < 1024px
 */
export function useBreakpoint(breakpoint: Breakpoint): boolean {
  // Track whether the current viewport width is at or above the specified breakpoint
  const [isAboveBreakpoint, setIsAboveBreakpoint] = useState(false);

  useEffect(() => {
    // Function to check and update the breakpoint state
    const checkSize = () => {
      setIsAboveBreakpoint(window.innerWidth >= breakpoints[breakpoint]);
    };

    // Initial check when component mounts
    checkSize();

    // Add event listener to update state when window is resized
    window.addEventListener('resize', checkSize);

    // Clean up event listener when component unmounts
    return () => window.removeEventListener('resize', checkSize);
  }, [breakpoint]); // Re-run effect if breakpoint parameter changes

  return isAboveBreakpoint;
}
