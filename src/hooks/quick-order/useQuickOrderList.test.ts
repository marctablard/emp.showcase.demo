import { act, renderHook, waitFor } from '@testing-library/react';
import type { Product } from '@/platform/services/model/product';
import { useQuickOrderList } from './useQuickOrderList';

jest.mock('@/providers/StoreProvider', () => ({
  useSessionStore: () => ({
    session: { currency: 'EUR' },
  }),
}));

jest.mock('@/lib/client/prices', () => ({
  fetchProductPrices: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

function makeProduct(id: string, priceAmount: number, priceCurrency = 'EUR', includeTax = true): Product {
  return {
    id,
    name: `Product ${id}`,
    description: '',
    purchasable: true,
    price: {
      amount: priceAmount,
      currency: priceCurrency,
      tax: includeTax
        ? {
            netValue: priceAmount,
            grossValue: priceAmount,
            taxRate: 0,
          }
        : undefined,
    },
  } as Product;
}

describe('useQuickOrderList', () => {
  it('has empty initial state', () => {
    const { result } = renderHook(() => useQuickOrderList());
    expect(result.current.items).toEqual([]);
    expect(result.current.netSubtotal).toBe(0);
    expect(result.current.grossSubtotal).toBe(0);
    expect(result.current.vatTotal).toBe(0);
    expect(result.current.itemCount).toBe(0);
  });

  it('addProducts adds new items', () => {
    const { result } = renderHook(() => useQuickOrderList());

    act(() => {
      result.current.addProducts([
        { product: makeProduct('p1', 10), quantity: 2 },
        { product: makeProduct('p2', 20), quantity: 1 },
      ]);
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].product.id).toBe('p1');
    expect(result.current.items[0].quantity).toBe(2);
    expect(result.current.items[1].product.id).toBe('p2');
    expect(result.current.items[1].quantity).toBe(1);
  });

  it('addProducts merges quantity when same product ID already exists', () => {
    const { result } = renderHook(() => useQuickOrderList());

    act(() => {
      result.current.addProducts([{ product: makeProduct('p1', 10), quantity: 2 }]);
    });

    act(() => {
      result.current.addProducts([{ product: makeProduct('p1', 10), quantity: 3 }]);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(5);
  });

  it('removeProduct removes item by ID', () => {
    const { result } = renderHook(() => useQuickOrderList());

    act(() => {
      result.current.addProducts([
        { product: makeProduct('p1', 10), quantity: 1 },
        { product: makeProduct('p2', 20), quantity: 1 },
      ]);
    });

    act(() => {
      result.current.removeProduct('p1');
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].product.id).toBe('p2');
  });

  it('updateQuantity changes quantity for given product', () => {
    const { result } = renderHook(() => useQuickOrderList());

    act(() => {
      result.current.addProducts([{ product: makeProduct('p1', 10), quantity: 1 }]);
    });

    act(() => {
      result.current.updateQuantity('p1', 5);
    });

    expect(result.current.items[0].quantity).toBe(5);
  });

  it('updateQuantity enforces minimum of 1', () => {
    const { result } = renderHook(() => useQuickOrderList());

    act(() => {
      result.current.addProducts([{ product: makeProduct('p1', 10), quantity: 3 }]);
    });

    act(() => {
      result.current.updateQuantity('p1', 0);
    });

    expect(result.current.items[0].quantity).toBe(1);

    act(() => {
      result.current.updateQuantity('p1', -5);
    });

    expect(result.current.items[0].quantity).toBe(1);
  });

  it('clearAll resets to empty', () => {
    const { result } = renderHook(() => useQuickOrderList());

    act(() => {
      result.current.addProducts([
        { product: makeProduct('p1', 10), quantity: 2 },
        { product: makeProduct('p2', 20), quantity: 3 },
      ]);
    });

    expect(result.current.items).toHaveLength(2);

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.netSubtotal).toBe(0);
    expect(result.current.grossSubtotal).toBe(0);
    expect(result.current.vatTotal).toBe(0);
    expect(result.current.itemCount).toBe(0);
  });

  it('netSubtotal and grossSubtotal fall back to amount when no tax data', () => {
    const { result } = renderHook(() => useQuickOrderList());

    act(() => {
      result.current.addProducts([
        { product: makeProduct('p1', 10), quantity: 2 },
        { product: makeProduct('p2', 25.5), quantity: 3 },
      ]);
    });

    // Without tax data, both subtotals use amount: 10*2 + 25.5*3 = 96.5
    expect(result.current.netSubtotal).toBe(96.5);
    expect(result.current.grossSubtotal).toBe(96.5);
    expect(result.current.vatTotal).toBe(0);
  });

  it('enriches prices from match-prices API and computes vatTotal', async () => {
    const { fetchProductPrices } = require('@/lib/client/prices');
    fetchProductPrices.mockResolvedValueOnce({
      p1: { amount: 11.9, currency: 'EUR', tax: { netValue: 10, grossValue: 11.9, taxRate: 19 } },
    });

    const { result } = renderHook(() => useQuickOrderList());

    act(() => {
      result.current.addProducts([{ product: makeProduct('p1', 11.9, 'EUR', false), quantity: 2 }]);
    });

    await waitFor(() => {
      expect(result.current.items[0].product.price?.tax?.netValue).toBe(10);
    });

    expect(result.current.netSubtotal).toBe(20);
    expect(result.current.grossSubtotal).toBe(23.8);
    // VAT = gross - net = 23.8 - 20 = 3.8
    expect(result.current.vatTotal).toBeCloseTo(3.8);
  });

  it('itemCount returns total number of distinct items', () => {
    const { result } = renderHook(() => useQuickOrderList());

    act(() => {
      result.current.addProducts([
        { product: makeProduct('p1', 10), quantity: 5 },
        { product: makeProduct('p2', 20), quantity: 10 },
        { product: makeProduct('p3', 30), quantity: 1 },
      ]);
    });

    expect(result.current.itemCount).toBe(3);
  });

  it('currency comes from session', () => {
    const { result } = renderHook(() => useQuickOrderList());
    expect(result.current.currency).toBe('EUR');
  });
});
