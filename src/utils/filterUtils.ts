import type { SearchFilterLeafValue, SearchFilterNestedValue, SearchFilters } from '@/platform/services/model/common';

/**
 * Utility functions for handling search filter parameters
 */

const FILTER_PARAM_PREFIXES = ['f[', 'filters['] as const;

function escapeRegexLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mergeFilterParam(
  filters: SearchFilters,
  param: string,
  filterValue: SearchFilterLeafValue,
  prefix: string,
): void {
  // Prefix is always `name[`; escape only `name` so the pattern is `^name\[(…)\]` not `^name\[\[(…)\]`.
  const prefixBase = prefix.slice(0, -1);
  const escapedBase = escapeRegexLiteral(prefixBase);
  const nestedMatch = param.match(new RegExp(`^${escapedBase}\\[(.*?)\\]\\[(.*?)\\]`));
  if (nestedMatch && nestedMatch[1] && nestedMatch[2]) {
    const mainKey = nestedMatch[1];
    const subKey = nestedMatch[2];
    if (!filters[mainKey]) {
      filters[mainKey] = {};
    }
    const nested = filters[mainKey] as SearchFilterNestedValue;
    nested[subKey] = filterValue;
    return;
  }

  const keyMatch = param.match(new RegExp(`^${escapedBase}\\[(.*?)\\](?:\\[\\])?`));
  if (!keyMatch || !keyMatch[1]) {
    return;
  }

  const filterKey = keyMatch[1];

  if (param.endsWith('[]')) {
    if (!filters[filterKey]) {
      filters[filterKey] = [];
    }

    if (!Array.isArray(filters[filterKey])) {
      filters[filterKey] = [];
    }

    if (Array.isArray(filterValue)) {
      (filters[filterKey] as string[]).push(...filterValue);
    } else {
      (filters[filterKey] as string[]).push(filterValue);
    }
  } else {
    filters[filterKey] = filterValue;
  }
}

/**
 * Extracts filter parameters from URL search params
 * Handles `f[...]` (legacy) and `filters[...]` (useSearch / browse URL), array filters, and range filters.
 */
export function extractFiltersFromSearchParams(searchParams: Record<string, string | string[]>): SearchFilters {
  const filters: SearchFilters = {};

  Object.keys(searchParams).forEach((param) => {
    const prefix = FILTER_PARAM_PREFIXES.find((p) => param.startsWith(p) && param.includes(']'));
    if (!prefix) {
      return;
    }
    mergeFilterParam(filters, param, searchParams[param], prefix);
  });

  return filters;
}

/**
 * Collapses duplicate URL keys into Next.js-style `Record<string, string | string[]>` (for parity with page `searchParams`).
 */
export function urlSearchParamsToNextRecord(sp: URLSearchParams): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  sp.forEach((value, key) => {
    const cur = out[key];
    if (cur === undefined) {
      out[key] = value;
    } else if (Array.isArray(cur)) {
      cur.push(value);
    } else {
      out[key] = [cur, value];
    }
  });
  return out;
}

/**
 * Parses `filters[…]` / `f[…]` keys from a `URLSearchParams` instance using the same rules as
 * {@link extractFiltersFromSearchParams}, so `/api/search` and browse page parsing stay aligned.
 */
export function extractFiltersFromUrlSearchParams(searchParams: URLSearchParams): SearchFilters {
  return extractFiltersFromSearchParams(urlSearchParamsToNextRecord(searchParams));
}

function normalizeFilterLeafForSignature(value: SearchFilterLeafValue): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.map(String).sort();
}

function normalizeFiltersForSignature(filters: SearchFilters | undefined): unknown {
  if (!filters || Object.keys(filters).length === 0) {
    return {};
  }
  const sortedKeys = Object.keys(filters).sort();
  const out: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    const v = filters[k];
    if (Array.isArray(v)) {
      out[k] = normalizeFilterLeafForSignature(v);
    } else if (v && typeof v === 'object') {
      const nested = v as SearchFilterNestedValue;
      const nk = Object.keys(nested).sort();
      out[k] = nk.reduce<Record<string, SearchFilterLeafValue>>((acc, key) => {
        acc[key] = nested[key];
        return acc;
      }, {});
    } else {
      out[k] = normalizeFilterLeafForSignature(v);
    }
  }
  return out;
}

/** URL query keys that imply browse/search state (includes legacy `f[…]` and `filters[…]`). */
const BROWSE_URL_SEARCH_PARAM_PREFIXES = ['q', 'page', 'size', 'sort', 'filters', 'f'] as const;

export function isBrowseUrlSearchParamKey(key: string): boolean {
  return BROWSE_URL_SEARCH_PARAM_PREFIXES.some((param) => key === param || key.startsWith(`${param}[`));
}

/** Stable signature so SSR initial search and client URL parsing can be compared. */
export function browseSearchStateSignature(state: {
  query?: string;
  page: number;
  size: number;
  sort?: string;
  filters?: SearchFilters;
}): string {
  return JSON.stringify({
    q: state.query ?? '',
    page: state.page,
    size: state.size,
    sort: state.sort ?? null,
    filters: normalizeFiltersForSignature(state.filters),
  });
}
