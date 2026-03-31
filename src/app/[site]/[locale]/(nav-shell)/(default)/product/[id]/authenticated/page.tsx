import { Metadata, ResolvingMetadata } from 'next';
import { createProductOptions, generateProductPageMetadata, renderProductPage } from '../page';

interface AuthenticatedProductPageProps {
  id: string;
  locale: string;
  site: string;
}

const AUTHENTICATED_PRODUCT_OPTIONS = {
  prices: true,
  variants: true,
  categories: true,
  availability: true,
  customerSegments: true,
};

// Authenticated product pages are request-bound and must stay dynamic.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(
  { params }: { params: Promise<AuthenticatedProductPageProps> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id, locale, site } = await params;
  const { ssr, options } = createProductOptions(AUTHENTICATED_PRODUCT_OPTIONS, true, site);
  return generateProductPageMetadata(id, locale, options, ssr);
}

export default async function AuthenticatedProductPage({ params }: { params: Promise<AuthenticatedProductPageProps> }) {
  const { id, locale, site } = await params;
  const { ssr, options } = createProductOptions(AUTHENTICATED_PRODUCT_OPTIONS, true, site);
  return renderProductPage(id, locale, options, ssr);
}
