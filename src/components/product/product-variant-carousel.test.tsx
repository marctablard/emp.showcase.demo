/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ProductPrice } from '@/platform/services/model/price';
import type { Product } from '@/platform/services/model/product';
import { ProductVariantCarousel, resolvePageCount, resolveSlidesPerPage } from './product-variant-carousel';

const push = jest.fn();

beforeAll(() => {
  class ResizeObserverMock {
    private readonly callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element): void {
      Object.defineProperty(target, 'clientWidth', { configurable: true, value: 876 });
      this.callback(
        [
          {
            target,
            contentRect: target.getBoundingClientRect(),
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          } as ResizeObserverEntry,
        ],
        this,
      );
    }

    unobserve(): void {}
    disconnect(): void {}
  }
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: ResizeObserverMock,
  });
});

jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, values?: Record<string, string | number>) => {
    if (namespace === 'common.UI.Carousel') {
      if (key === 'pageTitle') {
        return `Page ${values?.index}`;
      }
      return key;
    }
    if (key === 'variants.count') {
      return `(${values?.count} variants)`;
    }
    return key;
  },
}));

jest.mock('@/hooks/useL10n', () => ({
  useL10n: () => ({
    l10n: (value: string) => value,
    l10nOrEmpty: (value: string) => value ?? '',
  }),
}));

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt: string }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={props.alt} />;
  },
}));

function buildVariant(id: string, capacity: string): Product {
  return {
    id,
    name: id,
    description: '',
    purchasable: true,
    variantAttributes: [
      {
        key: 'capacity',
        name: 'Capacity',
        values: [{ key: capacity, selected: true }],
      },
    ],
  };
}

function buildPrice(productId: string, netValue: number): ProductPrice {
  return {
    id: `price-${productId}`,
    productId,
    currency: 'EUR',
    amount: netValue,
    originalAmount: netValue,
    discountValue: 0,
    discountPercentage: 0,
    totalValue: netValue,
    quantity: { quantity: 1 },
    includesTax: false,
    tax: {
      taxCode: 'STANDARD',
      taxRate: 19,
      netValue,
      grossValue: netValue * 1.19,
      amount: netValue * 0.19,
      currency: 'EUR',
    },
    tierValues: [],
  };
}

function buildVariants(count: number): Product[] {
  return Array.from({ length: count }, (_, index) => buildVariant(`v${index + 1}`, `${index + 1} Ah`));
}

describe('resolveSlidesPerPage / resolvePageCount', () => {
  it('fits five 157px cards in an 876px viewport', () => {
    expect(resolveSlidesPerPage(876)).toBe(5);
    expect(resolvePageCount(9, 5)).toBe(2);
  });
});

describe('ProductVariantCarousel', () => {
  beforeEach(() => {
    push.mockClear();
  });

  it('renders sellable variants with attribute values and net prices', () => {
    render(
      <ProductVariantCarousel
        variants={[buildVariant('v1', '12 Ah'), buildVariant('v2', '60 Ah')]}
        prices={[buildPrice('v1', 290.9), buildPrice('v2', 900)]}
        currentProductId="v1"
        attributeOrder={['capacity']}
      />,
    );

    expect(screen.getByText('variants.sellableVariants')).toBeInTheDocument();
    expect(screen.getByText('(2 variants)')).toBeInTheDocument();
    expect(screen.getByText('12 Ah')).toBeInTheDocument();
    expect(screen.getByText('60 Ah')).toBeInTheDocument();
    expect(screen.getAllByTestId('product-variant-carousel-card')[0]).toHaveAttribute('data-variant-selected', 'true');
  });

  it('pages with arrows and dots when variants overflow the viewport', () => {
    render(
      <ProductVariantCarousel
        variants={buildVariants(9)}
        prices={buildVariants(9).map((variant, index) => buildPrice(variant.id, 100 + index))}
        currentProductId="v1"
        attributeOrder={['capacity']}
      />,
    );

    expect(screen.getByTestId('product-variant-carousel-dots')).toBeInTheDocument();
    expect(screen.getAllByTestId('product-variant-carousel-dot')).toHaveLength(2);
    expect(screen.getByTestId('product-variant-carousel-track')).toHaveAttribute('data-page', '0');
    expect(screen.getByTestId('product-variant-carousel-prev')).toBeDisabled();
    expect(screen.getByTestId('product-variant-carousel-next')).toBeEnabled();

    fireEvent.click(screen.getByTestId('product-variant-carousel-next'));
    expect(screen.getByTestId('product-variant-carousel-track')).toHaveAttribute('data-page', '1');
    expect(screen.getByTestId('product-variant-carousel-prev')).toBeEnabled();
    expect(screen.getByTestId('product-variant-carousel-next')).toBeDisabled();

    fireEvent.click(screen.getAllByTestId('product-variant-carousel-dot')[0]);
    expect(screen.getByTestId('product-variant-carousel-track')).toHaveAttribute('data-page', '0');
  });

  it('navigates to another variant on card click', () => {
    render(
      <ProductVariantCarousel
        variants={[buildVariant('v1', '12 Ah'), buildVariant('v2', '60 Ah')]}
        prices={[buildPrice('v1', 290.9), buildPrice('v2', 900)]}
        currentProductId="v1"
        attributeOrder={['capacity']}
      />,
    );

    fireEvent.click(screen.getAllByTestId('product-variant-carousel-card')[1]);
    expect(push).toHaveBeenCalledWith('/product/v2');
  });
});
