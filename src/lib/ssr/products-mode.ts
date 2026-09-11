import { cache } from 'react';
import { cookies } from 'next/headers';
import { enrichCategoriesWithBatteryIncludedMetadata } from '@/lib/category/enrich-categories-with-battery-included-metadata';
import { isAuthenticatedSessionCustomerId } from '@/lib/common/customer-identity';
import { PRODUCTS_MODE_COOKIE_NAME } from '@/lib/common/products-mode-cookie';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Category } from '@/platform/services/model/category';
import type { ProductsModeContext, ProductsModeService } from '@/platform/services/products-mode/ProductsModeService';
import type SegmentFilterService from '@/platform/services/search/impl/SegmentFilterService';
import type { SegmentCategoryScope } from '@/platform/services/search/impl/SegmentFilterService';
import ssr from '@/platform/ssr';
import {
  getCachedBatteryIncludedCategorySnapshot,
  getCachedNavigationCategoryTrees,
} from './navigation-category-trees';
import { getActiveSearchEngine } from './search-engine';
import { getSessionForSite } from './session';

/**
 * Per-request products-mode helpers for Server Components (COP-4822).
 *
 * `ProductsModeService` is the single authority for the mode; these helpers only add
 * React `cache()` per-request dedupe so the nav-shell layout, the PLP and the PDP resolve
 * the mode once per render pass. Personalised data — no Next.js data cache, no module-level
 * state; nothing here is shared across requests.
 */

/**
 * `true` when the customer's segment scope applies (`assigned`). `all` is the opt-out: the
 * customer browses unscoped exactly like an anonymous / unsegmented customer.
 */
export function isSegmentedMode(ctx: Pick<ProductsModeContext, 'mode'>): boolean {
  return ctx.mode === 'assigned';
}

const _getProductsModeContext = cache(async (siteCode: string): Promise<ProductsModeContext> => {
  const optInCookieValue = (await cookies()).get(PRODUCTS_MODE_COOKIE_NAME)?.value;
  try {
    return await ssr.get<ProductsModeService>('ProductsModeService').resolve({ optInCookieValue, siteCode });
  } catch (error) {
    const logger = ssr.get<LoggerService>('LoggerService');
    // `resolve` already fails closed for segment-lookup errors; reaching this branch means the
    // resolver itself broke. Only a request without an authenticated customer (no id, or the
    // Emporix anonymous-session literal `ANONYMOUS`) may degrade to `anonymous` — a logged-in
    // customer must never see the full catalog because of an outage.
    const session = await getSessionForSite(siteCode);
    if (session !== undefined && !isAuthenticatedSessionCustomerId(session?.customerId)) {
      logger.error(
        { err: error instanceof Error ? error : String(error), siteCode },
        'SSR getProductsModeContext failed; no customer in session, falling back to anonymous mode',
      );
      return {
        mode: 'anonymous',
        segmentIds: [],
        canToggleAllProducts: false,
        engine: getActiveSearchEngine(),
        siteCode,
      };
    }
    logger.error(
      { err: error instanceof Error ? error : String(error), siteCode, customerId: session?.customerId },
      'SSR getProductsModeContext failed for a customer session; rethrowing (fail closed)',
    );
    throw error;
  }
});

/** Fresh per call so no request can mutate a shared module-level scope. */
function emptySegmentCategoryScope(): SegmentCategoryScope {
  return { roots: [], treeCategoryIds: [], assignedCategoryIds: [], allowedCategoryIds: [] };
}

/**
 * Stable per-request cache key for the active segment ids: React `cache()` compares object
 * arguments by reference, so the array is serialised (sorted, de-duplicated) to dedupe across callers.
 */
function toSegmentIdsKey(segmentIds: readonly string[]): string {
  return JSON.stringify([...new Set(segmentIds)].sort((a, b) => a.localeCompare(b)));
}

const _getSegmentCategoryScope = cache(
  async (siteCode: string, segmentIdsKey: string): Promise<SegmentCategoryScope> => {
    try {
      const segmentIds = JSON.parse(segmentIdsKey) as string[];
      return await ssr.get<SegmentFilterService>('SegmentFilterService').getCategoryScope(siteCode, segmentIds);
    } catch (error) {
      // Fail closed: an upstream outage must neither expose out-of-segment categories nor take every
      // nav-shell page down (the layout awaits this for the header/footer). An empty scope renders no
      // segment categories and sanitises every PLP category filter away while `segmentIds` stay applied.
      ssr
        .get<LoggerService>('LoggerService')
        .error(
          { err: error instanceof Error ? error : String(error), siteCode },
          'SSR getSegmentCategoryScope failed; returning an empty segment scope (fail closed)',
        );
      return emptySegmentCategoryScope();
    }
  },
);

/**
 * Resolves the products mode of the current request from `ProductsModeService`, forwarding the
 * raw opt-in cookie value and the URL-derived `siteCode`. Cached per request.
 */
export function getProductsModeContext(siteCode: string): Promise<ProductsModeContext> {
  return _getProductsModeContext(siteCode);
}

/**
 * Segment category scope (forest + id sets) of the current customer for `siteCode`, restricted to
 * the active `segmentIds` of the resolved `ProductsModeContext` (unrelated segments never widen it).
 * Cached per request; callers must only use it when `isSegmentedMode(ctx)` is true.
 *
 * Never rejects: when the scope lookup fails the error is logged and an **empty** scope is
 * returned (fail closed — no segment categories, every category filter sanitised away).
 */
export function getSegmentCategoryScope(
  siteCode: string,
  segmentIds: readonly string[],
): Promise<SegmentCategoryScope> {
  return _getSegmentCategoryScope(siteCode, toSegmentIdsKey(segmentIds));
}

const _getSegmentNavigationRoots = cache(
  async (siteCode: string, locale: string, segmentIdsKey: string): Promise<Category[]> => {
    const { roots } = await _getSegmentCategoryScope(siteCode, segmentIdsKey);
    if (roots.length === 0 || getActiveSearchEngine() !== 'batteryincluded') {
      return roots;
    }
    try {
      const snapshot = await getCachedBatteryIncludedCategorySnapshot(siteCode, locale);
      return enrichCategoriesWithBatteryIncludedMetadata(roots, snapshot);
    } catch (error) {
      // Degrade gracefully: the un-enriched forest still renders and links via `filters[categoryIds]`;
      // only the segment-scoped PLP tree counts fall back to the Emporix per-category counts.
      ssr
        .get<LoggerService>('LoggerService')
        .warn(
          { err: error instanceof Error ? error : String(error), siteCode },
          'SSR getSegmentNavigationRoots: BatteryIncluded category snapshot lookup failed; returning the segment forest without BI metadata',
        );
      return roots;
    }
  },
);

/**
 * Segment navigation forest of the current customer, ready for the nav shell and the PLP.
 * Cached per request; callers must only use it when `isSegmentedMode(ctx)` is true.
 *
 * On BatteryIncluded the `SegmentCategoryScope.roots` (Emporix category-trees, no BI metadata) are
 * enriched with the BI category metadata of the public category snapshot so hrefs, the selected
 * category and the PLP tree counts resolve through the segment-scoped
 * `_product_i18n.categoryBreadcrumbs.displayPath` facet exactly like the public PLP. The snapshot
 * counts are not copied. On other engines the roots are returned as-is.
 *
 * Never rejects: a failed snapshot lookup is logged at `warn` and the un-enriched roots are
 * returned; a failed scope lookup yields `[]` (see `getSegmentCategoryScope`).
 */
export function getSegmentNavigationRoots(
  siteCode: string,
  locale: string,
  segmentIds: readonly string[],
): Promise<Category[]> {
  return _getSegmentNavigationRoots(siteCode, locale, toSegmentIdsKey(segmentIds));
}

/**
 * Navigation forest for the resolved mode: the (BI-enriched) segment forest in `assigned` mode
 * (see `getSegmentNavigationRoots`), otherwise — `anonymous`, `unsegmented` and the `all` opt-out —
 * the site-wide shared trees from `getCachedNavigationCategoryTrees`.
 *
 * In `assigned` mode a failed scope lookup yields `[]` (see `getSegmentCategoryScope`) instead of
 * rejecting, so the nav shell still renders without any segment categories.
 */
export async function getNavigationCategoryTreesForMode(
  siteCode: string,
  locale: string,
  ctx: Pick<ProductsModeContext, 'mode' | 'segmentIds'>,
): Promise<Category[]> {
  if (isSegmentedMode(ctx)) {
    return getSegmentNavigationRoots(siteCode, locale, ctx.segmentIds);
  }
  return getCachedNavigationCategoryTrees(siteCode, locale);
}
