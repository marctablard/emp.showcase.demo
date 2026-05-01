/**
 * Controls which Prometheus metrics are collected and exposed on the /metrics/prometheus endpoint.
 *
 * | Value       | Default process/node metrics | App counters (emx_bff_*_total) | App histograms (emx_bff_*_duration) |
 * |-------------|:---------------------------:|:------------------------------:|:-----------------------------------:|
 * | `both`      | yes                         | yes                            | yes                                 |
 * | `counter`   | no                          | yes                            | no                                  |
 * | `histogram` | no                          | no                             | yes                                 |
 * | `app`       | no                          | yes                            | yes                                 |
 * | `default`   | yes                         | no                             | no                                  |
 */
export type MonitoringType = 'both' | 'counter' | 'histogram' | 'app' | 'default';

const VALID_TYPES: ReadonlySet<string> = new Set(['both', 'counter', 'histogram', 'app', 'default']);

export function resolveMonitoringType(): MonitoringType {
  const raw = (process.env.NEXT_MONITORING_TYPE ?? 'both').toLowerCase().trim();
  if (VALID_TYPES.has(raw)) {
    return raw as MonitoringType;
  }
  return 'both';
}

const TYPES_WITH_DEFAULT_METRICS: ReadonlySet<MonitoringType> = new Set(['both', 'default']);
const TYPES_WITH_COUNTERS: ReadonlySet<MonitoringType> = new Set(['both', 'counter', 'app']);
const TYPES_WITH_HISTOGRAMS: ReadonlySet<MonitoringType> = new Set(['both', 'histogram', 'app']);

export function shouldCollectDefaultMetrics(type: MonitoringType): boolean {
  return TYPES_WITH_DEFAULT_METRICS.has(type);
}

export function shouldCollectCounters(type: MonitoringType): boolean {
  return TYPES_WITH_COUNTERS.has(type);
}

export function shouldCollectHistograms(type: MonitoringType): boolean {
  return TYPES_WITH_HISTOGRAMS.has(type);
}
