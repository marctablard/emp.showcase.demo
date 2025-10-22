import { cache } from 'react';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProductPrice } from '@/platform/services/model/price';
import { Product } from '@/platform/services/model/product';
import { generateBreadcrumbForProduct } from '../breadcrumb';
import { buildCanonicalUrl, l10n } from '../utils';

// create cached callbacks, to make sure we don't do the same work multiple times
const getProductName = cache(async (product: Product, locale: string) => {
  if (product.name) {
    return l10n(product.name, locale);
  }
  const t = await getTranslations({ locale, namespace: 'seo' });
  return t('defaultProductName');
});

const getProductDescription = cache(async (product: Product, locale: string) => {
  if (product.description) {
    return l10n(product.description, locale);
  }
  const t = await getTranslations({ locale, namespace: 'seo' });
  const productName = await getProductName(product, locale);
  return t('defaultProductDescription', { productName });
});

/**
 * Generate basic metadata for product pages
 */
export async function generateBasicProductMetadata(
  product: Product,
  locale: string,
): Promise<{
  title: string;
  description: string;
  alternates: { canonical: string };
}> {
  const productName = await getProductName(product, locale);
  const productDescription = await getProductDescription(product, locale);
  const canonicalUrl = buildCanonicalUrl(locale, `/product/${product.id}`);

  return {
    title: await getPageTitle(productName, locale),
    description: productDescription.substring(0, 160), // Limit description to 160 characters
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

/**
 * Generate Open Graph metadata for product pages
 * @param product The product to generate metadata for
 * @param locale The locale code (e.g., 'en', 'fr')
 * @returns Open Graph metadata for the product page
 */
export async function generateProductOpenGraphMetadata(
  product: Product,
  locale: string,
): Promise<{
  title: string;
  description: string;
  images: { url: string; width: number; height: number; alt: string }[];
  type: 'website';
}> {
  const productName = await getProductName(product, locale);
  const productDescription = await getProductDescription(product, locale);

  return {
    title: productName,
    description: productDescription.substring(0, 160),
    images:
      product.images && product.images.length > 0
        ? [
            {
              url: product.images[0].url, // Use the url property of the Media object
              width: 800,
              height: 600,
              alt: productName,
            },
          ]
        : [],
    type: 'website', // Next.js only supports specific OpenGraph types
  };
}

/**
 * Generate Twitter card metadata for product pages
 * @param product The product to generate metadata for
 * @param locale The locale code (e.g., 'en', 'fr')
 * @returns Twitter card metadata for the product page
 */
export async function generateProductTwitterMetadata(
  product: Product,
  locale: string,
): Promise<{
  card: 'summary_large_image';
  title: string;
  description: string;
  images: string[];
}> {
  const productName = await getProductName(product, locale);
  const productDescription = await getProductDescription(product, locale);

  return {
    card: 'summary_large_image',
    title: productName,
    description: productDescription.substring(0, 160),
    images: product.images && product.images.length > 0 ? [product.images[0].url] : [],
  };
}

/**
 * Generate JSON-LD structured data for product pages
 */
export async function generateProductJsonLd(product: Product, locale: string): Promise<string> {
  const [t, productName, productDescription] = await Promise.all([
    getTranslations({ locale, namespace: 'seo' }),
    getProductName(product, locale),
    getProductDescription(product, locale),
  ]);
  let productPrice;
  let productCurrency;
  if (product?.price?.tiers && product.price.tiers.length > 0) {
    productPrice = product.price.tiers[0].price;
    productCurrency = product.price.currency;
  } else {
    productPrice = product.price?.amount || null;
    productCurrency = product.price?.currency || null;
  }
  const breadcrumb = generateBreadcrumbForProduct(product, locale);
  breadcrumb.pop(); // remove product part
  const category =
    breadcrumb.length > 0 ? breadcrumb.map((item) => buildCanonicalUrl(locale, item.href)).join(' > ') : undefined;
  const brand = product.brand
    ? {
        '@type': 'Brand',
        name: product.brand.name,
        logo: product.brand.logo,
      }
    : undefined;
  const canonicalUrl = buildCanonicalUrl(locale, `/product/${product.id}`);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: productName,
    description: productDescription,
    image: product.images && product.images.length > 0 ? product.images[0].url : undefined,
    sku: product.sku || null,
    mpn: product.id,
    brand,
    productId: product.id,
    category,
    offers: {
      '@type': 'Offer',
      url: canonicalUrl,
      price: productPrice,
      priceCurrency: productPrice ? productCurrency : null,
      availability: product.availability ? product.availability.status : 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: t('storeName'),
      },
    },
  };

  return JSON.stringify(jsonLd);
}

/**
 * Generate complete metadata for product pages
 */
export async function generateProductMetadata(
  locale: string,
  product: Product,
  _price?: ProductPrice | null,
): Promise<Metadata> {
  // If product not found, return basic metadata
  if (!product) {
    const t = await getTranslations({ locale, namespace: 'seo' });
    return {
      title: t('productNotFoundTitle'),
      description: t('productNotFoundDescription'),
    };
  }

  const basicMetadata = await generateBasicProductMetadata(product, locale);
  const openGraphMetadata = await generateProductOpenGraphMetadata(product, locale);
  const twitterMetadata = await generateProductTwitterMetadata(product, locale);

  return {
    ...basicMetadata,
    openGraph: openGraphMetadata,
    twitter: twitterMetadata,
  };
}

export async function getPageTitle(title: string | null, locale: string): Promise<string> {
  const t = await getTranslations({ locale, namespace: 'seo' });
  return title ? `${title} | ${t('storeName')}` : t('storeName');
}
