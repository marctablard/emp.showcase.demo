import type { Counter, Histogram, Registry } from 'prom-client';
import type { MonitoringType } from './monitoring-type';

export interface MetricsService {
  isEnabled(): boolean;
  getMonitoringType(): MonitoringType;
  getRegistry(): Registry;
  getOrCreateCounter(name: string, help: string, labelNames: readonly string[]): Counter;
  getOrCreateHistogram(name: string, help: string, labelNames: readonly string[], buckets?: number[]): Histogram;
}
