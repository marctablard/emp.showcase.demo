import { act } from '@testing-library/react';
import { createCartStore } from '@/stores/cart-store';

// Mock the API calls
jest.mock('@/lib/client/carts', () => ({
  fetchCurrentCart: jest.fn(),
  addItemToCart: jest.fn(),
  removeCartItem: jest.fn(),
  updateCartItemQuantity: jest.fn(),
  updateShippingInfo: jest.fn(),
  loadSavedCart: jest.fn(),
  clearCartSession: jest.fn(),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: jest.fn(() => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

const mockFetchCurrentCart = require('@/lib/client/carts').fetchCurrentCart;
const mockAddItemToCart = require('@/lib/client/carts').addItemToCart;
const mockClearCartSession = require('@/lib/client/carts').clearCartSession;

describe('CartStore - Site Validation', () => {
  let store: ReturnType<typeof createCartStore>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClearCartSession.mockResolvedValue(undefined);
    store = createCartStore();
  });

  describe('validateSite', () => {
    it('should set lastSiteCode on first call without clearing cart', async () => {
      // Arrange
      const initialCart = {
        id: 'cart-1',
        currency: 'EUR',
        site: 'site-a',
        items: [],
        totalPrice: { amount: 0, currency: 'EUR' },
        subTotalPrice: { amount: 0, currency: 'EUR' },
        tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
      };

      // Set initial cart state
      act(() => {
        store.getState().setCurrentCart(initialCart);
      });

      // Act
      await act(async () => {
        await store.getState().validateSite('site-a');
      });

      // Assert
      expect(store.getState().lastSiteCode).toBe('site-a');
      expect(store.getState().currentCart).toEqual(initialCart);
      expect(mockFetchCurrentCart).not.toHaveBeenCalled();
    });

    it('should clear cart and refetch when site changes', async () => {
      // Arrange
      const initialCart = {
        id: 'cart-1',
        currency: 'EUR',
        site: 'site-a',
        items: [{ id: 'item-1', quantity: 1, price: { amount: 10, currency: 'EUR' } }],
        totalPrice: { amount: 10, currency: 'EUR' },
        subTotalPrice: { amount: 10, currency: 'EUR' },
        tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
      };

      const newSiteCart = {
        id: 'cart-2',
        currency: 'USD',
        site: 'site-b',
        items: [],
        totalPrice: { amount: 0, currency: 'USD' },
        subTotalPrice: { amount: 0, currency: 'USD' },
        tax: { amount: 0, currency: 'USD', netValue: 0, grossValue: 0 },
      };

      mockFetchCurrentCart.mockResolvedValueOnce(newSiteCart);

      // Set initial cart and site
      act(() => {
        store.getState().setCurrentCart(initialCart);
      });

      await act(async () => {
        await store.getState().validateSite('site-a');
      });

      // Act - change site
      await act(async () => {
        await store.getState().validateSite('site-b');
      });

      // Assert
      expect(store.getState().lastSiteCode).toBe('site-b');
      expect(mockFetchCurrentCart).toHaveBeenCalledTimes(1);
      expect(store.getState().currentCart).toEqual(newSiteCart);
    });

    it('should not clear cart when called with same site', async () => {
      // Arrange
      const initialCart = {
        id: 'cart-1',
        currency: 'EUR',
        site: 'site-a',
        items: [{ id: 'item-1', quantity: 1, price: { amount: 10, currency: 'EUR' } }],
        totalPrice: { amount: 10, currency: 'EUR' },
        subTotalPrice: { amount: 10, currency: 'EUR' },
        tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
      };

      // Set initial cart and site
      act(() => {
        store.getState().setCurrentCart(initialCart);
      });

      await act(async () => {
        await store.getState().validateSite('site-a');
      });

      // Act - call with same site again
      await act(async () => {
        await store.getState().validateSite('site-a');
      });

      // Assert
      expect(store.getState().lastSiteCode).toBe('site-a');
      expect(store.getState().currentCart).toEqual(initialCart);
      expect(mockFetchCurrentCart).not.toHaveBeenCalled();
    });

    it('should reset lastSiteCode to null when clearCart is called', async () => {
      // Arrange
      const initialCart = {
        id: 'cart-1',
        currency: 'EUR',
        site: 'site-a',
        items: [],
        totalPrice: { amount: 0, currency: 'EUR' },
        subTotalPrice: { amount: 0, currency: 'EUR' },
        tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
      };

      // Set initial cart and site
      act(() => {
        store.getState().setCurrentCart(initialCart);
      });

      await act(async () => {
        await store.getState().validateSite('site-a');
      });

      expect(store.getState().lastSiteCode).toBe('site-a');

      // Act
      act(() => {
        store.getState().clearCart();
      });

      // Assert
      expect(store.getState().lastSiteCode).toBeNull();
      expect(store.getState().currentCart).toBeNull();
    });

    it('should set lastSiteCode before clearing cart to prevent race conditions', async () => {
      // Arrange
      const initialCart = {
        id: 'cart-1',
        currency: 'EUR',
        site: 'site-a',
        items: [],
        totalPrice: { amount: 0, currency: 'EUR' },
        subTotalPrice: { amount: 0, currency: 'EUR' },
        tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
      };

      // Set initial cart and site
      act(() => {
        store.getState().setCurrentCart(initialCart);
      });

      await act(async () => {
        await store.getState().validateSite('site-a');
      });

      // Create a delayed mock to simulate slow network
      let resolvePromise: (cart: unknown) => void;
      const slowPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetchCurrentCart.mockReturnValueOnce(slowPromise);

      // Act - start site change but don't await
      const validatePromise = store.getState().validateSite('site-b');

      // Assert - lastSiteCode should be updated immediately (before fetch completes)
      expect(store.getState().lastSiteCode).toBe('site-b');
      expect(store.getState().currentCart).toBeNull();
      expect(store.getState().loading).toBe(true);

      // Complete the fetch
      resolvePromise!({
        id: 'cart-2',
        currency: 'USD',
        site: 'site-b',
        items: [],
        totalPrice: { amount: 0, currency: 'USD' },
        subTotalPrice: { amount: 0, currency: 'USD' },
        tax: { amount: 0, currency: 'USD', netValue: 0, grossValue: 0 },
      });

      await act(async () => {
        await validatePromise;
      });

      // Assert final state
      expect(store.getState().lastSiteCode).toBe('site-b');
    });

    it('should handle fetchCart failure during site change gracefully', async () => {
      // Arrange
      const initialCart = {
        id: 'cart-1',
        currency: 'EUR',
        site: 'site-a',
        items: [],
        totalPrice: { amount: 0, currency: 'EUR' },
        subTotalPrice: { amount: 0, currency: 'EUR' },
        tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
      };

      // Set initial cart and site
      act(() => {
        store.getState().setCurrentCart(initialCart);
      });

      await act(async () => {
        await store.getState().validateSite('site-a');
      });

      // Mock fetch to throw error
      mockFetchCurrentCart.mockRejectedValueOnce(new Error('Network error'));

      // Act - change site (fetchCart handles error internally)
      await act(async () => {
        await store.getState().validateSite('site-b');
      });

      // Assert - lastSiteCode should still be updated, cart should be null
      expect(store.getState().lastSiteCode).toBe('site-b');
      expect(store.getState().currentCart).toBeNull();
    });
  });

  describe('validateCart', () => {
    it('should NOT clear cart or fetch on initial mount (null → status)', async () => {
      // On initial mount, sessionStatus goes from null → 'unauthenticated'
      // This is initialization, not an auth transition — should NOT trigger fetch
      const initialCart = {
        id: 'cart-1',
        currency: 'EUR',
        site: 'site-a',
        items: [],
        totalPrice: { amount: 0, currency: 'EUR' },
        subTotalPrice: { amount: 0, currency: 'EUR' },
        tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
      };

      act(() => {
        store.getState().setCurrentCart(initialCart);
      });

      await act(async () => {
        await store.getState().validateCart('unauthenticated');
      });

      // Session status should be updated
      expect(store.getState().sessionStatus).toBe('unauthenticated');
      // But cart should NOT be cleared (initial mount, not auth transition)
      expect(store.getState().currentCart).toEqual(initialCart);
      expect(mockFetchCurrentCart).not.toHaveBeenCalled();
    });

    it('should clear cart and refetch on actual auth transition', async () => {
      const initialCart = {
        id: 'cart-1',
        currency: 'EUR',
        site: 'site-a',
        items: [],
        totalPrice: { amount: 0, currency: 'EUR' },
        subTotalPrice: { amount: 0, currency: 'EUR' },
        tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
      };

      const refreshedCart = {
        id: 'cart-2',
        currency: 'EUR',
        site: 'site-a',
        items: [],
        totalPrice: { amount: 0, currency: 'EUR' },
        subTotalPrice: { amount: 0, currency: 'EUR' },
        tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
      };

      act(() => {
        store.getState().setCurrentCart(initialCart);
      });

      // First call: initial mount (null → 'unauthenticated') — no fetch
      await act(async () => {
        await store.getState().validateCart('unauthenticated');
      });

      expect(mockFetchCurrentCart).not.toHaveBeenCalled();

      // Second call: auth transition ('unauthenticated' → 'authenticated') — should clear & fetch
      let resolvePromise: (cart: unknown) => void;
      const slowPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetchCurrentCart.mockReturnValueOnce(slowPromise);

      const validatePromise = store.getState().validateCart('authenticated');

      expect(store.getState().sessionStatus).toBe('authenticated');
      expect(store.getState().currentCart).toBeNull();
      expect(store.getState().loading).toBe(true);

      resolvePromise!(refreshedCart);

      await act(async () => {
        await validatePromise;
      });

      expect(store.getState().currentCart).toEqual(refreshedCart);
      expect(mockFetchCurrentCart).toHaveBeenCalledTimes(1);
    });

    it('should not refetch when session status is unchanged', async () => {
      // Initialize with a status first (simulating initial mount)
      await act(async () => {
        await store.getState().validateCart('unauthenticated');
      });

      const refreshedCart = {
        id: 'cart-2',
        currency: 'EUR',
        site: 'site-a',
        items: [],
        totalPrice: { amount: 0, currency: 'EUR' },
        subTotalPrice: { amount: 0, currency: 'EUR' },
        tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
      };

      mockFetchCurrentCart.mockResolvedValueOnce(refreshedCart);

      // Actual transition: 'unauthenticated' → 'authenticated'
      await act(async () => {
        await store.getState().validateCart('authenticated');
      });

      expect(mockFetchCurrentCart).toHaveBeenCalledTimes(1);

      // Same status again — should NOT refetch
      await act(async () => {
        await store.getState().validateCart('authenticated');
      });

      expect(mockFetchCurrentCart).toHaveBeenCalledTimes(1);
    });
  });
});

describe('CartStore - Fetch Deduplication', () => {
  let store: ReturnType<typeof createCartStore>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClearCartSession.mockResolvedValue(undefined);
    store = createCartStore();
  });

  it('should deduplicate concurrent fetchCart(false) calls to a single API call', async () => {
    const cartData = {
      id: 'cart-1',
      currency: 'EUR',
      site: 'main',
      items: [],
      totalPrice: { amount: 0, currency: 'EUR' },
      subTotalPrice: { amount: 0, currency: 'EUR' },
      tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
    };

    mockFetchCurrentCart.mockResolvedValueOnce(cartData);

    // Fire 5 concurrent fetchCart(false) calls
    const promises = Array.from({ length: 5 }, () => store.getState().fetchCart(false));

    const results = await Promise.all(promises);

    // All should resolve to the same cart data
    results.forEach((result) => {
      expect(result).toEqual(cartData);
    });

    // API should only be called ONCE
    expect(mockFetchCurrentCart).toHaveBeenCalledTimes(1);
    expect(mockFetchCurrentCart).toHaveBeenCalledWith(false);
  });

  it('should NOT reuse fetchCart(false) promise for fetchCart(true)', async () => {
    const existingCart = {
      id: 'cart-1',
      currency: 'EUR',
      site: 'main',
      items: [],
      totalPrice: { amount: 0, currency: 'EUR' },
      subTotalPrice: { amount: 0, currency: 'EUR' },
      tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
    };

    const createdCart = {
      id: 'cart-2',
      currency: 'EUR',
      site: 'main',
      items: [],
      totalPrice: { amount: 0, currency: 'EUR' },
      subTotalPrice: { amount: 0, currency: 'EUR' },
      tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
    };

    // First call: create=false (slow)
    let resolveFirst: (value: unknown) => void;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    mockFetchCurrentCart.mockReturnValueOnce(firstPromise);
    mockFetchCurrentCart.mockResolvedValueOnce(createdCart);

    // Start fetchCart(false)
    const fetchFalsePromise = store.getState().fetchCart(false);

    // While first is in-flight, call fetchCart(true)
    const fetchTruePromise = store.getState().fetchCart(true);

    // Both should produce separate API calls
    expect(mockFetchCurrentCart).toHaveBeenCalledTimes(2);
    expect(mockFetchCurrentCart).toHaveBeenNthCalledWith(1, false);
    expect(mockFetchCurrentCart).toHaveBeenNthCalledWith(2, true);

    // Resolve first call
    resolveFirst!(existingCart);

    await act(async () => {
      await Promise.all([fetchFalsePromise, fetchTruePromise]);
    });
  });

  it('should allow fresh fetch after previous one completes', async () => {
    const cart1 = {
      id: 'cart-1',
      currency: 'EUR',
      site: 'main',
      items: [],
      totalPrice: { amount: 0, currency: 'EUR' },
      subTotalPrice: { amount: 0, currency: 'EUR' },
      tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
    };

    const cart2 = {
      id: 'cart-2',
      currency: 'EUR',
      site: 'main',
      items: [{ id: 'item-1', quantity: 1, price: { amount: 10, currency: 'EUR' } }],
      totalPrice: { amount: 10, currency: 'EUR' },
      subTotalPrice: { amount: 10, currency: 'EUR' },
      tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
    };

    mockFetchCurrentCart.mockResolvedValueOnce(cart1);
    mockFetchCurrentCart.mockResolvedValueOnce(cart2);

    // First fetch
    await act(async () => {
      await store.getState().fetchCart(false);
    });

    expect(mockFetchCurrentCart).toHaveBeenCalledTimes(1);
    expect(store.getState().currentCart).toEqual(cart1);

    // Second fetch (after first completed) — should start a new API call
    await act(async () => {
      await store.getState().fetchCart(false);
    });

    expect(mockFetchCurrentCart).toHaveBeenCalledTimes(2);
    expect(store.getState().currentCart).toEqual(cart2);
  });

  it('should deduplicate fetchCart(true) calls from concurrent addToCart-like scenarios', async () => {
    const cartData = {
      id: 'cart-new',
      currency: 'EUR',
      site: 'main',
      items: [],
      totalPrice: { amount: 0, currency: 'EUR' },
      subTotalPrice: { amount: 0, currency: 'EUR' },
      tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
    };

    mockFetchCurrentCart.mockResolvedValueOnce(cartData);

    // Multiple concurrent fetchCart(true) calls
    const promises = Array.from({ length: 3 }, () => store.getState().fetchCart(true));

    const results = await Promise.all(promises);

    results.forEach((result) => {
      expect(result).toEqual(cartData);
    });

    // Only one API call
    expect(mockFetchCurrentCart).toHaveBeenCalledTimes(1);
    expect(mockFetchCurrentCart).toHaveBeenCalledWith(true);
  });

  it('should reuse fetchCart(true) promise for fetchCart(false)', async () => {
    // If create=true is in-flight, a create=false call can reuse it
    // (create=true is a superset of create=false behavior)
    const cartData = {
      id: 'cart-new',
      currency: 'EUR',
      site: 'main',
      items: [],
      totalPrice: { amount: 0, currency: 'EUR' },
      subTotalPrice: { amount: 0, currency: 'EUR' },
      tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
    };

    let resolvePromise: (value: unknown) => void;
    const slowPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockFetchCurrentCart.mockReturnValueOnce(slowPromise);

    // Start fetchCart(true)
    const fetchTruePromise = store.getState().fetchCart(true);

    // While in-flight, call fetchCart(false) — should reuse
    const fetchFalsePromise = store.getState().fetchCart(false);

    // Only one API call
    expect(mockFetchCurrentCart).toHaveBeenCalledTimes(1);

    resolvePromise!(cartData);

    const [resultTrue, resultFalse] = await Promise.all([fetchTruePromise, fetchFalsePromise]);

    expect(resultTrue).toEqual(cartData);
    expect(resultFalse).toEqual(cartData);
  });

  it('should propagate null to all callers when shared fetch returns error', async () => {
    // When the API call fails, all callers sharing the promise should get null
    mockFetchCurrentCart.mockRejectedValueOnce(new Error('Network error'));

    const promises = Array.from({ length: 3 }, () => store.getState().fetchCart(false));

    const results = await Promise.all(promises);

    // All should resolve to null (error is caught internally)
    results.forEach((result) => {
      expect(result).toBeNull();
    });

    // Only one API call
    expect(mockFetchCurrentCart).toHaveBeenCalledTimes(1);
    expect(store.getState().currentCart).toBeNull();
  });

  it('should create the next cart through fetchCart(true) after clear and use the returned currency', async () => {
    const clearedStore = createCartStore({
      currentCart: {
        id: 'old-cart',
        currency: 'EUR',
        site: 'main',
        items: [],
        totalPrice: { amount: 0, currency: 'EUR' },
        subTotalPrice: { amount: 0, currency: 'EUR' },
        tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
      },
      loading: false,
      error: null,
      lastShippingUpdate: null,
      sessionStatus: null,
      lastSiteCode: 'main',
      lastLegalEntityId: null,
      pendingCurrencySync: null,
    });
    const createdCart = {
      id: 'cart-usd',
      currency: 'USD',
      site: 'main',
      items: [],
      totalPrice: { amount: 0, currency: 'USD' },
      subTotalPrice: { amount: 0, currency: 'USD' },
      tax: { amount: 0, currency: 'USD', netValue: 0, grossValue: 0 },
    };
    const updatedCart = {
      ...createdCart,
      items: [{ id: 'item-1', quantity: 1, price: { amount: 10, currency: 'USD' } }],
      totalPrice: { amount: 10, currency: 'USD' },
      subTotalPrice: { amount: 10, currency: 'USD' },
    };

    clearedStore.getState().clearCart({ clearSession: false });
    mockFetchCurrentCart.mockResolvedValueOnce(createdCart);
    mockAddItemToCart.mockResolvedValueOnce({ cart: updatedCart });

    await act(async () => {
      await clearedStore.getState().addToCart('product-1', 1);
    });

    expect(mockFetchCurrentCart).toHaveBeenCalledWith(true);
    expect(mockAddItemToCart).toHaveBeenCalledWith('cart-usd', 'product-1', 1);
    expect(clearedStore.getState().currentCart?.currency).toBe('USD');
  });
});
