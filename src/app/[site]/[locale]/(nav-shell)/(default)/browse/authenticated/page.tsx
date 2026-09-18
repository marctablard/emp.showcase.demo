import type { Metadata } from 'next';
import { getSearchResultsLayout } from '@/lib/ssr/search';
import { generateBrowsePageMetadata, renderBrowsePage, resolveBrowsePageData } from '../page';

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

  const initialLayout = getSearchResultsLayout();
  const { mode, customerId, q, initialSearch, initialResults, navigationRoots } = await resolveBrowsePageData({
    site,
    locale,
    rawParams,
    ssrSearch: true,
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
