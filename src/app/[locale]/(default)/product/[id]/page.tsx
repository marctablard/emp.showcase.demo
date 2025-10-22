import { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetail from '@/components/product/product-detail';
import { JsonLd } from '@/components/seo/json-ld';
import { UiBreadcrumb } from '@/components/ui/molecules/ui-breadcrumb';
import { generateBreadcrumbForProduct } from '@/lib/breadcrumb';
import { getAvailability, getProductById } from '@/lib/ssr/products';
import { generateProductJsonLd, generateProductMetadata } from '@/lib/ssr/seo';
import { getSite } from '@/lib/ssr/site';

interface ProductPageProps {
  id: string;
  locale: string;
}

// Generate metadata for the product page
export async function generateMetadata(
  { params }: { params: Promise<ProductPageProps> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  // Get the product ID and locale from params
  const { id, locale } = await params;

  // Fetch product data
  const product = await getProductById(id, { prices: true, variants: true, categories: true });

  // If product not found, return basic metadata
  if (!product) {
    return {};
  }
  // Use the extracted SEO utility function to generate metadata
  return generateProductMetadata(locale, product, product.price);
}

export default async function ProductPage({ params }: { params: Promise<ProductPageProps> }) {
  const { id, locale } = await params;

  const site = await getSite(locale);
  // Fetch translations, product data and price in parallel
  const [product, availability] = await Promise.all([
    getProductById(id, { prices: false, variants: true, categories: true }),
    getAvailability(site?.code || '', id),
  ]);

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
          className="max-w-6xl mx-auto px-4 lg:px-9 md:gap-x-6"
          disabledCategories={true}
        />
        <ProductDetail
          className="max-w-6xl mx-auto px-4 lg:px-9 md:gap-x-6 2xl:pr-38"
          product={product}
          availability={availability}
        />
      </div>
    </>
  );
}
