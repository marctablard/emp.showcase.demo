'use client';

import { useCallback, useRef } from 'react';

interface UseRateLimitOptions {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

interface UseRateLimitReturn {
  /** Check if a request is allowed, returns false if rate limited */
  checkRateLimit: () => boolean;
  /** Get the number of remaining requests in the current window */
  getRemainingRequests: () => number;
  /** Reset the rate limit counter */
  reset: () => void;
}

/**
 * Client-side rate limiting hook
 * @param options - Rate limit configuration
 * @returns Rate limit functions
 */
export function useRateLimit({ maxRequests, windowMs }: UseRateLimitOptions): UseRateLimitReturn {
  const requests = useRef<number[]>([]);

  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    // Remove requests outside the current window
    requests.current = requests.current.filter((time) => now - time < windowMs);

    if (requests.current.length >= maxRequests) {
      return false; // Rate limited
    }

    requests.current.push(now);
    return true; // Allowed
  }, [maxRequests, windowMs]);

  const getRemainingRequests = useCallback((): number => {
    const now = Date.now();
    requests.current = requests.current.filter((time) => now - time < windowMs);
    return Math.max(0, maxRequests - requests.current.length);
  }, [maxRequests, windowMs]);

  const reset = useCallback(() => {
    requests.current = [];
  }, []);

  return { checkRateLimit, getRemainingRequests, reset };
}
