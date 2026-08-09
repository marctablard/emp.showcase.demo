/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { formatCurrency } from '@/lib/utils';
import type { ProductPrice } from '@/platform/services/model/price';
import type { Product } from '@/platform/services/model/product';
import ProductAddToCartBar from './product-add-to-cart-bar';

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    if (key === 'plusTax' && values?.taxRate != null) {
      return `plus ${values.taxRate}% VAT`;
    }
    return key;
  },
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} {...props} />,
}));

jest.mock('@/hooks/product/useProduct', () => ({
  useProduct: (product?: Product) => ({ product }),
}));

jest.mock('@/hooks/common/useGlobalSyncReady', () => ({
  useGlobalSyncReady: () => ({ ready: true, reason: null }),
}));

jest.mock('@/hooks/useL10n', () => ({
  useL10n: () => ({
    l10n: (value: unknown) => {
      if (typeof value === 'string') {
        return value;
      }
      if (value && typeof value === 'object' && 'en' in value) {
        return (value as Record<string, string>).en;
      }
      return '-';
    },
    l10nOrEmpty: (value: unknown) => {
      if (typeof value === 'string') {
        return value;
      }
      if (value && typeof value === 'object' && 'en' in value) {
        return (value as Record<string, string>).en;
      }
      return '';
    },
  }),
}));

jest.mock('./product-add-to-cart-button', () => ({
  __esModule: true,
  default: () => <button type="button" data-testid="product-add-to-cart-button-stub" />,
}));

function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    name: 'Test Product',
    description: 'Description',
    purchasable: true,
    ...overrides,
  };
}

function buildBarPrice(overrides: Partial<ProductPrice> = {}): ProductPrice {
  return {
    id: 'p1',
    productId: 'product-1',
    currency: 'EUR',
    amount: 100,
    originalAmount: 120,
    discountValue: 20,
    discountPercentage: 10,
    totalValue: 100,
    quantity: { quantity: 1 },
    includesTax: false,
    tax: {
      taxCode: 'STANDARD',
      taxRate: 19,
      netValue: 100,
      grossValue: 119,
      amount: 19,
      currency: 'EUR',
    },
    tierValues: [],
    ...overrides,
  };
}

function normalizeWhitespace(value: string): string {
  return value.replaceAll(/\s+/g, ' ').trim();
}

describe('ProductAddToCartBar', () => {
  it('pads the left content group when there is no thumbnail', () => {
    render(<ProductAddToCartBar product={buildProduct({ images: [] })} />);

    const left = screen.getByTestId('product-add-to-cart-bar-left');
    expect(left).toHaveClass('pl-6');
    expect(screen.queryByTestId('product-add-to-cart-bar-image')).not.toBeInTheDocument();
  });

  it('pads the left content group when image URL is empty or whitespace', () => {
    render(
      <ProductAddToCartBar
        product={buildProduct({
          images: [{ url: '   ', altText: 'Empty' }],
          primaryImage: { url: '' },
        })}
      />,
    );

    const left = screen.getByTestId('product-add-to-cart-bar-left');
    expect(left).toHaveClass('pl-6');
    expect(screen.queryByTestId('product-add-to-cart-bar-image')).not.toBeInTheDocument();
  });

  it('shows the original padded thumbnail beside a single-line truncated title', () => {
    render(
      <ProductAddToCartBar
        product={buildProduct({
          name: 'Very Long Product Name That Must Stay Inside The Stripe',
          images: [{ url: 'https://example.com/product.jpg', altText: 'Test Product' }],
        })}
      />,
    );

    const strip = screen.getByTestId('product-add-to-cart-bar').firstElementChild;
    expect(strip).toHaveClass('h-14', '@container/atc-bar');
    expect(strip).not.toHaveClass('min-h-16', 'h-16');

    const left = screen.getByTestId('product-add-to-cart-bar-left');
    const image = screen.getByTestId('product-add-to-cart-bar-image');
    const name = screen.getByTestId('product-add-to-cart-bar-name');

    expect(left).not.toHaveClass('pl-6');
    expect(left.contains(image)).toBe(true);
    expect(image).toHaveClass('w-30', 'h-14', 'p-1.5');
    expect(image.querySelector('img')).toHaveClass('object-contain');
    expect(name).toHaveClass('truncate', 'text-3xl');
    expect(name).not.toHaveClass('line-clamp-2', 'text-sm');
  });

  it('shows primaryImage when images array has no usable URL', () => {
    render(
      <ProductAddToCartBar
        product={buildProduct({
          images: [{ url: '' }],
          primaryImage: { url: 'https://example.com/primary.jpg', altText: 'Primary' },
        })}
      />,
    );

    const left = screen.getByTestId('product-add-to-cart-bar-left');
    expect(left).not.toHaveClass('pl-6');
    expect(screen.getByTestId('product-add-to-cart-bar-image')).toBeInTheDocument();
  });

  it('renders visible net price, tax small print, and list price in the sticky strip', () => {
    const price = buildBarPrice();
    render(
      <ProductAddToCartBar
        product={buildProduct({
          images: [{ url: 'https://example.com/product.jpg', altText: 'Test Product' }],
        })}
        price={price}
      />,
    );

    const priceHost = screen.getByTestId('product-add-to-cart-bar-price');
    const productPrice = screen.getByTestId('product-price');
    expect(priceHost).toContainElement(productPrice);

    // Regression: price must not be collapsed away from the strip (empty middle).
    expect(priceHost).not.toHaveClass('min-w-0');
    expect(priceHost).not.toHaveClass('overflow-hidden');
    expect(productPrice).toHaveClass('w-max');

    const integerPart = String(Math.floor(price.tax!.netValue));
    expect(document.getElementById('price')).not.toBeNull();
    expect(normalizeWhitespace(document.getElementById('price')!.textContent ?? '')).toContain(integerPart);

    expect(screen.getByTestId('product-price-tax')).toHaveTextContent(`plus ${price.tax!.taxRate}% VAT`);
    expect(screen.getByTestId('product-price-list-column')).toHaveTextContent(
      normalizeWhitespace(formatCurrency(price.originalAmount!, price.currency)),
    );

    const rightCluster = priceHost.parentElement;
    expect(rightCluster).not.toBeNull();
    // Query the strip container — never put `@container` on this flex item (inline-size containment collapse).
    expect(rightCluster).toHaveClass('shrink-0', 'gap-0', '@[420px]/atc-bar:gap-10');
    expect(rightCluster).not.toHaveClass('@container/atc-right');
    expect(rightCluster).not.toHaveClass('min-w-0');
    expect(rightCluster?.className.split(/\s+/)).not.toContain('shrink');
  });
});
