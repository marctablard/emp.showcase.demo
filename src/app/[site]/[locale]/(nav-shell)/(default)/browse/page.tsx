import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SearchResultsComponent } from '@/components/search/search-results';
import { Heading } from '@/components/ui/h';
import { redirect } from '@/i18n/edge/navigation';
import { browseHeadingKey, browseSearchResultsRemountKey } from '@/lib/search/browse-heading-key';
import { createBrowseInitialSearch } from '@/lib/search/create-browse-initial-search';
import { sanitizeBrowseCategoryIdParams } from '@/lib/search/sanitize-browse-category-id-params';
import { getCachedNavigationCategoryTrees } from '@/lib/ssr/navigation-category-trees';
import { getProductsModeContext, getSegmentCategoryScope, getSegmentNavigationRoots } from '@/lib/ssr/products-mode';
import { getSearchResultsLayout, searchProducts } from '@/lib/ssr/search';
import { getPageTitle } from '@/lib/ssr/seo';
import { isSearchSsrEnabled } from '@/lib/ssr/ssr-config';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Category } from '@/platform/services/model/category';
import type { SearchParams } from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';
import type { ProductsMode } from '@/platform/services/products-mode/ProductsModeService';
import ssr from '@/platform/ssr';

export async function generateBrowsePageMetadata(locale: string): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'search.searchResults' });

  return {
    title: await getPageTitle('Product Browse', locale),
    description: `Browse our product catalog. ${t('tryAdjusting')}`,
    robots: {
      index: true,
      follow: true,
    },
  };
}

/**
 * Resolves the products mode of the request and builds the mode-aware PLP inputs (COP-4822).
 *
 * - `assigned`: the SSR search is scoped by `segmentIds`, `filters[categoryIds]` is sanitised against
 *   the segment category scope (AC5) and the category tree is the segment forest (BI-enriched via
 *   `getSegmentNavigationRoots` on BatteryIncluded). When the URL carried
 *   out-of-scope category ids the request is redirected to the sanitised URL so the URL, the client
 *   filter state and the server search agree (no stale active-filter chips).
 * - every other mode (`anonymous`, `unsegmented`, `all`): today's behaviour — unscoped search and
 *   the site-wide navigation forest.
 *
 * Shared by the public and the authenticated browse page so both behave identically.
 */
export async function resolveBrowsePageData({
  site,
  locale,
  rawParams,
  ssrSearch,
}: {
  site: string;
  locale: string;
  rawParams: Record<string, string | string[]>;
  ssrSearch: boolean;
}) {
  const ctx = await getProductsModeContext(site);

  if (ctx.mode === 'assigned') {
    const scope = await getSegmentCategoryScope(site, ctx.segmentIds);

    const sanitizedUrl = sanitizeBrowseCategoryIdParams(rawParams, scope.allowedCategoryIds);
    if (sanitizedUrl) {
      ssr
        .get<LoggerService>('LoggerService')
        .debug(
          { droppedCategoryIds: sanitizedUrl.droppedCategoryIds, siteCode: site },
          'Redirecting /browse to the sanitised URL: out-of-scope categoryIds dropped (assigned mode)',
        );
      // `redirect()` throws NEXT_REDIRECT — keep it outside try/catch and Promise.all callbacks.
      // No `query` when nothing survived so the Location is `/browse`, not `/browse?`.
      const hasRemainingParams = Object.keys(sanitizedUrl.params).length > 0;
      redirect({
        href: hasRemainingParams ? { pathname: '/browse', query: sanitizedUrl.params } : { pathname: '/browse' },
        locale,
        site,
      });
    }

    const { initialSearch, q } = createBrowseInitialSearch(rawParams, site, locale, {
      segmentIds: ctx.segmentIds,
      allowedCategoryIds: scope.allowedCategoryIds,
    });
    // The segment forest enriched with BI category metadata (when the engine is BatteryIncluded) so the
    // PLP tree resolves hrefs, the selected category and counts through the segment-scoped breadcrumb
    // facet like the public PLP. The AC5 sanitising above deliberately keeps using `scope.allowedCategoryIds`.
    const [initialResults, navigationRoots] = await Promise.all([
      ssrSearch ? searchProducts(initialSearch) : Promise.resolve(undefined),
      getSegmentNavigationRoots(site, locale, ctx.segmentIds),
    ]);

    return { mode: ctx.mode, customerId: ctx.customerId, q, initialSearch, initialResults, navigationRoots };
  }

  const { initialSearch, q } = createBrowseInitialSearch(rawParams, site, locale);

  // Fetch navigation forest in parallel with the SSR product search so the PLP has the full
  // category tree available without a second round-trip on first paint.
  const [initialResults, navigationRoots] = await Promise.all([
    ssrSearch ? searchProducts(initialSearch) : Promise.resolve(undefined),
    getCachedNavigationCategoryTrees(site, locale),
  ]);

  return { mode: ctx.mode, customerId: ctx.customerId, q, initialSearch, initialResults, navigationRoots };
}

export async function renderBrowsePage({
  locale,
  mode,
  customerId,
  q,
  initialSearch,
  initialResults,
  navigationRoots,
  initialLayout,
}: {
  locale: string;
  mode: ProductsMode;
  customerId?: string;
  q?: string;
  initialSearch: SearchParams<Product>;
  initialResults?: Awaited<ReturnType<typeof searchProducts>>;
  navigationRoots?: Category[];
  initialLayout: 'list' | 'grid';
}) {
  const t = await getTranslations({ locale, namespace: 'search.searchResults' });

  return (
    <div className="content-container pb-32">
      {/** Mode + customer so A→B in assigned remounts with the new SSR results (COP-4822). */}
      <SearchResultsComponent
        key={browseSearchResultsRemountKey(mode, customerId)}
        initialSearch={initialSearch}
        initialResults={initialResults}
        initialLayout={initialLayout}
        locale={locale}
        navigationRoots={navigationRoots}
        headingNode={
          <Heading variant="h2" className="mb-0">
            {t(browseHeadingKey(mode, q))}
          </Heading>
        }
      />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return generateBrowsePageMetadata(locale);
}

export default async function BrowsePage({
  params,
  searchParams,
}: {
  params: Promise<{ site: string; locale: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const { locale, site } = await params;
  const rawParams = await searchParams;

  const initialLayout = getSearchResultsLayout();
  const { mode, customerId, q, initialSearch, initialResults, navigationRoots } = await resolveBrowsePageData({
    site,
    locale,
    rawParams,
    ssrSearch: isSearchSsrEnabled(),
  });

  return renderBrowsePage({
    locale,
    mode,
    customerId,
    q,
    initialSearch,
    initialResults,
    navigationRoots,
    initialLayout,
  });
}
