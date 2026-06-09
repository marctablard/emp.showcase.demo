import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { MetricsService } from '@/platform/services/metrics/MetricsService';

/**
 * Next.js instrumentation hook
 * This function is called once when the Next.js server starts
 * Used to initialize server-side logger with pino-pretty configuration
 */
export async function register() {
  // Only initialize in Node.js runtime (not Edge Runtime)
  // The server container uses Node.js APIs that aren't available in Edge Runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamic import to avoid loading Node.js modules in Edge Runtime
    const server = await import('@/platform/server');
    const logger = server.default.get<LoggerService>('LoggerService');
    logger.info('Server logger initialized');

    // DEV-ONLY: pino-pretty transport workers (used only when NODE_ENV=development)
    // each spawn a worker thread that pipes formatted output to process.stdout/stderr.
    // Each pipe attaches 5 listeners (unpipe, error, close, finish, end).
    // With 5 pino instances in dev (server _diLogger, ssr _diLogger,
    // PinoLoggerServiceServer, PinoLoggerServiceSSR, _debugLogger) that's
    // up to 25 listeners per stream — exceeding the Node.js default of 10
    // (set in lib/events.js as EventEmitter.defaultMaxListeners = 10).
    //
    // In production, pino writes raw JSON directly to stdout without transport
    // workers, so no extra listeners are created and the default of 10 is fine.
    if (process.env.NODE_ENV === 'development') {
      process.stdout.setMaxListeners(30);
      process.stderr.setMaxListeners(30);
    }

    const metricsService = server.default.get<MetricsService>('MetricsService');
    const { startMetricsServer } = await import('./metrics-server');
    const { started, port, host } = startMetricsServer(metricsService);
    if (started) {
      logger.info({ port, host }, 'Metrics server started');
    } else {
      logger.info('Metrics disabled (NEXT_METRICS_ENABLED is not "true")');
    }

    // Tier 2: Runtime configuration healthcheck (sites, currencies, languages vs Emporix API)
    const { runStartupHealthcheck } = await import('@/platform/healthcheck/startup-healthcheck');
    await runStartupHealthcheck(server.default);
  }
}
