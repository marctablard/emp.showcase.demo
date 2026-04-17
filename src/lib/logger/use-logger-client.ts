/**
 * Client logger entry point for non-React modules (stores, lib/client, etc.).
 * Delegates to the standalone browser Pino instance (no DI).
 */

'use client';

export { getLogger } from '@/lib/logger/browser-logger';
export type { LoggerService } from '@/platform/services/logger/LoggerService';
