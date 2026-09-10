'use client';

import { useEffect, useMemo, useState } from 'react';
import { useProductsMode } from '@/components/navigation/products-mode-context';
import { useLogger } from '@/hooks/common/useLogger';
import { useHistory } from '@/hooks/history/useHistory';
import { fetchProductById } from '@/lib/client/products';
import type { Product } from '@/platform/services/model/product';
import type { ProductsMode } from '@/platform/services/products-mode/ProductsModeService';

interface UseModeScopedLastSeenResult {
  /** Last-seen products that are visible in the current products mode. */
  products: Product[];
  /** `true` while the assigned-mode re-validation for the current ids is still pending. */
  validating: boolean;
}

interface ValidatedIds {
  key: string;
  resolvedIds: Set<string>;
}

/**
 * Module-level cache keyed by `[mode, ids]`: the header search fly-out unmounts on every close,
 * so re-opening it with the same last-seen ids must not hit `/api/products/[id]` again.
 * Cleared whenever the mode leaves `assigned` (logout, ALL products), so a later segmented session
 * — possibly another customer — is validated afresh.
 */
const validationCache = new Map<string, Promise<Set<string>>>();

function buildCacheKey(mode: ProductsMode, ids: string[]): string {
  return `${mode}:${ids.join(',')}`;
}

/** Drops every cached `[mode, ids]` validation result. */
export function clearModeScopedLastSeenCache(): void {
  validationCache.clear();
}

/**
 * Resolves the ids that `/api/products/[id]` still returns in the current mode (an out-of-scope
 * product answers 404 → `null`). A rejected lookup drops the cache entry so the next open retries.
 */
function validateIds(ids: string[], cacheKey: string): Promise<Set<string>> {
  const existing = validationCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = Promise.all(ids.map(async (id) => ((await fetchProductById(id)) ? id : null))).then(
    (resolved) => new Set(resolved.filter((id): id is string => id !== null)),
  );
  validationCache.set(cacheKey, promise);
  promise.catch(() => {
    if (validationCache.get(cacheKey) === promise) {
      validationCache.delete(cacheKey);
    }
  });

  return promise;
}

/**
 * Last-seen products scoped to the products mode (COP-4822). The `HistoryStore` persists full
 * `Product` objects, so after a mode transition (login into a segment, ASSIGNED ⇄ ALL, logout) the
 * cached items may lie outside the current scope. In `assigned` mode the ids are re-validated through
 * `/api/products/[id]` (which already honours the mode server-side) and only the products that resolve
 * are returned; the list stays empty while validation is pending so an out-of-segment product never
 * flashes. Every other mode returns the cached items without any request.
 */
export function useModeScopedLastSeen(): UseModeScopedLastSeenResult {
  const { lastSeenProducts } = useHistory();
  const { mode } = useProductsMode();
  const logger = useLogger();
  const [validated, setValidated] = useState<ValidatedIds | null>(null);

  const ids = useMemo(() => lastSeenProducts.map((product) => product.id), [lastSeenProducts]);
  const cacheKey = buildCacheKey(mode, ids);
  const needsValidation = mode === 'assigned' && ids.length > 0;

  // Leaving the segmented scope (logout, ALL products) forgets the local validation result so the
  // next assigned session — possibly another customer — starts from a fresh lookup. Adjusted during
  // render (not from an effect); once `validated` is null the condition no longer holds.
  if (mode !== 'assigned' && validated !== null) {
    setValidated(null);
  }

  useEffect(() => {
    if (mode !== 'assigned') {
      clearModeScopedLastSeenCache();
    }
    if (!needsValidation) {
      return;
    }

    let cancelled = false;
    validateIds(ids, cacheKey)
      .then((resolvedIds) => {
        if (cancelled) {
          return;
        }
        logger.debug(
          { mode, total: ids.length, dropped: ids.length - resolvedIds.size },
          'Hid last-seen products outside the assigned products scope',
        );
        // Skip the no-op update when the same key was already applied (e.g. a re-run of the effect).
        setValidated((previous) => (previous?.key === cacheKey ? previous : { key: cacheKey, resolvedIds }));
      })
      .catch(() => {
        if (!cancelled) {
          // Fail closed: a failed lookup hides the cached items instead of exposing out-of-scope products.
          setValidated((previous) =>
            previous?.key === cacheKey ? previous : { key: cacheKey, resolvedIds: new Set<string>() },
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mode, ids, cacheKey, needsValidation, logger]);

  const validating = needsValidation && validated?.key !== cacheKey;

  const products = useMemo(() => {
    if (!needsValidation) {
      return lastSeenProducts;
    }
    if (validating || !validated) {
      return [];
    }
    return lastSeenProducts.filter((product) => validated.resolvedIds.has(product.id));
  }, [needsValidation, validating, validated, lastSeenProducts]);

  return { products, validating };
}

export default useModeScopedLastSeen;
