import { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetailConfigurator from '@/components/product/product-detail-configurator';
import { JsonLd } from '@/components/seo/json-ld';
import { UiBreadcrumb } from '@/components/ui/molecules/ui-breadcrumb';
import { generateBreadcrumbForProduct } from '@/lib/breadcrumb';
import { getProductById } from '@/lib/ssr/products';
import { generateProductJsonLd, generateProductMetadata } from '@/lib/ssr/seo';

interface ConfiguratorPageProps {
  locale: string;
}

const PRODUCT_ID = '6973693cbd832e22d2cd558f';
const PRODUCT_FETCH_OPTIONS = {
  prices: true,
  variants: true,
  categories: true,
};

// Generate metadata for the configurator page
export async function generateMetadata(
  { params }: { params: Promise<ConfiguratorPageProps> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { locale } = await params;

  // Fetch product data
  const product = await getProductById(PRODUCT_ID, PRODUCT_FETCH_OPTIONS);

  // If product not found, return basic metadata
  if (!product) {
    return {
      title: 'Configurator',
    };
  }
  // Use the extracted SEO utility function to generate metadata
  return generateProductMetadata(locale, product, product.price);
}

export default async function ConfiguratorPage({ params }: { params: Promise<ConfiguratorPageProps> }) {
  const { locale } = await params;

  // Fetch product data
  const product = await getProductById(PRODUCT_ID, PRODUCT_FETCH_OPTIONS);

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
        <ProductDetailConfigurator
          className="max-w-6xl mx-auto px-4 lg:px-9 sm:gap-x-6 lg:pr-38"
          product={product}
          price={product.price}
        />
      </div>
    </>
  );
}
