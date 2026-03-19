import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SearchResultsComponent } from '@/components/search/search-results';
import { Heading } from '@/components/ui/h';
import { searchProducts } from '@/lib/ssr/search';
import { getPageTitle } from '@/lib/ssr/seo';
import { isSearchSsrEnabled } from '@/lib/ssr/ssr-config';
import { SearchParams } from '@/platform/services/model/common';
import { Product } from '@/platform/services/model/product';
import { extractFiltersFromSearchParams } from '@/utils/filterUtils';

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

export function createBrowseInitialSearch(
  rawParams: Record<string, string | string[]>,
  customerSegments: boolean,
): { initialSearch: SearchParams<Product>; q?: string } {
  const q = rawParams.q as string | undefined;
  const page = rawParams.page as string | undefined;
  const size = rawParams.size as string | undefined;

  const filters = extractFiltersFromSearchParams(rawParams);

  const initialSearch: SearchParams<Product> = {
    page: page ? parseInt(page, 10) : 0,
    size: size ? parseInt(size, 10) : 12,
    query: q,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    customerSegments,
  };

  return { initialSearch, q };
}

export async function renderBrowsePage({
  locale,
  q,
  initialSearch,
  initialResults,
}: {
  locale: string;
  q?: string;
  initialSearch: SearchParams<Product>;
  initialResults: Awaited<ReturnType<typeof searchProducts>>;
}) {
  const t = await getTranslations({ locale, namespace: 'search.searchResults' });

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-9 pb-32">
      <Heading variant="h2" className="mb-6">
        {q ? t('resultsFor', { query: q }) : t('allProducts')}
      </Heading>

      <SearchResultsComponent
        initialSearch={initialSearch}
        initialResults={initialResults}
        locale={locale}
      ></SearchResultsComponent>
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
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const { locale } = await params;
  const rawParams = await searchParams;

  const { initialSearch, q } = createBrowseInitialSearch(rawParams, false);
  // Fetch initial products server-side if SSR is enabled
  const initialResults = isSearchSsrEnabled() ? await searchProducts(initialSearch) : undefined;

  return renderBrowsePage({ locale, q, initialSearch, initialResults });
}
