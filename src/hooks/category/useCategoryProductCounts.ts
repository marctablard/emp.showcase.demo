'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchCategoryProductCount } from '@/lib/client/category';
import { getLogger } from '@/lib/logger/use-logger-client';

/**
 * Max concurrent in-flight requests for category counts. The PLP tree can fan out to hundreds of
 * categories, so we throttle to avoid overwhelming the BFF and the browser's HTTP queue.
 */
const DEFAULT_CONCURRENCY = 4;

export interface UseCategoryProductCountsResult {
  /**
   * Map of `categoryId` → product count. Missing entries mean the count has not been fetched yet
   * (or the lookup failed — callers should treat absence as "unknown"). Counts are lazily loaded.
   */
  counts: Record<string, number>;
  /**
   * Whether any count request is currently in flight. Intended for lightweight UI signaling; do
   * not block rendering on it.
   */
  loading: boolean;
  /**
   * Ensure counts are loaded for the supplied category ids. Already-known, already-in-flight, and
   * empty ids are skipped. Safe to call repeatedly with the same ids.
   */
  requestCounts: (categoryIds: readonly string[]) => void;
}

/**
 * Best-effort loader for per-category product counts used by the PLP tree and carousel.
 *
 * Counts are cached per hook instance (request-scoped via React), requested lazily on demand and
 * deduped across calls, and never throw — failures simply leave the count out of the map.
 */
export const useCategoryProductCounts = (
  initialCounts?: Readonly<Record<string, number>>,
  options?: { concurrency?: number },
): UseCategoryProductCountsResult => {
  const concurrency = Math.max(1, options?.concurrency ?? DEFAULT_CONCURRENCY);

  const [counts, setCounts] = useState<Record<string, number>>(() => ({ ...(initialCounts ?? {}) }));
  const [inFlightCount, setInFlightCount] = useState(0);

  const inFlightIds = useRef<Set<string>>(new Set());
  const queueRef = useRef<string[]>([]);
  const isMountedRef = useRef(true);
  // `countsRef` mirrors `counts` so the async drain / enqueue code paths can read the latest
  // snapshot without adding `counts` to the callback dep list (which would churn stable
  // references). Updated from an effect — never during render.
  const countsRef = useRef(counts);
  // Indirect self-reference so `processQueue` can re-arm itself from the async `.finally` without
  // reading a callback identifier before it is declared (react-hooks/immutability).
  const processQueueRef = useRef<() => void>(() => {});

  useEffect(() => {
    countsRef.current = counts;
  }, [counts]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const processQueue = useCallback(() => {
    while (inFlightIds.current.size < concurrency && queueRef.current.length > 0) {
      const nextId = queueRef.current.shift();
      if (!nextId) {
        continue;
      }
      if (inFlightIds.current.has(nextId) || nextId in countsRef.current) {
        continue;
      }

      inFlightIds.current.add(nextId);
      setInFlightCount((prev) => prev + 1);

      fetchCategoryProductCount(nextId)
        .then((count) => {
          if (!isMountedRef.current) {
            return;
          }
          setCounts((prev) => (nextId in prev ? prev : { ...prev, [nextId]: count }));
        })
        .catch((err: unknown) => {
          getLogger().debug({ err, categoryId: nextId }, 'useCategoryProductCounts: fetch rejected');
        })
        .finally(() => {
          inFlightIds.current.delete(nextId);
          if (!isMountedRef.current) {
            return;
          }
          setInFlightCount((prev) => Math.max(0, prev - 1));
          processQueueRef.current();
        });
    }
  }, [concurrency]);

  useEffect(() => {
    processQueueRef.current = processQueue;
  }, [processQueue]);

  const requestCounts = useCallback(
    (categoryIds: readonly string[]) => {
      if (!categoryIds || categoryIds.length === 0) {
        return;
      }
      let enqueued = false;
      for (const rawId of categoryIds) {
        const id = typeof rawId === 'string' ? rawId.trim() : '';
        if (!id) {
          continue;
        }
        if (inFlightIds.current.has(id)) {
          continue;
        }
        if (queueRef.current.includes(id)) {
          continue;
        }
        if (id in countsRef.current) {
          continue;
        }
        queueRef.current.push(id);
        enqueued = true;
      }
      if (enqueued) {
        processQueue();
      }
    },
    [processQueue],
  );

  return useMemo(
    () => ({
      counts,
      loading: inFlightCount > 0,
      requestCounts,
    }),
    [counts, inFlightCount, requestCounts],
  );
};

export default useCategoryProductCounts;
