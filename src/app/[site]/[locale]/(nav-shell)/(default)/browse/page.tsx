import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SearchResultsComponent } from '@/components/search/search-results';
import { Heading } from '@/components/ui/h';
import { createBrowseInitialSearch } from '@/lib/search/create-browse-initial-search';
import { getCachedNavigationCategoryTrees } from '@/lib/ssr/navigation-category-trees';
import { getSearchResultsLayout, searchProducts } from '@/lib/ssr/search';
import { getPageTitle } from '@/lib/ssr/seo';
import { isSearchSsrEnabled } from '@/lib/ssr/ssr-config';
import type { Category } from '@/platform/services/model/category';
import type { SearchParams } from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';

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

export async function renderBrowsePage({
  locale,
  q,
  initialSearch,
  initialResults,
  navigationRoots,
  initialLayout,
}: {
  locale: string;
  q?: string;
  initialSearch: SearchParams<Product>;
  initialResults?: Awaited<ReturnType<typeof searchProducts>>;
  navigationRoots?: Category[];
  initialLayout: 'list' | 'grid';
}) {
  const t = await getTranslations({ locale, namespace: 'search.searchResults' });

  return (
    <div className="content-container pb-32">
      {/** When a search phrase is present, the PLP heading should read Search Results rather than All Products. */}
      <SearchResultsComponent
        initialSearch={initialSearch}
        initialResults={initialResults}
        initialLayout={initialLayout}
        locale={locale}
        navigationRoots={navigationRoots}
        headingNode={
          <Heading variant="h2" className="mb-0">
            {q?.trim() ? t('searchResults') : t('allProducts')}
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

  const { initialSearch, q } = createBrowseInitialSearch(rawParams, false, site, locale);
  const initialLayout = getSearchResultsLayout();

  // Fetch navigation forest in parallel with the SSR product search so the PLP has the full
  // category tree available without a second round-trip on first paint.
  const [initialResults, navigationRoots] = await Promise.all([
    isSearchSsrEnabled() ? searchProducts(initialSearch) : Promise.resolve(undefined),
    getCachedNavigationCategoryTrees(site, locale),
  ]);

  return renderBrowsePage({
    locale,
    q,
    initialSearch,
    initialResults,
    navigationRoots,
    initialLayout,
  });
}
