/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { PRODUCT_NO_IMAGE_SRC } from '@/lib/common/product-image';
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
  useLocale: () => 'en-US',
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

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="product-variant-carousel-value-tooltip">{children}</div>
  ),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt: string; src?: string }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={props.alt} src={props.src} />;
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
  it('fits five 161px cards in an 876px viewport', () => {
    expect(resolveSlidesPerPage(876)).toBe(5);
    expect(resolvePageCount(9, 5)).toBe(2);
  });
});

describe('ProductVariantCarousel', () => {
  const scrollIntoView = jest.fn();

  beforeEach(() => {
    push.mockClear();
    scrollIntoView.mockReset();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoView,
    });
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
    expect(screen.getAllByText('12 Ah').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('60 Ah').length).toBeGreaterThanOrEqual(1);
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

  it('prefers mixin NUMBER values over a catalog selected 0', () => {
    const variant: Product = {
      id: 'v-number',
      name: 'v-number',
      description: '',
      purchasable: true,
      variantAttributeValues: { 'a-number-attribute-9': '2342423' },
      variantAttributes: [
        {
          key: 'a-number-attribute-9',
          values: [
            { key: '0', selected: true },
            { key: '2342423', selected: false },
          ],
        },
      ],
    };

    render(
      <ProductVariantCarousel
        variants={[variant]}
        prices={[buildPrice('v-number', 10)]}
        currentProductId="v-number"
        attributeOrder={['a-number-attribute-9']}
        attributeTypes={{ 'a-number-attribute-9': 'NUMBER' }}
      />,
    );

    expect(screen.getAllByText('2,342,423').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('exposes truncated attribute values in a tooltip', () => {
    const variant: Product = {
      id: 'v-long',
      name: 'v-long',
      description: '',
      purchasable: true,
      variantAttributeValues: {
        'a-very-long-attribute-name-to-test-wrapping': 'First option with a relatively long name',
      },
    };

    render(
      <ProductVariantCarousel
        variants={[variant]}
        prices={[buildPrice('v-long', 10)]}
        currentProductId="v-long"
        attributeOrder={['a-very-long-attribute-name-to-test-wrapping']}
      />,
    );

    const value = screen.getByTestId('product-variant-carousel-value');
    expect(value).toHaveClass('truncate');
    expect(value).toHaveClass('group-focus-visible:whitespace-normal');
    expect(screen.getByTestId('product-variant-carousel-card')).toHaveClass('group');
    expect(screen.getByTestId('product-variant-carousel-value-tooltip')).toHaveTextContent(
      'First option with a relatively long name',
    );
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
    expect(screen.getByTestId('product-variant-list-loading')).toBeInTheDocument();
  });

  it('clears navigation loading when the opened product id changes', () => {
    const variants = [buildVariant('v1', '12 Ah'), buildVariant('v2', '60 Ah')];
    const prices = [buildPrice('v1', 290.9), buildPrice('v2', 900)];
    const { rerender } = render(
      <ProductVariantCarousel
        variants={variants}
        prices={prices}
        currentProductId="v1"
        attributeOrder={['capacity']}
      />,
    );

    fireEvent.click(screen.getAllByTestId('product-variant-carousel-card')[1]);
    expect(screen.getByTestId('product-variant-list-loading')).toBeInTheDocument();

    rerender(
      <ProductVariantCarousel
        variants={variants}
        prices={prices}
        currentProductId="v2"
        attributeOrder={['capacity']}
      />,
    );

    expect(screen.queryByTestId('product-variant-list-loading')).not.toBeInTheDocument();
  });

  it('omits chip-selected axes from card call-outs and keeps differentiating values', () => {
    const variants: Product[] = [
      {
        ...buildVariant('v1', '12 Ah'),
        variantAttributes: [
          { key: 'capacity', name: 'Capacity', values: [{ key: '12 Ah', selected: true }] },
          { key: 'voltage', name: 'Voltage', values: [{ key: '12 V', selected: true }] },
        ],
      },
      {
        ...buildVariant('v2', '12 Ah'),
        variantAttributes: [
          { key: 'capacity', name: 'Capacity', values: [{ key: '12 Ah', selected: true }] },
          { key: 'voltage', name: 'Voltage', values: [{ key: '24 V', selected: true }] },
        ],
      },
    ];

    render(
      <ProductVariantCarousel
        variants={variants}
        prices={[buildPrice('v1', 10), buildPrice('v2', 20)]}
        currentProductId="v1"
        attributeOrder={['capacity', 'voltage']}
        selectedFilters={{ capacity: '12 Ah' }}
      />,
    );

    expect(screen.queryByText('12 Ah')).not.toBeInTheDocument();
    expect(screen.getAllByText('12 V').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('24 V').length).toBeGreaterThanOrEqual(1);
  });

  it('pages to the selected card and scrolls it into view', () => {
    render(
      <ProductVariantCarousel
        variants={buildVariants(9)}
        prices={buildVariants(9).map((variant, index) => buildPrice(variant.id, 100 + index))}
        currentProductId="v9"
        attributeOrder={['capacity']}
      />,
    );

    const selected = screen
      .getAllByTestId('product-variant-carousel-card')
      .find((card) => card.getAttribute('data-variant-selected') === 'true');
    expect(selected).toBeDefined();
    expect(screen.getByTestId('product-variant-carousel-track')).toHaveAttribute('data-page', '1');
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('renders a disabled non-sellable card that does not navigate', () => {
    const disabled: Product = { ...buildVariant('v-off', '10'), sellable: false };

    render(
      <ProductVariantCarousel
        variants={[buildVariant('v1', '12 Ah'), disabled]}
        prices={[buildPrice('v1', 10), buildPrice('v-off', 20)]}
        currentProductId="v-off"
        attributeOrder={['capacity']}
      />,
    );

    const cards = screen.getAllByTestId('product-variant-carousel-card');
    expect(cards[1]).toBeDisabled();
    expect(cards[1]).toHaveAttribute('aria-disabled', 'true');
    expect(cards[1]).toHaveAttribute('data-variant-selected', 'true');
    fireEvent.click(cards[1]);
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByTestId('product-variant-list-loading')).not.toBeInTheDocument();
  });

  it('shows the list loader above Sellable variants when isLoading is set', () => {
    render(
      <ProductVariantCarousel
        variants={[buildVariant('v1', '12 Ah')]}
        prices={[buildPrice('v1', 10)]}
        currentProductId="v1"
        attributeOrder={['capacity']}
        isLoading
      />,
    );

    const loading = screen.getByTestId('product-variant-list-loading');
    expect(loading).toBeInTheDocument();
    expect(loading.tagName).toBe('OUTPUT');
    expect(screen.getByText('variants.sellableVariants')).toBeInTheDocument();
    expect(screen.getByTestId('product-variant-carousel-card')).toBeInTheDocument();
    expect(screen.getByTestId('product-variant-carousel-prev')).toBeInTheDocument();
    expect(screen.getByTestId('product-variant-carousel-next')).toBeInTheDocument();
  });

  it('keeps the panel and explains when no sellable variants match', () => {
    render(<ProductVariantCarousel variants={[]} prices={[]} currentProductId="v1" attributeOrder={['capacity']} />);

    expect(screen.getByTestId('product-variant-carousel')).toBeInTheDocument();
    expect(screen.getByText('variants.sellableVariants')).toBeInTheDocument();
    expect(screen.getByTestId('product-variant-carousel-empty')).toHaveTextContent(
      'variants.noMatchingSellableVariants',
    );
    expect(screen.queryByTestId('product-variant-carousel-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('product-variant-carousel-prev')).not.toBeInTheDocument();
  });

  it('uses the shared product image placeholder when a variant has no image', () => {
    render(
      <ProductVariantCarousel
        variants={[buildVariant('v1', '12 Ah')]}
        prices={[buildPrice('v1', 10)]}
        currentProductId="v1"
        attributeOrder={['capacity']}
      />,
    );

    expect(screen.getByRole('img', { name: 'noImage' })).toHaveAttribute('src', PRODUCT_NO_IMAGE_SRC);
  });
});
