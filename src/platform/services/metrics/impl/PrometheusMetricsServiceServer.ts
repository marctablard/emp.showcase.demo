import { Counter, Histogram, type Registry } from 'prom-client';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type { MetricsService } from '../MetricsService';
import {
  type MonitoringType,
  resolveMonitoringType,
  shouldCollectCounters,
  shouldCollectDefaultMetrics,
  shouldCollectHistograms,
} from '../monitoring-type';
import { getSharedRegistry } from '../shared-registry';

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
class PrometheusMetricsServiceServer implements MetricsService {
  private readonly enabled: boolean;
  private readonly registry: Registry | null;
  private readonly monitoringType: MonitoringType;
  private readonly countersEnabled: boolean;
  private readonly histogramsEnabled: boolean;

  constructor() {
    this.enabled = process.env.NEXT_METRICS_ENABLED === 'true';
    this.monitoringType = resolveMonitoringType();
    this.countersEnabled = shouldCollectCounters(this.monitoringType);
    this.histogramsEnabled = shouldCollectHistograms(this.monitoringType);

    if (this.enabled) {
      this.registry = getSharedRegistry(shouldCollectDefaultMetrics(this.monitoringType));
    } else {
      this.registry = null;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getMonitoringType(): MonitoringType {
    return this.monitoringType;
  }

  getRegistry(): Registry {
    if (!this.registry) {
      throw new Error('MetricsService is disabled — getRegistry() should not be called when isEnabled() returns false');
    }
    return this.registry;
  }

  getOrCreateCounter(name: string, help: string, labelNames: readonly string[]): Counter {
    if (!this.enabled || !this.registry || !this.countersEnabled) {
      return noopCounter;
    }

    const existing = this.registry.getSingleMetric(name);
    if (existing) {
      return existing as Counter;
    }

    return new Counter({ name, help, labelNames: [...labelNames], registers: [this.registry] });
  }

  getOrCreateHistogram(name: string, help: string, labelNames: readonly string[], buckets?: number[]): Histogram {
    if (!this.enabled || !this.registry || !this.histogramsEnabled) {
      return noopHistogram;
    }

    const existing = this.registry.getSingleMetric(name);
    if (existing) {
      return existing as Histogram;
    }

    return new Histogram({
      name,
      help,
      labelNames: [...labelNames],
      buckets,
      registers: [this.registry],
    });
  }
}

export default PrometheusMetricsServiceServer;
