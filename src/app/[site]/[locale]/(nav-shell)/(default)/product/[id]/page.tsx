import type { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetail from '@/components/product/product-detail';
import { JsonLd } from '@/components/seo/json-ld';
import { UiBreadcrumb } from '@/components/ui/molecules/ui-breadcrumb';
import { routingConfig } from '@/i18n/routing';
import { generateVisibleBreadcrumbForPdp } from '@/lib/breadcrumb';
import { findDeepestCategoryPath } from '@/lib/category/category-tree-utils';
import { getCategoryAncestorTrail } from '@/lib/ssr/category-ancestor-trail';
import {
  getCachedBatteryIncludedCategorySnapshot,
  getCachedNavigationCategoryTrees,
} from '@/lib/ssr/navigation-category-trees';
import { getProductById, getProducts } from '@/lib/ssr/products';
import { getActiveSearchEngine } from '@/lib/ssr/search-engine';
import { generateProductJsonLd, generateProductMetadata } from '@/lib/ssr/seo';
import { getAvailableSites } from '@/lib/ssr/site';
import { isProductSsrEnabled } from '@/lib/ssr/ssr-config';
import type { Product } from '@/platform/services/model/product';
import type { ProductFetchOptions } from '@/platform/services/product';

interface ProductPageProps {
  id: string;
  locale: string;
  site: string;
}

export const PUBLIC_PRODUCT_OPTIONS = {
  prices: false,
  variants: false,
  categories: false,
  availability: false,
  customerSegments: false,
};

// Uncomment this, if you want to use Incremental Site Regeneration
// https://nextjs.org/docs/app/guides/incremental-static-regeneration
// NEXT_SSG_PRODUCT_COUNT must be set to a value greater than 0 to enable SSG
// export const revalidate = 360;
export const revalidate = 0;

export async function generateStaticParams() {
  const ssgProductCount = parseInt(process.env.NEXT_SSG_PRODUCT_COUNT || '0', 0);
  if (ssgProductCount <= 0) {
    return [];
  }
  const sites = await getAvailableSites();
  const products = await getProducts(0, ssgProductCount, PUBLIC_PRODUCT_OPTIONS);
  const params: { site: string; locale: string; id: string }[] = [];
  for (const site of sites) {
    // TODO filter on site level depending on implementation
    products.items.forEach((product: Product) => {
      routingConfig.locales.forEach((locale) => {
        params.push({
          site: site.code,
          locale: locale,
          id: product.id,
        });
      });
    });
  }
  return params;
}

export function createProductOptions(
  baseOptions: ProductFetchOptions,
  authenticated: boolean,
  siteCode: string,
): { ssr: boolean; options: ProductFetchOptions } {
  const productConfig = isProductSsrEnabled();

  // Build fetch options based on SSR configuration
  const options: ProductFetchOptions =
    typeof productConfig === 'boolean'
      ? {
          ...baseOptions,
        }
      : {
          ...baseOptions,
          ...productConfig, // merge in the ssr product config
        };

  if (!authenticated && options.prices) {
    options.prices = {
      siteCode: siteCode,
    };
  }
  return { ssr: !!productConfig, options };
}

export async function generateProductPageMetadata(
  id: string,
  locale: string,
  options: ProductFetchOptions,
  ssr: boolean,
): Promise<Metadata> {
  // Fetch product data
  const product = ssr ? await getProductById(id, options) : null;

  // If product not found, return basic metadata
  if (!product) {
    return {};
  }

  // Use the extracted SEO utility function to generate metadata
  return generateProductMetadata(locale, product, product.price);
}

export async function renderProductPage(
  id: string,
  locale: string,
  options: ProductFetchOptions,
  ssr: boolean,
  siteCode?: string,
) {
  const engine = getActiveSearchEngine();

  const product = await getProductById(id, options);

  if (!product) {
    notFound();
  }

  const navigationRoots = siteCode ? await getCachedNavigationCategoryTrees(siteCode, locale) : null;
  const candidateCategoryIds = Array.from(
    new Set(
      [
        product.primaryCategory?.id,
        ...(product.categoryIds ?? []),
        ...(product.categories?.map((category) => category.id) ?? []),
      ].filter((categoryId): categoryId is string => Boolean(categoryId)),
    ),
  );
  const hasNavigationPath = findDeepestCategoryPath(navigationRoots ?? undefined, candidateCategoryIds).length > 0;

  const biSnapshot =
    !hasNavigationPath && engine === 'batteryincluded' && siteCode
      ? await getCachedBatteryIncludedCategorySnapshot(siteCode, locale)
      : null;

  const leafCategoryId = product.primaryCategory?.id ?? product.categoryIds?.[0] ?? product.categories?.[0]?.id ?? null;
  const leafCategory =
    (product.primaryCategory?.id === leafCategoryId ? product.primaryCategory : null) ??
    product.categories?.find((category) => category.id === leafCategoryId) ??
    null;
  const shouldResolveEmporixTrail =
    !hasNavigationPath &&
    Boolean(leafCategoryId) &&
    (engine === 'emporix' || (engine === 'batteryincluded' && !biSnapshot));
  const emporixAncestorTrail = shouldResolveEmporixTrail
    ? await getCategoryAncestorTrail(leafCategoryId, leafCategory)
    : null;

  const jsonLd = ssr ? await generateProductJsonLd(product, locale) : null;
  const breadcrumbs = generateVisibleBreadcrumbForPdp(
    product,
    locale,
    engine,
    biSnapshot,
    emporixAncestorTrail,
    navigationRoots,
  );

  return (
    <>
      {jsonLd ? <JsonLd jsonLd={jsonLd} /> : null}
      <div>
        <UiBreadcrumb items={breadcrumbs} className="max-w-6xl mx-auto px-4 lg:px-9 sm:gap-x-6" />
        <ProductDetail
          className="mt-4 max-w-6xl mx-auto px-4 lg:px-9 sm:gap-x-6 lg:pr-38"
          product={product}
          options={options}
        />
      </div>
    </>
  );
}

// Generate metadata for the product page
export async function generateMetadata(
  { params }: { params: Promise<ProductPageProps> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id, locale, site } = await params;
  const { ssr, options } = createProductOptions(PUBLIC_PRODUCT_OPTIONS, false, site);
  return generateProductPageMetadata(id, locale, options, ssr);
}

export default async function ProductPage({ params }: { params: Promise<ProductPageProps> }) {
  const { id, locale, site } = await params;
  const { ssr, options } = createProductOptions(PUBLIC_PRODUCT_OPTIONS, false, site);
  return renderProductPage(id, locale, options, ssr, site);
}
