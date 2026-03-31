import { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetail from '@/components/product/product-detail';
import { JsonLd } from '@/components/seo/json-ld';
import { UiBreadcrumb } from '@/components/ui/molecules/ui-breadcrumb';
import { generateBreadcrumbForProduct } from '@/lib/breadcrumb';
import { getProductById } from '@/lib/ssr/products';
import { generateProductJsonLd, generateProductMetadata } from '@/lib/ssr/seo';
import { isProductSsrEnabled } from '@/lib/ssr/ssr-config';
import { ProductFetchOptions } from '@/platform/services/product';

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

export const dynamic = 'force-dynamic';

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

export async function renderProductPage(id: string, locale: string, options: ProductFetchOptions, ssr: boolean) {
  if (ssr) {
    // Fetch product data
    const product = await getProductById(id, options);

    // If product not found, show 404 page
    if (!product) {
      notFound();
    }
    const jsonLd = await generateProductJsonLd(product, locale);
    const breadcrumbs = generateBreadcrumbForProduct(product, locale);

    return (
      <>
        <JsonLd jsonLd={jsonLd} />
        <div>
          <UiBreadcrumb
            items={breadcrumbs}
            className="max-w-6xl mx-auto px-4 lg:px-9 sm:gap-x-6"
            disabledCategories={true}
          />
          <ProductDetail
            className="max-w-6xl mx-auto px-4 lg:px-9 sm:gap-x-6 lg:pr-38"
            product={product}
            options={options}
          />
        </div>
      </>
    );
  } else {
    return (
      <ProductDetail className="max-w-6xl mx-auto px-4 lg:px-9 sm:gap-x-6 lg:pr-38" product={id} options={options} />
    );
  }
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
  return renderProductPage(id, locale, options, ssr);
}
