import type { SearchResult } from '@/platform/services/model/common';

const inFlightSearchRequests = new Map<string, Promise<SearchResult<unknown>>>();

/**
 * GET `/api/search` and coalesce overlapping requests for the same URL.
 * React Strict Mode remounts would otherwise issue the same browse fetch twice.
 */
export function fetchSearchResult<T>(url: string): Promise<SearchResult<T>> {
  const existing = inFlightSearchRequests.get(url);
  if (existing) {
    return existing as Promise<SearchResult<T>>;
  }

  const request = (async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }
    return (await response.json()) as SearchResult<T>;
  })().finally(() => {
    inFlightSearchRequests.delete(url);
  });

  inFlightSearchRequests.set(url, request as Promise<SearchResult<unknown>>);
  return request;
}

/** Test-only: drop coalesced in-flight search promises. */
export function resetInFlightSearchRequests(): void {
  inFlightSearchRequests.clear();
}
