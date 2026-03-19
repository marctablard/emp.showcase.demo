import { Metadata } from 'next';
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
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const { locale } = await params;
  const rawParams = await searchParams;

  const { initialSearch, q } = createBrowseInitialSearch(rawParams, true);

  const initialResults = await searchProducts(initialSearch);

  return renderBrowsePage({ locale, q, initialSearch, initialResults });
}
