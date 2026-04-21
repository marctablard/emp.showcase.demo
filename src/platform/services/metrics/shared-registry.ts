import { Registry, collectDefaultMetrics } from 'prom-client';

const REGISTRY_KEY = Symbol.for('emx_prom_shared_registry');
const DEFAULTS_COLLECTED_KEY = Symbol.for('emx_prom_defaults_collected');

type GlobalWithRegistry = typeof globalThis & {
  [key: symbol]: Registry | boolean | undefined;
};

/**
 * Returns a process-wide shared Prometheus Registry.
 *
 * Uses `globalThis` (via well-known Symbols) so that both the server DI
 * container (API routes) and the SSR DI container (React Server Components)
 * write into the **same** registry — even though Next.js evaluates their
 * modules in separate contexts.
 */
export function getSharedRegistry(includeDefaultMetrics: boolean = true): Registry {
  const g = globalThis as GlobalWithRegistry;

  if (!g[REGISTRY_KEY]) {
    g[REGISTRY_KEY] = new Registry();
  }

  const registry = g[REGISTRY_KEY] as Registry;

  if (includeDefaultMetrics && !g[DEFAULTS_COLLECTED_KEY]) {
    collectDefaultMetrics({ register: registry });
    g[DEFAULTS_COLLECTED_KEY] = true;
  }

  return registry;
}
