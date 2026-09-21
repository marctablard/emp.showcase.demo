import { act, renderHook, waitFor } from '@testing-library/react';
import { fetchProductAvailability } from '@/lib/client/availability';
import { fetchProductPrice } from '@/lib/client/prices';
import type { Site } from '@/platform/services/model/common/site';
import type { ProductPrice } from '@/platform/services/model/price';
import type { Product } from '@/platform/services/model/product';
import type { Session } from '@/platform/services/model/session/session';
import { usePdpPurchaseData } from './usePdpPurchaseData';

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  }),
}));

jest.mock('@/lib/client/prices', () => ({
  fetchProductPrice: jest.fn(),
}));

jest.mock('@/lib/client/availability', () => ({
  fetchProductAvailability: jest.fn(),
}));

const fetchProductPriceMock = fetchProductPrice as jest.MockedFunction<typeof fetchProductPrice>;
const fetchProductAvailabilityMock = fetchProductAvailability as jest.MockedFunction<typeof fetchProductAvailability>;

function catalogProduct(id: string): Product {
  return {
    id,
    name: `Product ${id}`,
    description: `Description ${id}`,
    purchasable: true,
  };
}

const session: Session = {
  id: 'jest-session',
  siteCode: 'main',
  currency: 'USD',
  customerId: 'ANONYMOUS',
};

const site = {
  code: 'main',
  currencies: [{ id: 'USD' }, { id: 'EUR' }],
} as Site;

function matchedPrice(productId: string): ProductPrice {
  return {
    id: `price-${productId}`,
    productId,
    amount: 10,
    currency: 'USD',
    discountValue: 0,
    discountPercentage: 0,
    totalValue: 10,
    quantity: { quantity: 1 },
    includesTax: false,
    tierValues: [],
  };
}

describe('usePdpPurchaseData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchProductPriceMock.mockImplementation(async (id) => matchedPrice(id));
    fetchProductAvailabilityMock.mockResolvedValue({
      productId: 'p-1',
      availableQuantity: 5,
      availableInDays: null,
      isAvailable: true,
    });
  });

  test('does not re-fetch price when the catalog object is replaced with the same id', async () => {
    const first = catalogProduct('p-1');
    const { rerender } = renderHook(({ product }) => usePdpPurchaseData(product, session, site), {
      initialProps: { product: first },
    });

    await waitFor(() => {
      expect(fetchProductPriceMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchProductPriceMock).toHaveBeenCalledWith('p-1', 1, undefined, 'USD');

    rerender({ product: catalogProduct('p-1') });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchProductPriceMock).toHaveBeenCalledTimes(1);
  });

  test('re-fetches price when product id changes', async () => {
    const { rerender } = renderHook(({ product }) => usePdpPurchaseData(product, session, site), {
      initialProps: { product: catalogProduct('p-1') },
    });

    await waitFor(() => {
      expect(fetchProductPriceMock).toHaveBeenCalledTimes(1);
    });

    rerender({ product: catalogProduct('p-2') });

    await waitFor(() => {
      expect(fetchProductPriceMock).toHaveBeenCalledTimes(2);
    });
    expect(fetchProductPriceMock).toHaveBeenLastCalledWith('p-2', 1, undefined, 'USD');
  });

  test('applies a new embedded purchase price when the same product id is enriched', async () => {
    const { rerender, result } = renderHook(({ product }) => usePdpPurchaseData(product, session, site), {
      initialProps: { product: catalogProduct('p-1') },
    });

    await waitFor(() => {
      expect(fetchProductPriceMock).toHaveBeenCalledTimes(1);
    });
    expect(result.current.price).toEqual(matchedPrice('p-1'));

    const enriched = { ...catalogProduct('p-1'), price: matchedPrice('p-1') };
    rerender({ product: enriched });

    await waitFor(() => {
      expect(result.current.price).toEqual(matchedPrice('p-1'));
    });
    expect(fetchProductPriceMock).toHaveBeenCalledTimes(1);
  });

  test('fetches Price Service when seed contains BI-style snapshot currency/amount only', async () => {
    const snapshotSeed = {
      ...catalogProduct('p-1'),
      price: {
        currency: 'USD',
        amount: 999,
      } as ProductPrice,
    };

    const { result } = renderHook(() => usePdpPurchaseData(snapshotSeed, session, site));

    await waitFor(() => {
      expect(fetchProductPriceMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchProductPriceMock).toHaveBeenCalledWith('p-1', 1, undefined, 'USD');
    expect(result.current.price).toEqual(matchedPrice('p-1'));
  });

  test('re-fetches price with the new quantity when quantity changes', async () => {
    const { rerender } = renderHook(
      ({ quantity }) => usePdpPurchaseData(catalogProduct('p-1'), session, site, quantity),
      { initialProps: { quantity: 1 } },
    );

    await waitFor(() => {
      expect(fetchProductPriceMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchProductPriceMock).toHaveBeenCalledWith('p-1', 1, undefined, 'USD');

    rerender({ quantity: 30 });

    await waitFor(() => {
      expect(fetchProductPriceMock).toHaveBeenCalledTimes(2);
    });
    expect(fetchProductPriceMock).toHaveBeenLastCalledWith('p-1', 30, undefined, 'USD');
  });

  test('does not reuse embedded price when it does not match the current quantity', async () => {
    const qty1Embedded = matchedPrice('p-1');
    const qty30Fetched: ProductPrice = {
      ...matchedPrice('p-1'),
      id: 'price-p-1-qty-30',
      amount: 8,
      totalValue: 8,
      quantity: { quantity: 30 },
    };
    fetchProductPriceMock.mockResolvedValue(qty30Fetched);

    const product = { ...catalogProduct('p-1'), price: qty1Embedded };
    const { result } = renderHook(() => usePdpPurchaseData(product, session, site, 30));

    await waitFor(() => {
      expect(fetchProductPriceMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchProductPriceMock).toHaveBeenCalledWith('p-1', 30, undefined, 'USD');
    expect(result.current.price).toEqual(qty30Fetched);
    expect(result.current.price).not.toEqual(qty1Embedded);
  });
});
