/**
 * React hook for accessing the logger in client components
 * Provides a stable logger reference that can be used throughout component lifecycle
 */

'use client';

import { useMemo } from 'react';
import { getLogger } from '@/lib/logger/browser-logger';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

/**
 * Hook for accessing the client-side logger
 * Returns a stable logger reference that persists across re-renders
 * @returns Logger service instance
 */
export function useLogger(): LoggerService {
  return useMemo(() => getLogger(), []);
}
