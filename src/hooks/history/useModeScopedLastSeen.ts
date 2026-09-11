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

/**
 * Self-describing validation result: it names the mode and ids it was computed for and the cached
 * lookup that produced it, so staleness is derived during render instead of resetting state.
 */
interface ValidatedIds {
  mode: ProductsMode;
  idsKey: string;
  /** The cached lookup this result came from; a cleared/replaced cache entry makes the result stale. */
  source: Promise<Set<string>>;
  resolvedIds: Set<string>;
}

/**
 * Module-level cache keyed by `[mode, ids]`: the header search fly-out unmounts on every close,
 * so re-opening it with the same last-seen ids must not hit `/api/products/[id]` again.
 * Cleared whenever the mode leaves `assigned` (logout, ALL products), so a later segmented session
 * — possibly another customer — is validated afresh.
 */
const validationCache = new Map<string, Promise<Set<string>>>();
/** Lookups that rejected stay in the cache (so the fail-closed result remains current) but are retried on the next open. */
const rejectedLookups = new WeakSet<Promise<Set<string>>>();

function buildCacheKey(mode: ProductsMode, idsKey: string): string {
  return `${mode}:${idsKey}`;
}

/** Drops every cached `[mode, ids]` validation result. */
export function clearModeScopedLastSeenCache(): void {
  validationCache.clear();
}

/**
 * Resolves the ids that `/api/products/[id]` still returns in the current mode (an out-of-scope
 * product answers 404 → `null`). A rejected lookup is replaced on the next call so the next open retries.
 */
function validateIds(ids: string[], cacheKey: string): Promise<Set<string>> {
  const existing = validationCache.get(cacheKey);
  if (existing && !rejectedLookups.has(existing)) {
    return existing;
  }

  const promise = Promise.all(ids.map(async (id) => ((await fetchProductById(id)) ? id : null))).then(
    (resolved) => new Set(resolved.filter((id): id is string => id !== null)),
  );
  validationCache.set(cacheKey, promise);
  promise.catch(() => {
    rejectedLookups.add(promise);
  });

  return promise;
}

/**
 * A stored result is current only for the mode and ids it was computed for **and** while the cache
 * still holds the lookup that produced it. Leaving `assigned` clears the cache, so after re-entering
 * (possibly as another customer) the earlier result is stale until the fresh lookup resolves.
 */
function isCurrentValidation(
  validated: ValidatedIds | null,
  mode: ProductsMode,
  idsKey: string,
  cacheKey: string,
): validated is ValidatedIds {
  return (
    validated !== null &&
    validated.mode === mode &&
    validated.idsKey === idsKey &&
    validationCache.get(cacheKey) === validated.source
  );
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
  const idsKey = ids.join(',');
  const cacheKey = buildCacheKey(mode, idsKey);
  const needsValidation = mode === 'assigned' && ids.length > 0;

  useEffect(() => {
    // Leaving the segmented scope (logout, ALL products) forgets the cached lookups, which also marks
    // the local result stale (see `isCurrentValidation`) so the next assigned session starts afresh.
    if (mode !== 'assigned') {
      clearModeScopedLastSeenCache();
    }
    if (!needsValidation) {
      return;
    }

    let cancelled = false;
    const source = validateIds(ids, cacheKey);
    const commit = (resolvedIds: Set<string>) => {
      // Skip the no-op update when the same lookup was already applied (e.g. a re-run of the effect).
      setValidated((previous) => (previous?.source === source ? previous : { mode, idsKey, source, resolvedIds }));
    };

    source
      .then((resolvedIds) => {
        if (cancelled) {
          return;
        }
        logger.debug(
          { mode, total: ids.length, dropped: ids.length - resolvedIds.size },
          'Hid last-seen products outside the assigned products scope',
        );
        commit(resolvedIds);
      })
      .catch(() => {
        if (!cancelled) {
          // Fail closed: a failed lookup hides the cached items instead of exposing out-of-scope products.
          commit(new Set<string>());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mode, ids, idsKey, cacheKey, needsValidation, logger]);

  const currentValidation = isCurrentValidation(validated, mode, idsKey, cacheKey) ? validated : null;
  const validating = needsValidation && currentValidation === null;

  const products = useMemo(() => {
    if (!needsValidation) {
      return lastSeenProducts;
    }
    if (currentValidation === null) {
      return [];
    }
    return lastSeenProducts.filter((product) => currentValidation.resolvedIds.has(product.id));
  }, [needsValidation, currentValidation, lastSeenProducts]);

  return { products, validating };
}

export default useModeScopedLastSeen;
