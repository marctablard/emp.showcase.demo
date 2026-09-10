/** Matches `filters[categoryIds]`, `filters[categoryIds][]` and the legacy `f[…]` variants. */
const CATEGORY_IDS_PARAM_KEY = /^(?:filters|f)\[categoryIds\](?:\[\])?$/;

export interface SanitizedBrowseCategoryIdParams {
  /** Raw URL params with out-of-scope category ids removed; keys left empty are dropped. */
  params: Record<string, string | string[]>;
  /** Category ids requested by the URL that are outside the allowed scope (deduplicated). */
  droppedCategoryIds: string[];
}

function toValues(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

/**
 * Sanitises the raw `/browse` URL params against the segment category scope (COP-4822 AC5).
 *
 * Mirrors `sanitizeCategoryFilters` on the URL level so the page can redirect to a URL that matches
 * the server-side sanitised search: every non-category param is preserved in its original order and
 * shape, allowed category ids are kept, out-of-scope ids are removed and a category key is dropped
 * entirely when nothing remains.
 *
 * Returns `undefined` when no category id was dropped so callers never redirect (no loops).
 * Pure and I/O-free.
 */
export function sanitizeBrowseCategoryIdParams(
  rawParams: Record<string, string | string[]>,
  allowedCategoryIds: ReadonlySet<string> | string[],
): SanitizedBrowseCategoryIdParams | undefined {
  const allowed = Array.isArray(allowedCategoryIds) ? new Set(allowedCategoryIds) : allowedCategoryIds;
  const params: Record<string, string | string[]> = {};
  const dropped = new Set<string>();

  for (const [key, value] of Object.entries(rawParams)) {
    if (!CATEGORY_IDS_PARAM_KEY.test(key)) {
      params[key] = value;
      continue;
    }

    const kept: string[] = [];
    for (const id of toValues(value)) {
      if (allowed.has(id)) {
        kept.push(id);
      } else {
        dropped.add(id);
      }
    }

    if (kept.length === 0) {
      continue;
    }
    params[key] = Array.isArray(value) ? kept : kept[0];
  }

  if (dropped.size === 0) {
    return undefined;
  }

  return { params, droppedCategoryIds: [...dropped] };
}
