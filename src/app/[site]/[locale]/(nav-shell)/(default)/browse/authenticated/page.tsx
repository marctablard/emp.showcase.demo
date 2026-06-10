import type { Metadata } from 'next';
import { getCachedNavigationCategoryTrees } from '@/lib/ssr/navigation-category-trees';
import { searchProducts } from '@/lib/ssr/search';
import { createBrowseInitialSearch, generateBrowsePageMetadata, renderBrowsePage } from '../page';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return generateBrowsePageMetadata(locale);
}

export default async function AuthenticatedBrowsePage({
  params,
  searchParams,
}: {
  params: Promise<{ site: string; locale: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const { locale, site } = await params;
  const rawParams = await searchParams;

  const { initialSearch, q } = createBrowseInitialSearch(rawParams, true, site, locale);

  const [initialResults, navigationRoots] = await Promise.all([
    searchProducts(initialSearch),
    getCachedNavigationCategoryTrees(site, locale),
  ]);

  return renderBrowsePage({ locale, q, initialSearch, initialResults, navigationRoots });
}
