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

function getStrip(): HTMLElement {
  const strip = screen.getByTestId('product-add-to-cart-bar').firstElementChild;
  expect(strip).toBeInstanceOf(HTMLElement);
  return strip as HTMLElement;
}

describe('ProductAddToCartBar', () => {
  it('pads the middle name+price zone when there is no thumbnail', () => {
    render(<ProductAddToCartBar product={buildProduct({ images: [] })} />);

    const middle = screen.getByTestId('product-add-to-cart-bar-middle');
    expect(middle).toHaveClass('pl-6');
    expect(screen.queryByTestId('product-add-to-cart-bar-image')).not.toBeInTheDocument();
  });

  it('pads the middle name+price zone when image URL is empty or whitespace', () => {
    render(
      <ProductAddToCartBar
        product={buildProduct({
          images: [{ url: '   ', altText: 'Empty' }],
          primaryImage: { url: '' },
        })}
      />,
    );

    const middle = screen.getByTestId('product-add-to-cart-bar-middle');
    expect(middle).toHaveClass('pl-6');
    expect(screen.queryByTestId('product-add-to-cart-bar-image')).not.toBeInTheDocument();
  });

  it('uses a three-zone strip: image, flexible name+prices, unmovable buttons', () => {
    render(
      <ProductAddToCartBar
        product={buildProduct({
          name: 'Very Long Product Name That Must Stay Inside The Stripe And Wrap To Two Lines',
          images: [{ url: 'https://example.com/product.jpg', altText: 'Test Product' }],
        })}
        price={buildBarPrice()}
      />,
    );

    const strip = getStrip();
    expect(strip).toHaveClass('h-14');
    expect(strip).not.toHaveClass('min-h-16', 'h-16', '@container/atc-bar');

    const image = screen.getByTestId('product-add-to-cart-bar-image');
    const middle = screen.getByTestId('product-add-to-cart-bar-middle');
    const actions = screen.getByTestId('product-add-to-cart-bar-actions');
    const name = screen.getByTestId('product-add-to-cart-bar-name');
    const priceHost = screen.getByTestId('product-add-to-cart-bar-price');

    expect(strip.children).toHaveLength(3);
    expect(strip.children[0]).toBe(image);
    expect(strip.children[1]).toBe(middle);
    expect(strip.children[2]).toBe(actions);

    expect(image).toHaveClass('w-30', 'h-14', 'p-1.5', 'shrink-0');
    expect(image.querySelector('img')).toHaveClass('object-contain');

    // Middle must contain overflow so name+price cannot paint under the CTA siblings.
    expect(middle).toHaveClass('min-w-0', 'flex-1', 'overflow-hidden');
    expect(middle).not.toHaveClass('pl-6', 'absolute', 'w-full');
    expect(middle.contains(name)).toBe(true);
    expect(middle.contains(priceHost)).toBe(true);
    expect(actions.contains(priceHost)).toBe(false);

    expect(name).toHaveClass('min-w-0', 'flex-1', 'overflow-hidden', 'line-clamp-2', 'text-3xl');
    expect(name).not.toHaveClass('truncate', 'text-sm');

    expect(priceHost).toHaveClass('shrink-0');
    expect(actions).toHaveClass('shrink-0');
    expect(actions.className.split(/\s+/)).not.toContain('shrink');
    // Buttons stay in flex flow after middle — never absolute overlay over prices.
    expect(actions).not.toHaveClass('absolute', 'fixed', 'right-0', 'inset-y-0');
    expect(actions.className).not.toMatch(/\b(absolute|fixed|right-0)\b/);
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

    const middle = screen.getByTestId('product-add-to-cart-bar-middle');
    expect(middle).not.toHaveClass('pl-6');
    expect(screen.getByTestId('product-add-to-cart-bar-image')).toBeInTheDocument();
  });

  it('keeps ATC prices visible at full size beside the name, outside the button cluster', () => {
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
    const actions = screen.getByTestId('product-add-to-cart-bar-actions');
    const middle = screen.getByTestId('product-add-to-cart-bar-middle');

    expect(middle).toContainElement(priceHost);
    expect(priceHost).toContainElement(productPrice);
    expect(actions).not.toContainElement(priceHost);

    // Regression: price must not collapse or paint under CTA icons (middle clips; actions stay in-flow).
    expect(middle).toHaveClass('overflow-hidden', 'min-w-0', 'flex-1');
    expect(priceHost).toHaveClass('shrink-0');
    expect(priceHost).not.toHaveClass('min-w-0');
    expect(priceHost).not.toHaveClass('overflow-hidden');
    expect(productPrice).toHaveClass('w-max');
    expect(productPrice).not.toHaveClass('min-w-0');
    expect(actions).not.toHaveClass('absolute', 'fixed', 'right-0');

    const integerPart = String(Math.floor(price.tax!.netValue));
    expect(document.getElementById('price')).not.toBeNull();
    expect(normalizeWhitespace(document.getElementById('price')!.textContent ?? '')).toContain(integerPart);

    expect(screen.getByTestId('product-price-tax')).toHaveTextContent(`plus ${price.tax!.taxRate}% VAT`);
    expect(screen.getByTestId('product-price-list-column')).toHaveTextContent(
      normalizeWhitespace(formatCurrency(price.originalAmount!, price.currency)),
    );

    expect(actions).toHaveClass('shrink-0', 'gap-6');
    expect(actions).not.toHaveClass('@container/atc-right', 'min-w-0', 'flex-1');
  });
});
