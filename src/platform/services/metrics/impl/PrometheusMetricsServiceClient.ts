import type { Counter, Histogram, Registry } from 'prom-client';
import { injectable } from '@/platform/core/di/injectable';
import type { MetricsService } from '../MetricsService';
import type { MonitoringType } from '../monitoring-type';

const noopCounter = {
  inc: () => {},
  labels: () => noopCounter,
} as unknown as Counter;

const noopHistogram = {
  observe: () => {},
  startTimer: () => () => {},
  labels: () => noopHistogram,
} as unknown as Histogram;

@injectable('MetricsService', 'Singleton')
class PrometheusMetricsServiceClient implements MetricsService {
  isEnabled(): boolean {
    return false;
  }

  getMonitoringType(): MonitoringType {
    return 'default';
  }

  getRegistry(): Registry {
    throw new Error('MetricsService is disabled on the client — getRegistry() is server-only');
  }

  getOrCreateCounter(_name: string, _help: string, _labelNames: readonly string[]): Counter {
    return noopCounter;
  }

  getOrCreateHistogram(_name: string, _help: string, _labelNames: readonly string[], _buckets?: number[]): Histogram {
    return noopHistogram;
  }
}

export default PrometheusMetricsServiceClient;
