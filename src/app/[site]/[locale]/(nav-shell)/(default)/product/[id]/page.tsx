import type { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetail from '@/components/product/product-detail';
import { JsonLd } from '@/components/seo/json-ld';
import { UiBreadcrumb } from '@/components/ui/molecules/ui-breadcrumb';
import { routingConfig } from '@/i18n/routing';
import { generateVisibleBreadcrumbForPdp } from '@/lib/breadcrumb';
import { findDeepestCategoryPath } from '@/lib/category/category-tree-utils';
import { resolveCatalogDisplayName } from '@/lib/product/resolve-catalog-display-name';
import { getCategoryAncestorTrail } from '@/lib/ssr/category-ancestor-trail';
import { getCachedBatteryIncludedCategorySnapshot } from '@/lib/ssr/navigation-category-trees';
import { getProductById, getProducts } from '@/lib/ssr/products';
import { getNavigationCategoryTreesForMode, getProductsModeContext } from '@/lib/ssr/products-mode';
import { getActiveSearchEngine } from '@/lib/ssr/search-engine';
import { generateProductJsonLd, generateProductMetadata } from '@/lib/ssr/seo';
import { getAvailableSites, getSite } from '@/lib/ssr/site';
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
};

// Uncomment this, if you want to use Incremental Site Regeneration
// https://nextjs.org/docs/app/guides/incremental-static-regeneration
// NEXT_SSG_PRODUCT_COUNT must be set to a value greater than 0 to enable SSG
// export const revalidate = 360;
// COP-4822 AC4: never serve a build-time / cached public PDP to a segmented customer.
export const dynamic = 'force-dynamic';
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

/**
 * Builds the server-side product fetch options for the PDP (COP-4822).
 *
 * In `assigned` mode the customer's segment ids and the effective site they were resolved for are
 * attached so both engines drop out-of-scope products (fail closed → `notFound()`): Emporix via
 * `filterProductIdsInScope`, BatteryIncluded via the same membership check before the catalog
 * identity browse (COP-4822 AC4 — direct PDP URL, override off). The `all` mode and non-segmented
 * modes pass neither `segmentIds` nor `siteCode`. `generateMetadata` and the page must both call
 * this helper so the object passed to `getProductById` serialises identically and the React
 * `cache()` key matches.
 */
export async function createProductOptions(
  baseOptions: ProductFetchOptions,
  authenticated: boolean,
  siteCode: string,
): Promise<{ ssr: boolean; options: ProductFetchOptions }> {
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

  const ctx = await getProductsModeContext(siteCode);
  if (ctx.mode === 'assigned') {
    options.segmentIds = ctx.segmentIds;
    // Membership is checked for the same site the mode/segments were resolved for.
    options.siteCode = ctx.siteCode ?? siteCode;
  }

  return { ssr: !!productConfig, options };
}

/**
 * Server-only fields must never reach the client `ProductDetail` component; its refresh path
 * (`/api/products/[id]`) re-derives the products mode itself.
 */
function toClientProductOptions(options: ProductFetchOptions): ProductFetchOptions {
  const { segmentIds: _segmentIds, siteCode: _siteCode, ...clientOptions } = options;
  return clientOptions;
}

export async function generateProductPageMetadata(
  id: string,
  locale: string,
  options: ProductFetchOptions,
  ssr: boolean,
  site?: string,
): Promise<Metadata> {
  // Fetch product data
  const product = ssr ? await getProductById(id, options, locale, site) : null;

  // If product not found, return basic metadata
  if (!product) {
    return {};
  }

  const siteRecord = site ? await getSite(site) : null;

  // Use the extracted SEO utility function to generate metadata
  return generateProductMetadata(locale, product, product.price, siteRecord?.defaultLanguage);
}

export async function renderProductPage(
  id: string,
  locale: string,
  options: ProductFetchOptions,
  ssr: boolean,
  siteCode?: string,
) {
  const engine = getActiveSearchEngine();

  const product = await getProductById(id, options, locale, siteCode);

  if (!product) {
    notFound();
  }

  const navigationRoots = siteCode
    ? await getNavigationCategoryTreesForMode(siteCode, locale, await getProductsModeContext(siteCode))
    : null;
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

  const siteRecord = siteCode ? await getSite(siteCode) : null;
  const fallbackLocale = siteRecord?.defaultLanguage;
  const catalogDisplayName = product.name ? resolveCatalogDisplayName(product.name, locale, fallbackLocale) : undefined;

  const jsonLd = ssr ? await generateProductJsonLd(product, locale, fallbackLocale) : null;
  const breadcrumbs = generateVisibleBreadcrumbForPdp(
    product,
    locale,
    engine,
    biSnapshot,
    emporixAncestorTrail,
    navigationRoots,
    fallbackLocale,
  );

  return (
    <>
      {jsonLd ? <JsonLd jsonLd={jsonLd} /> : null}
      <div>
        <UiBreadcrumb items={breadcrumbs} className="content-container sm:gap-x-6" />
        <ProductDetail
          className="mt-4 content-container sm:gap-x-6"
          product={product}
          options={toClientProductOptions(options)}
          catalogDisplayName={catalogDisplayName}
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
  const { ssr, options } = await createProductOptions(PUBLIC_PRODUCT_OPTIONS, false, site);
  return generateProductPageMetadata(id, locale, options, ssr, site);
}

export default async function ProductPage({ params }: { params: Promise<ProductPageProps> }) {
  const { id, locale, site } = await params;
  const { ssr, options } = await createProductOptions(PUBLIC_PRODUCT_OPTIONS, false, site);
  return renderProductPage(id, locale, options, ssr, site);
}
