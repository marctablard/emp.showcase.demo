import { getLogger } from '@/lib/logger/use-logger-client';
import type { TaxClassRate } from '@/platform/services/tax/TaxService';

const taxClassesByCountry = new Map<string, TaxClassRate[]>();
const taxClassesInFlight = new Map<string, Promise<TaxClassRate[]>>();

function cacheKeyForCountry(countryCode: string): string {
  return countryCode.trim().toUpperCase();
}

async function fetchTaxClassesFromNetwork(countryCode: string): Promise<TaxClassRate[]> {
  const response = await fetch(`/api/tax?countryCode=${encodeURIComponent(countryCode)}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tax classes: ${response.statusText}`);
  }

  const payload = (await response.json()) as { taxClasses?: TaxClassRate[] };
  return payload.taxClasses ?? [];
}

/**
 * Get tax classes for a destination country.
 * Caches and coalesces the country list per `countryCode` so later class lookups reuse one request.
 */
export async function getTaxClasses(countryCode: string): Promise<TaxClassRate[]> {
  try {
    const cacheKey = cacheKeyForCountry(countryCode);
    const cached = taxClassesByCountry.get(cacheKey);
    if (cached) {
      return cached;
    }

    const pending = taxClassesInFlight.get(cacheKey);
    if (pending) {
      return pending;
    }

    const promise = (async () => {
      try {
        const taxClasses = await fetchTaxClassesFromNetwork(cacheKey);
        taxClassesByCountry.set(cacheKey, taxClasses);
        return taxClasses;
      } finally {
        taxClassesInFlight.delete(cacheKey);
      }
    })();

    taxClassesInFlight.set(cacheKey, promise);
    return await promise;
  } catch (error) {
    getLogger().error({ err: error, countryCode }, 'Error fetching tax classes');
    throw error;
  }
}
