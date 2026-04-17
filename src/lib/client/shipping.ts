import {
  buildShippingMethodsCacheKey,
  buildShippingMethodsSessionScope,
  readShippingMethodsCache,
  writeShippingMethodsCache,
} from '@/lib/client/shipping-methods-response-cache';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { ShippingMethod } from '@/platform/services/model/shipping';

export type { ShippingMethodsSessionScope } from '@/lib/client/shipping-methods-response-cache';
export { invalidateShippingMethodsResponseCache } from '@/lib/client/shipping-methods-response-cache';

const shippingMethodsInFlight = new Map<string, Promise<ShippingMethod[]>>();

async function fetchShippingMethodsFromNetwork(
  countryCode: string,
  postalCode: string,
  orderValue?: { amount: number; currency: string },
): Promise<ShippingMethod[]> {
  let url = `/api/shipping?countryCode=${encodeURIComponent(countryCode)}&postalCode=${encodeURIComponent(postalCode)}`;

  if (orderValue) {
    url += `&amount=${encodeURIComponent(orderValue.amount)}&currency=${encodeURIComponent(orderValue.currency)}`;
  }

  const response = await fetch(url, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch shipping methods: ${response.statusText}`);
  }

  return (await response.json()) as ShippingMethod[];
}

/**
 * Get shipping methods for a country and postal code.
 * When `sessionContext` is passed, responses are cached (TTL + LRU) and coalesced per cache key;
 * the key includes site, session currency, legal entity, and the same query params sent to the API.
 */
export async function getShippingMethods(
  countryCode: string,
  postalCode: string,
  orderValue?: { amount: number; currency: string },
  sessionContext?: { siteCode?: string; currency?: string; legalEntityId?: string | null },
): Promise<ShippingMethod[]> {
  try {
    if (!sessionContext) {
      return await fetchShippingMethodsFromNetwork(countryCode, postalCode, orderValue);
    }

    const scope = buildShippingMethodsSessionScope(sessionContext);
    const cacheKey = buildShippingMethodsCacheKey(scope, countryCode, postalCode, orderValue);

    const cached = readShippingMethodsCache(cacheKey);
    if (cached) {
      return cached;
    }

    const pending = shippingMethodsInFlight.get(cacheKey);
    if (pending) {
      return pending;
    }

    const promise = (async () => {
      try {
        const methods = await fetchShippingMethodsFromNetwork(countryCode, postalCode, orderValue);
        writeShippingMethodsCache(cacheKey, methods);
        return methods;
      } finally {
        shippingMethodsInFlight.delete(cacheKey);
      }
    })();

    shippingMethodsInFlight.set(cacheKey, promise);
    return await promise;
  } catch (error) {
    getLogger().error({ err: error, countryCode, postalCode }, 'Error fetching shipping methods');
    throw error;
  }
}

/**
 * Get a shipping method by ID
 * @param methodId The method ID
 * @param zoneId The zone ID
 * @returns The shipping method if found
 */
export async function getShippingMethod(methodId: string, zoneId: string): Promise<ShippingMethod | undefined> {
  try {
    const response = await fetch(`/api/shipping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ methodId, zoneId }),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch shipping method: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    getLogger().error({ err: error, methodId, zoneId }, 'Error fetching shipping method');
    throw error;
  }
}
