/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { fetchProductPrices } from '@/lib/client/prices';
import { fetchProductVariants } from '@/lib/client/products';
import type { Product } from '@/platform/services/model/product';
import ProductVariantSelector from './product-variant-selector';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/hooks/session/useSession', () => ({
  useSession: () => ({ session: { currency: 'EUR' } }),
}));

jest.mock('@/hooks/useL10n', () => ({
  useL10n: () => ({
    l10n: (value: string) => value,
    l10nOrEmpty: (value: string) => value ?? '',
  }),
}));

jest.mock('@/lib/client/products', () => ({
  fetchProductVariants: jest.fn(),
}));

jest.mock('@/lib/client/prices', () => ({
  fetchProductPrices: jest.fn(),
}));

jest.mock('./product-variant-carousel', () => ({
  ProductVariantCarousel: ({ currentProductId, variants }: { currentProductId: string; variants: Product[] }) => (
    <div
      data-testid="product-variant-carousel"
      data-current-product-id={currentProductId}
      data-variant-count={variants.length}
    />
  ),
}));

jest.mock('./product-variant-attribute-groups', () => ({
  ProductVariantAttributeGroups: ({
    selectedValues,
    groups,
  }: {
    selectedValues?: Record<string, string>;
    groups: Array<{ key: string; values: string[] }>;
  }) => (
    <div
      data-testid="product-variant-attribute-groups"
      data-selected={JSON.stringify(selectedValues ?? {})}
      data-group-count={groups.length}
      data-group-values={JSON.stringify(groups.flatMap((group) => group.values))}
    />
  ),
}));

const fetchProductVariantsMock = fetchProductVariants as jest.MockedFunction<typeof fetchProductVariants>;
const fetchProductPricesMock = fetchProductPrices as jest.MockedFunction<typeof fetchProductPrices>;

function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    name: 'Battery',
    description: '',
    purchasable: true,
    parentVariantId: 'parent-1',
    variantAttributes: [
      {
        key: 'capacity',
        name: 'Capacity',
        values: [{ key: '12 Ah', selected: true }],
      },
    ],
    ...overrides,
  };
}

describe('ProductVariantSelector', () => {
  beforeEach(() => {
    fetchProductVariantsMock.mockReset();
    fetchProductPricesMock.mockReset();
  });

  it('returns null for a simple product with no variant family', () => {
    const { container } = render(
      <ProductVariantSelector
        product={buildProduct({
          parentVariantId: undefined,
          isParentVariant: false,
          variantAttributes: [],
        })}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(fetchProductVariantsMock).not.toHaveBeenCalled();
  });

  it('loads child variants for a parent with an empty attribute catalog', async () => {
    fetchProductVariantsMock.mockResolvedValue([
      buildProduct({
        id: 'v-300',
        parentVariantId: 'parent-1',
        variantAttributes: [
          {
            key: 'nominal-power',
            name: 'nominal-power',
            values: [{ key: '300W', selected: true }],
          },
        ],
        variantAttributeValues: { 'nominal-power': '300W' },
      }),
      buildProduct({
        id: 'v-100',
        parentVariantId: 'parent-1',
        variantAttributes: [
          {
            key: 'nominal-power',
            name: 'nominal-power',
            values: [{ key: '100W', selected: true }],
          },
        ],
        variantAttributeValues: { 'nominal-power': '100W' },
      }),
    ]);
    fetchProductPricesMock.mockResolvedValue({});

    render(
      <ProductVariantSelector
        product={buildProduct({
          id: 'parent-1',
          parentVariantId: undefined,
          isParentVariant: true,
          variantAttributes: [],
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('product-variant-selector')).toBeInTheDocument();
    });
    expect(screen.getByTestId('product-variant-attribute-groups')).toHaveAttribute('data-selected', '{}');
    expect(screen.getByTestId('product-variant-attribute-groups')).toHaveAttribute('data-group-count', '1');
    expect(screen.getByTestId('product-variant-carousel')).toHaveAttribute('data-current-product-id', 'parent-1');
    expect(screen.getByTestId('product-variant-carousel')).toHaveAttribute('data-variant-count', '2');
    expect(fetchProductVariantsMock).toHaveBeenCalledWith('parent-1');
  });

  it('loads variants and renders attribute groups plus carousel', async () => {
    fetchProductVariantsMock.mockResolvedValue([
      buildProduct({
        id: 'v1',
        variantAttributes: [
          {
            key: 'capacity',
            name: 'Capacity',
            values: [{ key: '12 Ah', selected: true }],
          },
        ],
      }),
    ]);
    fetchProductPricesMock.mockResolvedValue({
      v1: {
        id: 'p1',
        productId: 'v1',
        currency: 'EUR',
        amount: 100,
        originalAmount: 100,
        discountValue: 0,
        discountPercentage: 0,
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
      },
    });

    render(<ProductVariantSelector product={buildProduct()} />);

    expect(screen.getByTestId('product-variant-selector-loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('product-variant-selector')).toBeInTheDocument();
    });
    expect(screen.getByTestId('product-variant-attribute-groups')).toBeInTheDocument();
    expect(screen.getByTestId('product-variant-carousel')).toBeInTheDocument();
    expect(fetchProductVariantsMock).toHaveBeenCalledTimes(1);
    expect(fetchProductVariantsMock).toHaveBeenCalledWith('parent-1');
    expect(fetchProductPricesMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the current variant visible when it is missing from the fetched page', async () => {
    fetchProductVariantsMock.mockResolvedValue([
      buildProduct({
        id: 'other',
        variantAttributeValues: { 'a-number-attribute-9': '0' },
        variantAttributes: [
          {
            key: 'a-number-attribute-9',
            values: [
              { key: '0', selected: true },
              { key: '2342423', selected: false },
            ],
          },
        ],
      }),
    ]);
    fetchProductPricesMock.mockResolvedValue({});

    render(
      <ProductVariantSelector
        product={buildProduct({
          id: 'current',
          parentVariantId: 'parent-1',
          variantAttributeValues: { 'a-number-attribute-9': '2342423' },
          variantAttributes: [
            {
              key: 'a-number-attribute-9',
              values: [{ key: '2342423', selected: true }],
            },
          ],
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('product-variant-carousel')).toHaveAttribute('data-variant-count', '2');
    });
    expect(screen.getByTestId('product-variant-attribute-groups')).toHaveAttribute(
      'data-selected',
      JSON.stringify({ 'a-number-attribute-9': '2342423' }),
    );
    expect(screen.getByTestId('product-variant-attribute-groups')).toHaveAttribute(
      'data-group-values',
      JSON.stringify(['0', '2342423']),
    );
  });

  it('returns null when variants fetch is empty', async () => {
    fetchProductVariantsMock.mockResolvedValue([]);

    const { container } = render(<ProductVariantSelector product={buildProduct()} />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
    expect(fetchProductVariantsMock).toHaveBeenCalledWith('parent-1');
  });
});
