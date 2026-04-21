import type { FetchMetrics } from './model/metrics';

export const createFetchMetricsParams = (source: string, routePattern: string): FetchMetrics => ({
  source,
  routePattern,
});
