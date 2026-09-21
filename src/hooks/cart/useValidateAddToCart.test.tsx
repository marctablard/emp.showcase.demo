import { renderHook } from '@testing-library/react';
import type { ProductPrice } from '@/platform/services/model/price';
import type { Product } from '@/platform/services/model/product';
import { useValidateAddToCart } from './useValidateAddToCart';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const mockUseSession = jest.fn();
const mockUseSite = jest.fn();

jest.mock('@/hooks/session/useSession', () => ({
  useSession: () => mockUseSession(),
}));

jest.mock('@/hooks/site/useSite', () => ({
  useSite: () => mockUseSite(),
}));

function makeProduct(overrides?: Partial<Product>): Product {
  return {
    id: 'product-1',
    name: { en: 'Product 1' },
    description: { en: 'Description' },
    purchasable: true,
    ...overrides,
  };
}

function makePrice(overrides?: Partial<ProductPrice>): ProductPrice {
  return {
    id: 'price-1',
    productId: 'product-1',
    amount: 10,
    currency: 'EUR',
    discountValue: 0,
    discountPercentage: 0,
    totalValue: 10,
    quantity: { quantity: 1 },
    includesTax: false,
    tierValues: [],
    ...overrides,
  };
}

const unionAxes: Product['variantAttributes'] = [
  { key: 'frequency', values: [{ key: '800', selected: true }] },
  { key: 'width', values: [{ key: '10', selected: true }] },
  { key: 'height', values: [{ key: '20', selected: false }] },
];

/** Live COP-4811 dynamic grouping node: 800 | 10, sellable: false. */
const dynamicGroupingNode = makeProduct({
  id: '6a42601f345f085853088ee7',
  name: { en: '800 | 10' },
  productType: 'DYNAMIC_VARIANT',
  sellable: false,
  purchasable: false,
  variantAttributes: unionAxes,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSession.mockReturnValue({
    session: { id: 'sess', siteCode: 'main', currency: 'EUR', customerId: 'ANONYMOUS' },
  });
  mockUseSite.mockReturnValue({
    site: { code: 'main', defaultCurrency: { id: 'EUR' }, currencies: [{ id: 'EUR' }] },
  });
});

describe('useValidateAddToCart', () => {
  it('disables sellable === false before the master-product test', () => {
    const { result } = renderHook(() => useValidateAddToCart(dynamicGroupingNode, makePrice()));

    expect(result.current).toEqual({
      disabled: true,
      tooltip: 'cartTooltipNotSellable',
    });
  });

  it('uses COP-5507 tooltip for sellable === false in wishlist scope', () => {
    const { result } = renderHook(() => useValidateAddToCart(dynamicGroupingNode, makePrice(), 'wishlist'));

    expect(result.current).toEqual({
      disabled: true,
      tooltip: 'cartTooltipNotSellable',
    });
  });

  it('uses cartTooltipMasterProduct for PARENT_VARIANT with undefined sellable', () => {
    const { result } = renderHook(() =>
      useValidateAddToCart(
        makeProduct({
          productType: 'PARENT_VARIANT',
          purchasable: false,
          variantAttributes: [{ key: 'color', values: [{ key: 'red', selected: false }] }],
        }),
      ),
    );

    expect(result.current).toEqual({
      disabled: true,
      tooltip: 'cartTooltipMasterProduct',
    });
  });

  it('uses wishlistTooltipMasterProduct for !purchasable with variant axes and undefined sellable', () => {
    const { result } = renderHook(() =>
      useValidateAddToCart(
        makeProduct({
          productType: 'PARENT_VARIANT',
          purchasable: false,
          variantAttributes: [{ key: 'color', values: [{ key: 'red', selected: false }] }],
        }),
        undefined,
        'wishlist',
      ),
    );

    expect(result.current).toEqual({
      disabled: true,
      tooltip: 'wishlistTooltipMasterProduct',
    });
  });

  it('keeps BASIC with undefined sellable enabled when priced', () => {
    const priced = makeProduct({
      productType: 'BASIC',
      purchasable: true,
      price: makePrice(),
    });

    const { result } = renderHook(() => useValidateAddToCart(priced));

    expect(result.current).toEqual({
      disabled: false,
      tooltip: undefined,
    });
  });

  it('keeps VARIANT with undefined sellable enabled when priced', () => {
    const priced = makeProduct({
      id: '6a4260610e319b17b667d5c2',
      name: { en: 'Ubiquity-router' },
      productType: 'VARIANT',
      purchasable: true,
      price: makePrice({ productId: '6a4260610e319b17b667d5c2' }),
    });

    const { result } = renderHook(() => useValidateAddToCart(priced, priced.price));

    expect(result.current).toEqual({
      disabled: false,
      tooltip: undefined,
    });
  });
});
