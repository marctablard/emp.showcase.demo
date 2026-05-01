import { act } from '@testing-library/react';
import type { Cart } from '@/platform/services/model/cart/cart';
import { createCartStore } from '@/stores/cart-store';

function fcResult(cart: Cart | null): { cart: Cart | null; sessionSiteCode: string | null } {
  if (!cart) return { cart: null, sessionSiteCode: null };
  return { cart, sessionSiteCode: cart.site ?? null };
}

jest.mock('@/lib/client/carts', () => ({
  fetchCurrentCart: jest.fn(),
  createCart: jest.fn(),
  addItemToCart: jest.fn(),
  removeCartItem: jest.fn(),
  updateCartItemQuantity: jest.fn(),
  updateCartCurrency: jest.fn(),
  updateShippingInfo: jest.fn(),
  loadSavedCart: jest.fn(),
  clearCartSession: jest.fn(),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

const mockFetchCurrentCart = require('@/lib/client/carts').fetchCurrentCart;
const mockCreateCart = require('@/lib/client/carts').createCart;
const mockAddItemToCart = require('@/lib/client/carts').addItemToCart;
const mockClearCartSession = require('@/lib/client/carts').clearCartSession;
const mockUpdateCartCurrency = require('@/lib/client/carts').updateCartCurrency;

describe('CartStore - Site Validation', () => {
  let store: ReturnType<typeof createCartStore>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClearCartSession.mockResolvedValue(undefined);
    store = createCartStore();
  });

  describe('validateSite', () => {
    it('should snap lastSiteCode, clear cart, and refetch on initial bind from null', async () => {
      const initialCart = {
        id: 'cart-1',
        currency: 'EUR',
        site: 'site-a',
        items: [],
        totalPrice: { amount: 0, currency: 'EUR' },
        subTotalPrice: { amount: 0, currency: 'EUR' },
        tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
      };

      const refetchedCart = {
        id: 'cart-refreshed',
        currency: 'EUR',
        site: 'site-a',
        items: [],
        totalPrice: { amount: 0, currency: 'EUR' },
        subTotalPrice: { amount: 0, currency: 'EUR' },
        tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
      };

      mockFetchCurrentCart.mockResolvedValueOnce(fcResult(refetchedCart as Cart));

      act(() => {
        store.getState().setCurrentCart(initialCart);
      });

      await act(async () => {
        await store.getState().validateSite('site-a');
      });

      // With the simplified validateSite, any null→siteCode transition is
      // treated as a site change: snap lastSiteCode, clear, refetch.
      expect(store.getState().lastSiteCode).toBe('site-a');
      expect(mockFetchCurrentCart).toHaveBeenCalledTimes(1);
      expect(store.getState().currentCart).toEqual(refetchedCart);
    });

    it('should snap lastSiteCode early, clear cart, and refetch when site changes', async () => {
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

      // Initial bind triggers one refetch; then the transition to site-b triggers another.
      mockFetchCurrentCart.mockResolvedValueOnce(fcResult(initialCart as Cart));
      mockFetchCurrentCart.mockResolvedValueOnce(fcResult(newSiteCart as Cart));

      act(() => {
        store.getState().setCurrentCart(initialCart);
      });

      await act(async () => {
        await store.getState().validateSite('site-a');
      });

      await act(async () => {
        await store.getState().validateSite('site-b');
      });

      expect(store.getState().lastSiteCode).toBe('site-b');
      expect(mockFetchCurrentCart).toHaveBeenCalledTimes(2);
      expect(store.getState().currentCart).toEqual(newSiteCart);
    });

    it('should not clear cart when called with same site', async () => {
      const initialCart = {
        id: 'cart-1',
        currency: 'EUR',
        site: 'site-a',
        items: [{ id: 'item-1', quantity: 1, price: { amount: 10, currency: 'EUR' } }],
        totalPrice: { amount: 10, currency: 'EUR' },
        subTotalPrice: { amount: 10, currency: 'EUR' },
        tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
      };

      // Seed lastSiteCode directly so the first validateSite('site-a') is the no-op path.
      act(() => {
        store.setState({ lastSiteCode: 'site-a', currentCart: initialCart });
      });

      await act(async () => {
        await store.getState().validateSite('site-a');
      });

      expect(store.getState().lastSiteCode).toBe('site-a');
      expect(store.getState().currentCart).toEqual(initialCart);
      expect(mockFetchCurrentCart).not.toHaveBeenCalled();
    });

    it('should reset lastSiteCode to null when clearCart is called', async () => {
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
        await store.getState().validateSite('site-a');
      });

      expect(store.getState().lastSiteCode).toBe('site-a');

      act(() => {
        store.getState().clearCart();
      });

      expect(store.getState().lastSiteCode).toBeNull();
      expect(store.getState().currentCart).toBeNull();
    });

    it('snaps lastSiteCode to the new site synchronously before fetchCart resolves', async () => {
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
        await store.getState().validateSite('site-a');
      });

      let resolvePromise: (cart: unknown) => void;
      const slowPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetchCurrentCart.mockReturnValueOnce(slowPromise);

      const validatePromise = store.getState().validateSite('site-b');

      // validateSite snaps lastSiteCode synchronously — the orchestrator awaits the session
      // update, so there's no stale window for a prior-site response to masquerade.
      expect(store.getState().lastSiteCode).toBe('site-b');
      expect(store.getState().currentCart).toBeNull();
      expect(store.getState().loading).toBe(true);

      resolvePromise!(
        fcResult({
          id: 'cart-2',
          currency: 'USD',
          site: 'site-b',
          items: [],
          totalPrice: { amount: 0, currency: 'USD' },
          subTotalPrice: { amount: 0, currency: 'USD' },
          tax: { amount: 0, currency: 'USD', netValue: 0, grossValue: 0 },
        } as Cart),
      );

      await act(async () => {
        await validatePromise;
      });

      expect(store.getState().lastSiteCode).toBe('site-b');
    });

    it('invalidates the in-flight _fetchPromise dedupe when called during a pending fetchCart so the target site gets a fresh GET', async () => {
      // Regression for Copilot review https://github.com/emporix/emporix-showcase/pull/283#discussion_r3128797246.
      // The closure-level `_fetchPromise` in `createCartStore` dedupes concurrent `fetchCart`
      // calls. If `validateSite` did not clear it, a new `fetchCart` triggered for the target
      // site would short-circuit on the previous-site promise and a stale cart response could
      // overwrite the reset state. This test pins down that `validateSite` resets the dedupe
      // and issues a second, independent HTTP call.
      act(() => {
        store.setState({ lastSiteCode: 'site-a' });
      });

      let resolveFirst!: (value: { cart: Cart | null; sessionSiteCode: string | null }) => void;
      let resolveSecond!: (value: { cart: Cart | null; sessionSiteCode: string | null }) => void;
      const firstPromise = new Promise<{ cart: Cart | null; sessionSiteCode: string | null }>((resolve) => {
        resolveFirst = resolve;
      });
      const secondPromise = new Promise<{ cart: Cart | null; sessionSiteCode: string | null }>((resolve) => {
        resolveSecond = resolve;
      });

      mockFetchCurrentCart.mockReturnValueOnce(firstPromise).mockReturnValueOnce(secondPromise);

      // In-flight fetchCart for site-a installs `_fetchPromise` inside the store closure.
      const inFlight = store.getState().fetchCart();
      expect(mockFetchCurrentCart).toHaveBeenCalledTimes(1);

      // Kick off validateSite for site-b while the previous-site GET is still pending. The
      // bug signature: without `_fetchPromise = null` inside validateSite, a subsequent
      // `fetchCart` would return the in-flight promise and NOT issue a new HTTP request.
      const validatePromise = store.getState().validateSite('site-b');

      // Flush enough microtasks for validateSite to reach its internal `await get().fetchCart()`.
      for (let i = 0; i < 5; i += 1) {
        await Promise.resolve();
      }

      expect(mockFetchCurrentCart).toHaveBeenCalledTimes(2);

      // Resolve both fetches; both should complete cleanly. The site-a response is dropped
      // by fetchCart's dedupe ownership check, and the site-b response is installed.
      resolveFirst({
        cart: {
          id: 'cart-a',
          currency: 'EUR',
          site: 'site-a',
          items: [],
          totalPrice: { amount: 0, currency: 'EUR' },
          subTotalPrice: { amount: 0, currency: 'EUR' },
          tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
        } as Cart,
        sessionSiteCode: 'site-a',
      });
      resolveSecond({
        cart: {
          id: 'cart-b',
          currency: 'EUR',
          site: 'site-b',
          items: [],
          totalPrice: { amount: 0, currency: 'EUR' },
          subTotalPrice: { amount: 0, currency: 'EUR' },
          tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
        } as Cart,
        sessionSiteCode: 'site-b',
      });

      await act(async () => {
        await inFlight;
        await validatePromise;
      });

      expect(store.getState().lastSiteCode).toBe('site-b');
    });

    it('should handle fetchCart failure during site change gracefully — lastSiteCode stays snapped to new site', async () => {
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
        await store.getState().validateSite('site-a');
      });

      mockFetchCurrentCart.mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        await store.getState().validateSite('site-b');
      });

      // New behavior: lastSiteCode is snapped eagerly so subsequent requests are aligned to the
      // target site even when the network call fails. The cart is cleared to null (no stale cart
      // from site-a survives the switch).
      expect(store.getState().lastSiteCode).toBe('site-b');
      expect(store.getState().currentCart).toBeNull();
    });

    it('does not clear lastSiteCode or refetch when newSiteCode is falsy', async () => {
      act(() => {
        store.setState({ lastSiteCode: 'site-a' });
      });
      await act(async () => {
        await store.getState().validateSite('');
      });
      expect(store.getState().lastSiteCode).toBe('site-a');
      expect(mockFetchCurrentCart).not.toHaveBeenCalled();
    });

    it('after validateSite(B), a fetchCart returning a cart for site B does not mutate lastSiteCode', async () => {
      const cartB = {
        id: 'cart-b',
        currency: 'USD',
        site: 'site-b',
        items: [],
        totalPrice: { amount: 0, currency: 'USD' },
        subTotalPrice: { amount: 0, currency: 'USD' },
        tax: { amount: 0, currency: 'USD', netValue: 0, grossValue: 0 },
      };

      act(() => {
        store.setState({ lastSiteCode: 'site-a' });
      });

      mockFetchCurrentCart.mockResolvedValueOnce(fcResult(cartB as Cart));
      await act(async () => {
        await store.getState().validateSite('site-b');
      });

      expect(store.getState().lastSiteCode).toBe('site-b');
      expect(store.getState().currentCart).toEqual(cartB);
    });

    it('after validateSite(B), a fetchCart returning a cart for site A is discarded', async () => {
      const cartFromStaleSite = {
        id: 'cart-a-stale',
        currency: 'EUR',
        site: 'site-a',
        items: [],
        totalPrice: { amount: 0, currency: 'EUR' },
        subTotalPrice: { amount: 0, currency: 'EUR' },
        tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
      };

      act(() => {
        store.setState({ lastSiteCode: 'site-a' });
      });

      mockFetchCurrentCart.mockResolvedValueOnce({ cart: cartFromStaleSite as Cart, sessionSiteCode: 'site-b' });
      await act(async () => {
        await store.getState().validateSite('site-b');
      });

      expect(store.getState().lastSiteCode).toBe('site-b');
      expect(store.getState().currentCart).toBeNull();
    });
  });

  describe('validateCart', () => {
    it('should NOT clear cart or fetch on initial mount (null → status)', async () => {
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

      expect(store.getState().sessionStatus).toBe('unauthenticated');
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

      await act(async () => {
        await store.getState().validateCart('unauthenticated');
      });

      expect(mockFetchCurrentCart).not.toHaveBeenCalled();

      let resolvePromise: (cart: unknown) => void;
      const slowPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetchCurrentCart.mockReturnValueOnce(slowPromise);

      const validatePromise = store.getState().validateCart('authenticated');

      expect(store.getState().sessionStatus).toBe('authenticated');
      expect(store.getState().currentCart).toBeNull();
      expect(store.getState().loading).toBe(true);

      resolvePromise!(fcResult(refreshedCart as Cart));

      await act(async () => {
        await validatePromise;
      });

      expect(store.getState().currentCart).toEqual(refreshedCart);
      expect(mockFetchCurrentCart).toHaveBeenCalledTimes(1);
    });

    it('should not refetch when session status is unchanged', async () => {
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

      mockFetchCurrentCart.mockResolvedValueOnce(fcResult(refreshedCart as Cart));

      await act(async () => {
        await store.getState().validateCart('authenticated');
      });

      expect(mockFetchCurrentCart).toHaveBeenCalledTimes(1);

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

  it('should deduplicate concurrent fetchCart calls to a single API call', async () => {
    const cartData = {
      id: 'cart-1',
      currency: 'EUR',
      site: 'main',
      items: [],
      totalPrice: { amount: 0, currency: 'EUR' },
      subTotalPrice: { amount: 0, currency: 'EUR' },
      tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
    };

    mockFetchCurrentCart.mockResolvedValueOnce(fcResult(cartData as Cart));

    const promises = Array.from({ length: 5 }, () => store.getState().fetchCart());

    const results = await Promise.all(promises);

    results.forEach((result) => {
      expect(result).toEqual(cartData);
    });

    expect(mockFetchCurrentCart).toHaveBeenCalledTimes(1);
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

    mockFetchCurrentCart.mockResolvedValueOnce(fcResult(cart1 as Cart));
    mockFetchCurrentCart.mockResolvedValueOnce(fcResult(cart2 as Cart));

    await act(async () => {
      await store.getState().fetchCart();
    });

    expect(mockFetchCurrentCart).toHaveBeenCalledTimes(1);
    expect(store.getState().currentCart).toEqual(cart1);

    await act(async () => {
      await store.getState().fetchCart();
    });

    expect(mockFetchCurrentCart).toHaveBeenCalledTimes(2);
    expect(store.getState().currentCart).toEqual(cart2);
  });

  it('should propagate null to all callers when shared fetch returns error', async () => {
    mockFetchCurrentCart.mockRejectedValueOnce(new Error('Network error'));

    const promises = Array.from({ length: 3 }, () => store.getState().fetchCart());

    const results = await Promise.all(promises);

    results.forEach((result) => {
      expect(result).toBeNull();
    });

    expect(mockFetchCurrentCart).toHaveBeenCalledTimes(1);
    expect(store.getState().currentCart).toBeNull();
  });

  it('addToCart on empty cart issues exactly one POST /api/cart (createCart) and one add-item call', async () => {
    const clearedStore = createCartStore({
      currentCart: null,
      loading: false,
      error: null,
      lastShippingUpdate: null,
      sessionStatus: null,
      lastSiteCode: 'main',
      lastLegalEntityId: null,
      pendingCurrencySync: null,
      isSettling: false,
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

    mockCreateCart.mockResolvedValueOnce(createdCart);
    mockAddItemToCart.mockResolvedValueOnce({ cart: updatedCart });

    await act(async () => {
      await clearedStore.getState().addToCart('product-1', 1);
    });

    expect(mockCreateCart).toHaveBeenCalledTimes(1);
    expect(mockCreateCart).toHaveBeenCalledWith({ siteCode: 'main' });
    expect(mockAddItemToCart).toHaveBeenCalledTimes(1);
    expect(mockAddItemToCart).toHaveBeenCalledWith('cart-usd', 'product-1', 1);
    expect(mockFetchCurrentCart).not.toHaveBeenCalled();
    expect(clearedStore.getState().currentCart?.currency).toBe('USD');
  });

  it('addToCart with existing aligned cart does not create a new cart', async () => {
    const existingCart = {
      id: 'cart-existing',
      currency: 'EUR',
      site: 'main',
      items: [],
      totalPrice: { amount: 0, currency: 'EUR' },
      subTotalPrice: { amount: 0, currency: 'EUR' },
      tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
    };
    const existingStore = createCartStore({
      currentCart: existingCart as Cart,
      loading: false,
      error: null,
      lastShippingUpdate: null,
      sessionStatus: null,
      lastSiteCode: 'main',
      lastLegalEntityId: null,
      pendingCurrencySync: null,
      isSettling: false,
    });
    const updatedCart = {
      ...existingCart,
      items: [{ id: 'item-1', quantity: 1, price: { amount: 10, currency: 'EUR' } }],
    };
    mockAddItemToCart.mockResolvedValueOnce({ cart: updatedCart });

    await act(async () => {
      await existingStore.getState().addToCart('product-1', 1);
    });

    expect(mockCreateCart).not.toHaveBeenCalled();
    expect(mockAddItemToCart).toHaveBeenCalledWith('cart-existing', 'product-1', 1);
  });
});

describe('CartStore - fetchCart loading gap with pendingCurrencySync', () => {
  let store: ReturnType<typeof createCartStore>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClearCartSession.mockResolvedValue(undefined);
    store = createCartStore();
  });

  it('should set loading=false after fetchCart even with pendingCurrencySync and flush the pending sync', async () => {
    const cart = {
      id: 'cart-1',
      currency: 'EUR',
      site: 'main',
      items: [],
    } as unknown as Cart;

    const cartAfterCurrencySync = {
      ...cart,
      currency: 'USD',
    } as unknown as Cart;

    store.setState({
      lastSiteCode: 'main',
      pendingCurrencySync: { currency: 'USD', siteCode: 'main', attempts: 1 },
    });

    mockFetchCurrentCart.mockResolvedValueOnce(fcResult(cart));
    mockUpdateCartCurrency.mockResolvedValueOnce(undefined);
    mockFetchCurrentCart.mockResolvedValueOnce(fcResult(cartAfterCurrencySync));

    await act(async () => {
      await store.getState().fetchCart();
    });

    expect(store.getState().loading).toBe(false);
    expect(store.getState().currentCart?.currency).toBe('USD');
    expect(store.getState().pendingCurrencySync).toBeNull();
  });

  it('should set loading=false after fetchCart when no pendingCurrencySync', async () => {
    const cart = {
      id: 'cart-1',
      currency: 'EUR',
      site: 'main',
      items: [],
    } as unknown as Cart;

    store.setState({ lastSiteCode: 'main', pendingCurrencySync: null });

    mockFetchCurrentCart.mockResolvedValueOnce(fcResult(cart));

    await act(async () => {
      await store.getState().fetchCart();
    });

    expect(store.getState().loading).toBe(false);
    expect(store.getState().currentCart).toEqual(cart);
  });
});
