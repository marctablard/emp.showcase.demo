/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { Product } from '@/platform/services/model/product';
import ProductAddToCartBar from './product-add-to-cart-bar';

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, fill: _fill, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => (
    <img alt={alt} {...props} />
  ),
}));

jest.mock('@/hooks/product/useProduct', () => ({
  useProduct: (product?: Product) => ({ product }),
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

jest.mock('./product-price', () => ({
  ProductPriceComponent: () => <div data-testid="product-price-stub" />,
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

  it('keeps a full-height flush thumbnail beside the title (no text overlay)', () => {
    render(
      <ProductAddToCartBar
        product={buildProduct({
          images: [{ url: 'https://example.com/product.jpg', altText: 'Test Product' }],
        })}
      />,
    );

    const left = screen.getByTestId('product-add-to-cart-bar-left');
    const image = screen.getByTestId('product-add-to-cart-bar-image');
    const name = screen.getByTestId('product-add-to-cart-bar-name');

    expect(left).not.toHaveClass('pl-6');
    expect(left.contains(image)).toBe(false);
    expect(image).toHaveClass('self-stretch', 'w-30');
    expect(image).not.toHaveClass('p-2');
    expect(image.querySelector('img')).toHaveClass('object-cover');
    expect(name).toBeInTheDocument();
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

  it('grows with content and clamps long product names without padding the image', () => {
    render(
      <ProductAddToCartBar
        product={buildProduct({
          name: 'Very Long Product Name That Would Otherwise Overflow The Sticky Strip Height',
          images: [{ url: 'https://example.com/product.jpg', altText: 'Test Product' }],
        })}
      />,
    );

    const strip = screen.getByTestId('product-add-to-cart-bar').firstElementChild;
    expect(strip).toHaveClass('min-h-16', 'items-stretch');
    expect(strip).not.toHaveClass('h-16', 'py-2');

    const image = screen.getByTestId('product-add-to-cart-bar-image');
    expect(image).toHaveClass('self-stretch');
    expect(image).not.toHaveClass('p-2', 'py-2');

    const name = screen.getByTestId('product-add-to-cart-bar-name');
    expect(name).toHaveClass('line-clamp-2', 'text-sm', 'leading-tight', 'min-w-0');
  });
});
