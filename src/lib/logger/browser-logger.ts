'use client';

import pino from 'pino';
import { getClientLoggerConfig } from '@/platform/core/config/logger-config';
import type { LogContext, LoggerService } from '@/platform/services/logger/LoggerService';

function createPinoLoggerService(): LoggerService {
  const logger = pino(getClientLoggerConfig());

  const wrap =
    (level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal') =>
    (messageOrContext: string | LogContext, message?: string): void => {
      if (message === undefined) {
        logger[level](messageOrContext as string);
      } else {
        logger[level](messageOrContext as LogContext, message);
      }
    };

  return {
    trace: wrap('trace'),
    debug: wrap('debug'),
    info: wrap('info'),
    warn: wrap('warn'),
    error: wrap('error'),
    fatal: wrap('fatal'),
  };
}

let loggerInstance: LoggerService | null = null;

export function getLogger(): LoggerService {
  if (!loggerInstance) {
    loggerInstance = createPinoLoggerService();
  }
  return loggerInstance;
}
