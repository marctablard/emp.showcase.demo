import { getLogger } from '@/lib/logger/use-logger-client';

/** Structured debug for site/session/cart sync — development builds only. */
export function devSyncLog(message: string, fields: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'development') {
    getLogger().debug(fields, message);
  }
}
