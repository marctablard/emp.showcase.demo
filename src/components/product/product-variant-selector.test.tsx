/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { fetchProductPrices } from '@/lib/client/prices';
import { fetchProductVariants } from '@/lib/client/products';
import type { Product } from '@/platform/services/model/product';
import ProductVariantSelector from './product-variant-selector';

const push = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/hooks/session/useSession', () => ({
  useSession: () => ({ session: { currency: 'EUR' } }),
}));

let mockClientFetchScope = 'anonymous::';

jest.mock('@/hooks/common/useClientFetchScope', () => ({
  useClientFetchScope: () => mockClientFetchScope,
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

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push }),
}));

jest.mock('./product-variant-carousel', () => ({
  ProductVariantCarousel: ({
    currentProductId,
    variants,
    isLoading,
    selectedFilters,
  }: {
    currentProductId: string;
    variants: Product[];
    isLoading?: boolean;
    selectedFilters?: Record<string, string>;
  }) => (
    <div
      data-testid="product-variant-carousel"
      data-current-product-id={currentProductId}
      data-variant-count={variants.length}
      data-variant-ids={variants.map((variant) => variant.id).join(',')}
      data-selected-filters={JSON.stringify(selectedFilters ?? {})}
    >
      {isLoading ? <div data-testid="product-variant-list-loading" /> : null}
    </div>
  ),
}));

jest.mock('./product-variant-attribute-groups', () => ({
  ProductVariantAttributeGroups: ({
    selectedValues,
    productValues,
    groups,
    onSelect,
    onClearAll,
  }: {
    selectedValues?: Record<string, string>;
    productValues?: Record<string, string>;
    groups: Array<{ key: string; values: string[] }>;
    onSelect?: (attributeKey: string, value: string) => void;
    onClearAll?: () => void;
  }) => (
    <div
      data-testid="product-variant-attribute-groups"
      data-selected={JSON.stringify(selectedValues ?? {})}
      data-product-values={JSON.stringify(productValues ?? {})}
      data-group-count={groups.length}
      data-group-values={JSON.stringify(groups.flatMap((group) => group.values))}
    >
      {groups.flatMap((group) =>
        group.values.map((value) => (
          <button
            key={`${group.key}:${value}`}
            type="button"
            data-testid="product-variant-attribute-chip"
            data-attribute-key={group.key}
            data-value={value}
            onClick={() => onSelect?.(group.key, value)}
          >
            {value}
          </button>
        )),
      )}
      <button type="button" data-testid="product-variant-clearAllFilters" onClick={onClearAll}>
        clearAllFilters
      </button>
    </div>
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
    mockClientFetchScope = 'anonymous::';
    fetchProductVariantsMock.mockReset();
    fetchProductPricesMock.mockReset();
    push.mockReset();
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
    expect(fetchProductVariantsMock).toHaveBeenCalledWith('parent-1', 'anonymous::');
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
    expect(fetchProductVariantsMock).toHaveBeenCalledWith('product-1', 'anonymous::');
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
    expect(screen.getByTestId('product-variant-attribute-groups')).toHaveAttribute('data-selected', '{}');
    expect(screen.getByTestId('product-variant-attribute-groups')).toHaveAttribute(
      'data-product-values',
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
    expect(fetchProductVariantsMock).toHaveBeenCalledWith('product-1', 'anonymous::');
  });

  it('clears previous-scope variants while an assigned refetch is in flight', async () => {
    fetchProductVariantsMock.mockResolvedValueOnce([
      buildProduct({
        id: 'v-all',
        variantAttributes: [
          {
            key: 'capacity',
            name: 'Capacity',
            values: [{ key: '12 Ah', selected: true }],
          },
        ],
      }),
    ]);
    fetchProductPricesMock.mockResolvedValue({});

    const { rerender } = render(<ProductVariantSelector product={buildProduct()} />);

    await waitFor(() => {
      expect(screen.getByTestId('product-variant-selector')).toBeInTheDocument();
    });
    expect(screen.getByTestId('product-variant-carousel')).toBeInTheDocument();

    let resolveAssigned: (value: Product[]) => void = () => {};
    fetchProductVariantsMock.mockImplementationOnce(
      () =>
        new Promise<Product[]>((resolve) => {
          resolveAssigned = resolve;
        }),
    );
    mockClientFetchScope = 'assigned:main:cust-1';
    rerender(<ProductVariantSelector product={buildProduct()} />);

    expect(screen.getByTestId('product-variant-selector-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('product-variant-carousel')).not.toBeInTheDocument();

    resolveAssigned([]);
    await waitFor(() => {
      expect(fetchProductVariantsMock).toHaveBeenLastCalledWith('product-1', 'assigned:main:cust-1');
    });
  });

  it('filters the sellable list without navigating when one chip is selected', async () => {
    fetchProductVariantsMock.mockResolvedValue([
      buildProduct({
        id: 'v-12',
        variantAttributeValues: { capacity: '12 Ah' },
        variantAttributes: [{ key: 'capacity', name: 'Capacity', values: [{ key: '12 Ah', selected: true }] }],
      }),
      buildProduct({
        id: 'v-60',
        variantAttributeValues: { capacity: '60 Ah' },
        variantAttributes: [{ key: 'capacity', name: 'Capacity', values: [{ key: '60 Ah', selected: true }] }],
      }),
    ]);
    fetchProductPricesMock.mockResolvedValue({});

    render(
      <ProductVariantSelector
        product={buildProduct({
          id: 'v-12',
          variantAttributeValues: { capacity: '12 Ah' },
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('product-variant-selector')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('60 Ah'));

    await waitFor(() => {
      expect(screen.getByTestId('product-variant-attribute-groups')).toHaveAttribute(
        'data-selected',
        JSON.stringify({ capacity: ['60 Ah'] }),
      );
    });
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByTestId('product-variant-list-loading')).not.toBeInTheDocument();
    expect(screen.getByTestId('product-variant-carousel')).toHaveAttribute('data-variant-count', '1');
    expect(screen.getByTestId('product-variant-carousel')).toHaveAttribute('data-variant-ids', 'v-60');
  });

  it('keeps the opened product when its own attribute is selected as a filter', async () => {
    fetchProductVariantsMock.mockResolvedValue([
      buildProduct({
        id: 'v-12',
        variantAttributeValues: { capacity: '12 Ah' },
        variantAttributes: [{ key: 'capacity', name: 'Capacity', values: [{ key: '12 Ah', selected: true }] }],
      }),
      buildProduct({
        id: 'v-60',
        variantAttributeValues: { capacity: '60 Ah' },
        variantAttributes: [{ key: 'capacity', name: 'Capacity', values: [{ key: '60 Ah', selected: true }] }],
      }),
    ]);
    fetchProductPricesMock.mockResolvedValue({});

    render(
      <ProductVariantSelector
        product={buildProduct({
          id: 'v-12',
          variantAttributeValues: { capacity: '12 Ah' },
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('product-variant-selector')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('12 Ah'));

    await waitFor(() => {
      expect(screen.getByTestId('product-variant-attribute-groups')).toHaveAttribute(
        'data-selected',
        JSON.stringify({ capacity: ['12 Ah'] }),
      );
    });
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByTestId('product-variant-carousel')).toHaveAttribute('data-variant-count', '1');
    expect(screen.getByTestId('product-variant-carousel')).toHaveAttribute(
      'data-selected-filters',
      JSON.stringify({ capacity: ['12 Ah'] }),
    );
    expect(screen.queryByTestId('product-variant-list-loading')).not.toBeInTheDocument();
  });

  it('clears local filters and navigates to the classic parent when it is not the opened product', async () => {
    fetchProductVariantsMock.mockResolvedValue([
      buildProduct({
        id: 'v-12',
        parentVariantId: 'parent-1',
        variantAttributeValues: { capacity: '12 Ah' },
        variantAttributes: [{ key: 'capacity', name: 'Capacity', values: [{ key: '12 Ah', selected: true }] }],
      }),
    ]);
    fetchProductPricesMock.mockResolvedValue({});

    render(
      <ProductVariantSelector
        product={buildProduct({
          id: 'v-12',
          parentVariantId: 'parent-1',
          variantAttributeValues: { capacity: '12 Ah' },
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('product-variant-clearAllFilters')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('12 Ah'));
    await waitFor(() => {
      expect(screen.getByTestId('product-variant-attribute-groups')).toHaveAttribute(
        'data-selected',
        JSON.stringify({ capacity: ['12 Ah'] }),
      );
    });

    fireEvent.click(screen.getByTestId('product-variant-clearAllFilters'));

    await waitFor(() => {
      expect(screen.getByTestId('product-variant-attribute-groups')).toHaveAttribute('data-selected', '{}');
    });
    expect(push).toHaveBeenCalledWith('/product/parent-1');
  });

  it('does not router.push the current id when classic parent is already open', async () => {
    fetchProductVariantsMock.mockResolvedValue([
      buildProduct({
        id: 'v-12',
        parentVariantId: 'parent-1',
        variantAttributeValues: { capacity: '12 Ah' },
        variantAttributes: [{ key: 'capacity', name: 'Capacity', values: [{ key: '12 Ah', selected: true }] }],
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
      expect(screen.getByTestId('product-variant-clearAllFilters')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('product-variant-clearAllFilters'));
    expect(push).not.toHaveBeenCalled();
  });

  it('clears dynamic filters to parentVariantPath.at(-1) when that root is not the opened product', async () => {
    fetchProductVariantsMock.mockResolvedValue([
      buildProduct({
        id: 'leaf-1',
        productType: 'DYNAMIC_VARIANT',
        parentVariantPath: ['mid-1', 'root-1'],
        variantAttributeValues: { capacity: '12 Ah' },
        variantAttributes: [{ key: 'capacity', name: 'Capacity', values: [{ key: '12 Ah', selected: true }] }],
      }),
    ]);
    fetchProductPricesMock.mockResolvedValue({});

    render(
      <ProductVariantSelector
        product={buildProduct({
          id: 'leaf-1',
          productType: 'DYNAMIC_VARIANT',
          parentVariantPath: ['mid-1', 'root-1'],
          variantAttributeValues: { capacity: '12 Ah' },
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('product-variant-clearAllFilters')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('product-variant-clearAllFilters'));
    expect(push).toHaveBeenCalledWith('/product/root-1');
  });

  it('does not guess a dynamic root id when parentVariantPath is empty', async () => {
    fetchProductVariantsMock.mockResolvedValue([
      buildProduct({
        id: 'root-1',
        productType: 'DYNAMIC_VARIANT',
        parentVariantPath: [],
        variantAttributeValues: { capacity: '12 Ah' },
        variantAttributes: [{ key: 'capacity', name: 'Capacity', values: [{ key: '12 Ah', selected: true }] }],
      }),
    ]);
    fetchProductPricesMock.mockResolvedValue({});

    render(
      <ProductVariantSelector
        product={buildProduct({
          id: 'root-1',
          productType: 'DYNAMIC_VARIANT',
          parentVariantPath: [],
          variantAttributeValues: { capacity: '12 Ah' },
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('product-variant-clearAllFilters')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('product-variant-clearAllFilters'));
    expect(push).not.toHaveBeenCalled();
  });

  it('uses a hydrated member parentVariantPath.at(-1) when the opened dynamic product has no path', async () => {
    fetchProductVariantsMock.mockResolvedValue([
      buildProduct({
        id: 'leaf-2',
        productType: 'DYNAMIC_VARIANT',
        parentVariantPath: ['mid-2', 'root-2'],
        variantAttributeValues: { capacity: '60 Ah' },
        variantAttributes: [{ key: 'capacity', name: 'Capacity', values: [{ key: '60 Ah', selected: true }] }],
      }),
    ]);
    fetchProductPricesMock.mockResolvedValue({});

    render(
      <ProductVariantSelector
        product={buildProduct({
          id: 'leaf-1',
          productType: 'DYNAMIC_VARIANT',
          parentVariantPath: [],
          parentVariantId: undefined,
          variantAttributeValues: { capacity: '12 Ah' },
          variantAttributes: [{ key: 'capacity', name: 'Capacity', values: [{ key: '12 Ah', selected: true }] }],
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('product-variant-clearAllFilters')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('product-variant-clearAllFilters'));
    expect(push).toHaveBeenCalledWith('/product/root-2');
  });

  it('always shows the sellable list when no chips are selected', async () => {
    fetchProductVariantsMock.mockResolvedValue([
      buildProduct({
        id: 'v-12',
        variantAttributeValues: { capacity: '12 Ah' },
        variantAttributes: [{ key: 'capacity', name: 'Capacity', values: [{ key: '12 Ah', selected: true }] }],
      }),
      buildProduct({
        id: 'v-60',
        variantAttributeValues: { capacity: '60 Ah' },
        variantAttributes: [{ key: 'capacity', name: 'Capacity', values: [{ key: '60 Ah', selected: true }] }],
      }),
    ]);
    fetchProductPricesMock.mockResolvedValue({});

    render(<ProductVariantSelector product={buildProduct({ id: 'parent-1', isParentVariant: true })} />);

    await waitFor(() => {
      expect(screen.getByTestId('product-variant-carousel')).toHaveAttribute('data-variant-count', '2');
    });
    expect(screen.getByTestId('product-variant-carousel')).toHaveAttribute('data-selected-filters', '{}');
    expect(screen.getByTestId('product-variant-attribute-groups')).toHaveAttribute('data-selected', '{}');
    expect(screen.getByTestId('product-variant-attribute-groups')).toHaveAttribute('data-product-values', '{}');
  });

  it('ORs values on one attribute and ANDs them with other attributes without navigating', async () => {
    const member = (id: string, height: string, color: string): Product =>
      buildProduct({
        id,
        parentVariantId: 'parent-1',
        variantAttributeValues: { height, color },
        variantAttributes: [
          { key: 'height', name: 'Height', values: [{ key: height, selected: true }] },
          { key: 'color', name: 'Color', values: [{ key: color, selected: true }] },
        ],
      });

    fetchProductVariantsMock.mockResolvedValue([
      member('red-30', '30', 'Red'),
      member('blue-30', '30', 'Blue'),
      member('red-10', '10', 'Red'),
      member('green-30', '30', 'Green'),
    ]);
    fetchProductPricesMock.mockResolvedValue({});

    render(
      <ProductVariantSelector
        product={buildProduct({
          id: 'red-30',
          variantAttributeValues: { height: '30', color: 'Red' },
          variantAttributes: [
            { key: 'height', name: 'Height', values: [{ key: '30', selected: true }] },
            { key: 'color', name: 'Color', values: [{ key: 'Red', selected: true }] },
          ],
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('product-variant-carousel')).toHaveAttribute('data-variant-count', '4');
    });
    expect(screen.getByTestId('product-variant-attribute-groups')).toHaveAttribute(
      'data-product-values',
      JSON.stringify({ height: '30', color: 'Red' }),
    );

    fireEvent.click(screen.getByText('30'));
    fireEvent.click(screen.getByText('Red'));
    fireEvent.click(screen.getByText('Blue'));

    await waitFor(() => {
      expect(screen.getByTestId('product-variant-carousel')).toHaveAttribute('data-variant-ids', 'red-30,blue-30');
    });
    expect(push).not.toHaveBeenCalled();
  });

  it('marks the opened variant from the family member when the page product has no attributes', async () => {
    fetchProductVariantsMock.mockResolvedValue([
      buildProduct({
        id: 'leaf-open',
        productType: 'DYNAMIC_VARIANT',
        parentVariantId: 'root-1',
        variantAttributeValues: { height: '30', Width: '40' },
        variantAttributes: [],
      }),
    ]);
    fetchProductPricesMock.mockResolvedValue({});

    render(
      <ProductVariantSelector
        product={buildProduct({
          id: 'leaf-open',
          productType: 'DYNAMIC_VARIANT',
          parentVariantId: 'root-1',
          variantAttributes: [],
          variantAttributeValues: undefined,
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('product-variant-attribute-groups')).toHaveAttribute(
        'data-product-values',
        JSON.stringify({ height: '30', Width: '40' }),
      );
    });
  });

  it('hides non-sellable dynamic members unless they are the opened node', async () => {
    fetchProductVariantsMock.mockResolvedValue([
      buildProduct({
        id: 'leaf-sellable',
        productType: 'DYNAMIC_VARIANT',
        sellable: true,
        variantAttributeValues: { frequency: '800' },
        variantAttributes: [{ key: 'frequency', name: 'Frequency', values: [{ key: '800', selected: true }] }],
      }),
      buildProduct({
        id: 'leaf-hidden',
        productType: 'DYNAMIC_VARIANT',
        sellable: false,
        variantAttributeValues: { frequency: '800', height: '10' },
        variantAttributes: [
          { key: 'frequency', name: 'Frequency', values: [{ key: '800', selected: true }] },
          { key: 'height', name: 'Height', values: [{ key: '10', selected: true }] },
        ],
      }),
      buildProduct({
        id: 'leaf-open',
        productType: 'DYNAMIC_VARIANT',
        sellable: true,
        variantAttributeValues: { frequency: '800', height: '30' },
        variantAttributes: [
          { key: 'frequency', name: 'Frequency', values: [{ key: '800', selected: true }] },
          { key: 'height', name: 'Height', values: [{ key: '30', selected: true }] },
        ],
      }),
    ]);
    fetchProductPricesMock.mockResolvedValue({});

    render(
      <ProductVariantSelector
        product={buildProduct({
          id: 'leaf-open',
          productType: 'DYNAMIC_VARIANT',
          sellable: true,
          parentVariantId: undefined,
          variantAttributeValues: { frequency: '800', height: '30' },
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('product-variant-carousel')).toHaveAttribute(
        'data-variant-ids',
        'leaf-sellable,leaf-open',
      );
    });
    expect(screen.getByTestId('product-variant-carousel')).toHaveAttribute('data-variant-count', '2');
  });

  it('keeps the opened non-sellable dynamic node on the list', async () => {
    fetchProductVariantsMock.mockResolvedValue([
      buildProduct({
        id: 'leaf-sellable',
        productType: 'DYNAMIC_VARIANT',
        sellable: true,
        variantAttributeValues: { frequency: '800' },
        variantAttributes: [{ key: 'frequency', name: 'Frequency', values: [{ key: '800', selected: true }] }],
      }),
      buildProduct({
        id: 'leaf-open',
        productType: 'DYNAMIC_VARIANT',
        sellable: false,
        variantAttributeValues: { frequency: '800', height: '10' },
        variantAttributes: [
          { key: 'frequency', name: 'Frequency', values: [{ key: '800', selected: true }] },
          { key: 'height', name: 'Height', values: [{ key: '10', selected: true }] },
        ],
      }),
    ]);
    fetchProductPricesMock.mockResolvedValue({});

    render(
      <ProductVariantSelector
        product={buildProduct({
          id: 'leaf-open',
          productType: 'DYNAMIC_VARIANT',
          sellable: false,
          parentVariantId: undefined,
          variantAttributeValues: { frequency: '800', height: '10' },
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('product-variant-carousel')).toHaveAttribute(
        'data-variant-ids',
        'leaf-sellable,leaf-open',
      );
    });
  });
});
