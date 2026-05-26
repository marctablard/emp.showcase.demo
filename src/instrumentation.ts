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
    // Raise the default listener cap so HTTP keep-alive sockets shared by
    // concurrent SSE / long-poll / Playwright connections don't trigger the
    // spurious MaxListenersExceededWarning. 20 is plenty for legitimate use
    // while still catching real leaks (default 10 is too low for dev servers).
    const { EventEmitter } = await import('events');
    EventEmitter.defaultMaxListeners = 20;
    // Dynamic import to avoid loading Node.js modules in Edge Runtime
    const server = await import('@/platform/server');
    const logger = server.default.get<LoggerService>('LoggerService');
    logger.info('Server logger initialized');

    const metricsService = server.default.get<MetricsService>('MetricsService');
    const { startMetricsServer } = await import('./metrics-server');
    const { started, port, host } = startMetricsServer(metricsService);
    if (started) {
      logger.info({ port, host }, 'Metrics server started');
    } else {
      logger.info('Metrics disabled (NEXT_METRICS_ENABLED is not "true")');
    }

    // Bind the active CmsAdapter alias on both server- and ssr-side containers.
    // `CmsAdapter:<id>` implementations declare themselves via @injectable; this
    // step decides which one `CmsAdapter` resolves to at runtime, driven by env.
    const ssr = await import('@/platform/ssr');
    const { resolveCmsProvider } = await import('@/platform/services/cms/CmsProviderResolver');
    const providerId = resolveCmsProvider(process.env);
    const cmsAdapterTarget = `CmsAdapter:${providerId}`;
    for (const c of [server.default, ssr.default]) {
      if (c.isBound(cmsAdapterTarget)) {
        if (c.isBound('CmsAdapter')) {
          c.unbind('CmsAdapter');
        }
        c.bind('CmsAdapter').toService(cmsAdapterTarget);
      } else {
        logger.warn({ providerId, cmsAdapterTarget }, 'CMS adapter target not bound — CmsAdapter alias not registered');
      }
    }

    // Tier 2: Runtime configuration healthcheck (sites, currencies, languages vs Emporix API)
    const { runStartupHealthcheck } = await import('@/platform/healthcheck/startup-healthcheck');
    await runStartupHealthcheck(server.default);
  }
}
