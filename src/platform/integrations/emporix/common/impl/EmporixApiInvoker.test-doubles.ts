import type { DebugCallSource } from '@/platform/core/utils/debug-event-bus';
import type { MetricsService } from '@/platform/services/metrics/MetricsService';
import type { RequestContextService } from '@/platform/services/request-context/RequestContextService';

/**
 * Test doubles for the two collaborators `EmporixApiInvoker` needs beyond the config and
 * the token manager. Integration tests build the invoker by hand rather than resolving it
 * from a generated container, so they have to supply these themselves.
 *
 * Not a test file: the name deliberately avoids the `*.test.ts` / `*.spec.ts` suffixes
 * that Jest's `testMatch` picks up.
 */

/**
 * Metrics reported as disabled, so the invoker's instrumentation short-circuits before it
 * touches a registry. Cast because the full interface also exposes prom-client types that
 * no caller of this double needs.
 */
export function disabledMetricsService(): MetricsService {
  return {
    isEnabled: () => false,
  } as unknown as MetricsService;
}

/**
 * Minimal request context. `getCallSource()` defaults to `'client'` to mirror the server
 * container — see {@link RequestContextService.getCallSource} for why that is not `'server'`.
 */
export function testRequestContext(callSource: DebugCallSource = 'client'): RequestContextService {
  return {
    getSite: async () => 'test-site',
    getCurrency: async () => undefined,
    getLanguage: async () => undefined,
    getCallSource: () => callSource,
  };
}
