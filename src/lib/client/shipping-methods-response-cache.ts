import type { ShippingMethod } from '@/platform/services/model/shipping';

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 64;

export interface ShippingMethodsSessionScope {
  siteCode: string;
  currency: string;
  /** Normalized B2B company context; empty when none */
  legalEntityId: string;
}

interface CacheEntry {
  methods: ShippingMethod[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
/** Oldest keys first for LRU eviction */
const keyQueue: string[] = [];

function normalizeLegalEntityId(legalEntityId?: string | null): string {
  if (typeof legalEntityId !== 'string') {
    return '';
  }
  return legalEntityId.trim();
}

export function buildShippingMethodsSessionScope(session: {
  siteCode?: string;
  currency?: string;
  legalEntityId?: string | null;
}): ShippingMethodsSessionScope {
  return {
    siteCode: session.siteCode ?? '',
    currency: session.currency ?? '',
    legalEntityId: normalizeLegalEntityId(session.legalEntityId),
  };
}

export function buildShippingMethodsCacheKey(
  scope: ShippingMethodsSessionScope,
  countryCode: string,
  postalCode: string,
  orderValue?: { amount: number; currency: string },
): string {
  const amount =
    orderValue?.amount !== undefined && orderValue?.amount !== null ? String(Number(orderValue.amount)) : '';
  const orderCurrency = orderValue?.currency ?? '';
  return `${scope.siteCode}|${scope.currency}|${scope.legalEntityId}|${countryCode}|${postalCode}|${amount}|${orderCurrency}`;
}

function touchKey(key: string): void {
  const idx = keyQueue.indexOf(key);
  if (idx >= 0) {
    keyQueue.splice(idx, 1);
  }
  keyQueue.push(key);
  while (keyQueue.length > MAX_ENTRIES) {
    const oldest = keyQueue.shift();
    if (oldest) {
      cache.delete(oldest);
    }
  }
}

export function readShippingMethodsCache(key: string): ShippingMethod[] | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    const i = keyQueue.indexOf(key);
    if (i >= 0) {
      keyQueue.splice(i, 1);
    }
    return null;
  }
  return entry.methods;
}

export function writeShippingMethodsCache(
  key: string,
  methods: ShippingMethod[],
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  touchKey(key);
  cache.set(key, { methods, expiresAt: Date.now() + ttlMs });
}

export function invalidateShippingMethodsResponseCache(): void {
  cache.clear();
  keyQueue.length = 0;
}
