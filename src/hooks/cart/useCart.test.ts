import { act, waitFor } from '@testing-library/react';
import type { Cart } from '@/platform/services/model/cart/cart';
import { CartMutationCancelledError, createCartStore } from '@/stores/cart-store';

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
  updateShippingMethod: jest.fn(),
  applyCartDiscount: jest.fn(),
  removeCartDiscount: jest.fn(),
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
const mockUpdateShippingInfo = require('@/lib/client/carts').updateShippingInfo;
const mockApplyCartDiscount = require('@/lib/client/carts').applyCartDiscount;
const mockUpdateCartItemQuantity = require('@/lib/client/carts').updateCartItemQuantity;
const mockRemoveCartItem = require('@/lib/client/carts').removeCartItem;
const mockRemoveCartDiscount = require('@/lib/client/carts').removeCartDiscount;

/** Manually settled promise so a test can hold an API call in flight. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

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
      mutating: false,
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
      mutating: false,
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

describe('CartStore - shipping destination debounce', () => {
  const shipping = { country: 'CH', zipCode: '6300', city: 'Zug', street: 'Bahnstrasse' };

  const buildCart = (id: string): Cart =>
    ({
      id,
      currency: 'CHF',
      site: 'main',
      items: [{ id: 'item-1', quantity: 1, price: { amount: 10, currency: 'CHF' } }],
      totalPrice: { amount: 10, currency: 'CHF' },
      subTotalPrice: { amount: 10, currency: 'CHF' },
      tax: { amount: 0, currency: 'CHF', netValue: 0, grossValue: 0 },
    }) as Cart;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateShippingInfo.mockResolvedValue(undefined);
    mockFetchCurrentCart.mockResolvedValue(fcResult(buildCart('cart-1')));
  });

  it('still PATCHes the same country+zip when the cart id changed', async () => {
    const store = createCartStore({
      currentCart: buildCart('cart-1'),
      loading: false,
      error: null,
      lastShippingUpdate: null,
      sessionStatus: null,
      lastSiteCode: 'main',
      lastLegalEntityId: null,
      pendingCurrencySync: null,
      isSettling: false,
      mutating: false,
    });

    await act(async () => {
      await store.getState().updateShippingInfo(shipping);
    });

    act(() => {
      store.getState().setCurrentCart(buildCart('cart-2'));
    });
    mockFetchCurrentCart.mockResolvedValue(fcResult(buildCart('cart-2')));

    await act(async () => {
      await store.getState().updateShippingInfo(shipping);
    });

    expect(mockUpdateShippingInfo).toHaveBeenCalledTimes(2);
    expect(mockUpdateShippingInfo).toHaveBeenLastCalledWith('cart-2', shipping, undefined);
  });

  it('skips a repeat PATCH on the same cart within the debounce window', async () => {
    const store = createCartStore({
      currentCart: buildCart('cart-1'),
      loading: false,
      error: null,
      lastShippingUpdate: null,
      sessionStatus: null,
      lastSiteCode: 'main',
      lastLegalEntityId: null,
      pendingCurrencySync: null,
      isSettling: false,
      mutating: false,
    });

    await act(async () => {
      await store.getState().updateShippingInfo(shipping);
      await store.getState().updateShippingInfo(shipping);
    });

    expect(mockUpdateShippingInfo).toHaveBeenCalledTimes(1);
    expect(mockUpdateShippingInfo).toHaveBeenCalledWith('cart-1', shipping, undefined);
  });

  it('skips a repeat PATCH after fetchCart resolves the same cart id', async () => {
    const store = createCartStore({
      currentCart: buildCart('cart-1'),
      loading: false,
      error: null,
      lastShippingUpdate: null,
      sessionStatus: null,
      lastSiteCode: 'main',
      lastLegalEntityId: null,
      pendingCurrencySync: null,
      isSettling: false,
      mutating: false,
    });

    await act(async () => {
      await store.getState().updateShippingInfo(shipping);
    });

    act(() => {
      store.getState().setCurrentCart(null);
    });
    mockFetchCurrentCart.mockResolvedValue(fcResult(buildCart('cart-1')));

    await act(async () => {
      await store.getState().updateShippingInfo(shipping);
    });

    expect(mockUpdateShippingInfo).toHaveBeenCalledTimes(1);
  });
});

describe('CartStore - mutation gate, reset epoch and deferred currency flush', () => {
  const buildCart = (id: string, overrides: Partial<Cart> = {}): Cart =>
    ({
      id,
      currency: 'EUR',
      site: 'main',
      items: [],
      ...overrides,
    }) as unknown as Cart;

  const seedStore = (cart: Cart | null) =>
    createCartStore({
      currentCart: cart,
      loading: false,
      error: null,
      lastShippingUpdate: null,
      sessionStatus: 'authenticated',
      lastSiteCode: 'main',
      lastLegalEntityId: null,
      pendingCurrencySync: null,
      isSettling: false,
      mutating: false,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockClearCartSession.mockResolvedValue(undefined);
  });

  it('serializes cart writes so the second API call starts only after the first has settled', async () => {
    const store = seedStore(buildCart('cart-1'));
    const first = deferred<Cart>();
    mockApplyCartDiscount.mockReturnValueOnce(first.promise);
    mockApplyCartDiscount.mockResolvedValueOnce(buildCart('cart-1', { currency: 'USD' }));

    const firstApply = store.getState().applyDiscount('FIRST');
    const secondApply = store.getState().applyDiscount('SECOND');
    await flushMicrotasks();

    expect(mockApplyCartDiscount).toHaveBeenCalledTimes(1);

    first.resolve(buildCart('cart-1', { currency: 'CHF' }));
    await act(async () => {
      await Promise.all([firstApply, secondApply]);
    });

    expect(mockApplyCartDiscount).toHaveBeenCalledTimes(2);
    expect(mockApplyCartDiscount.mock.calls[1]).toEqual(['cart-1', 'SECOND']);
    // The later response wins — the slower first response cannot overwrite it.
    expect(store.getState().currentCart?.currency).toBe('USD');
  });

  it('drops a discount snapshot that resolves after clearCart() so the cleared cart is not resurrected', async () => {
    const store = seedStore(buildCart('cart-1'));
    const pendingApply = deferred<Cart>();
    mockApplyCartDiscount.mockReturnValueOnce(pendingApply.promise);

    const applyPromise = store.getState().applyDiscount('LATE');
    await flushMicrotasks();

    act(() => {
      store.getState().clearCart({ deleteCart: true });
    });
    expect(store.getState().currentCart).toBeNull();

    pendingApply.resolve(buildCart('cart-1', { currency: 'USD' }));
    await act(async () => {
      await applyPromise;
    });

    expect(store.getState().currentCart).toBeNull();
    expect(store.getState().loading).toBe(false);
    expect(store.getState().error).toBeNull();
  });

  it('skips the follow-up refetch of a line-item write that completes after an auth reset', async () => {
    const store = seedStore(buildCart('cart-1'));
    const pendingUpdate = deferred<void>();
    mockUpdateCartItemQuantity.mockReturnValueOnce(pendingUpdate.promise);
    // The reset's own fetch resolves to "no cart" for the new session.
    mockFetchCurrentCart.mockResolvedValue(fcResult(null));

    const updatePromise = store.getState().updateItemQuantity('item-1', 3);
    await flushMicrotasks();
    expect(store.getState().loading).toBe(true);

    await act(async () => {
      await store.getState().validateCart('unauthenticated');
    });
    const fetchesAfterReset = mockFetchCurrentCart.mock.calls.length;

    pendingUpdate.resolve();
    await act(async () => {
      await updatePromise;
    });

    expect(mockFetchCurrentCart).toHaveBeenCalledTimes(fetchesAfterReset);
    expect(store.getState().currentCart).toBeNull();
    expect(store.getState().loading).toBe(false);
  });

  it('drops a refetch response that was issued before clearCart() but resolves after it', async () => {
    const store = seedStore(buildCart('cart-1'));
    mockUpdateCartItemQuantity.mockResolvedValueOnce(undefined);
    const pendingGet = deferred<ReturnType<typeof fcResult>>();
    mockFetchCurrentCart.mockReturnValueOnce(pendingGet.promise);

    // PATCH resolves immediately; the follow-up GET is now in flight under the pre-reset epoch.
    const updatePromise = store.getState().updateItemQuantity('item-1', 2);
    await flushMicrotasks();
    expect(mockFetchCurrentCart).toHaveBeenCalledTimes(1);

    act(() => {
      store.getState().clearCart({ deleteCart: true });
    });

    pendingGet.resolve(fcResult(buildCart('cart-1', { currency: 'USD' })));
    await act(async () => {
      await updatePromise;
    });

    expect(store.getState().currentCart).toBeNull();
    expect(store.getState().loading).toBe(false);
  });

  it('lets the reset fetch win over a slower pre-reset GET after an auth transition', async () => {
    const store = seedStore(buildCart('cart-1'));
    mockUpdateCartItemQuantity.mockResolvedValueOnce(undefined);
    const staleGet = deferred<ReturnType<typeof fcResult>>();
    mockFetchCurrentCart.mockReturnValueOnce(staleGet.promise);
    // The reset's own GET: new session has no cart.
    mockFetchCurrentCart.mockResolvedValueOnce(fcResult(null));

    const updatePromise = store.getState().updateItemQuantity('item-1', 2);
    await flushMicrotasks();

    await act(async () => {
      await store.getState().validateCart('unauthenticated');
    });
    expect(store.getState().currentCart).toBeNull();

    staleGet.resolve(fcResult(buildCart('cart-1')));
    await act(async () => {
      await updatePromise;
    });

    expect(store.getState().currentCart).toBeNull();
    expect(store.getState().loading).toBe(false);
  });

  it('never writes a stale addToCart to the pre-reset cart; it retries once against the fresh cart', async () => {
    const store = seedStore(null);
    const pendingGet = deferred<ReturnType<typeof fcResult>>();
    mockFetchCurrentCart.mockReturnValueOnce(pendingGet.promise);
    const freshCart = buildCart('cart-fresh');
    mockCreateCart.mockResolvedValueOnce(freshCart);
    mockAddItemToCart.mockResolvedValueOnce({ cart: freshCart });

    // Cart unknown: addToCart waits for the in-flight fetch first.
    const fetchPromise = store.getState().fetchCart();
    const addPromise = store.getState().addToCart('product-1', 1);
    await flushMicrotasks();

    act(() => {
      store.getState().clearCart();
    });
    pendingGet.resolve(fcResult(buildCart('cart-old')));
    await fetchPromise;
    await act(async () => {
      await addPromise;
    });

    // The retried attempt creates the fresh cart; nothing was ever written to `cart-old`.
    expect(mockCreateCart).toHaveBeenCalledTimes(1);
    expect(mockAddItemToCart).toHaveBeenCalledTimes(1);
    expect(mockAddItemToCart).toHaveBeenCalledWith('cart-fresh', expect.anything(), expect.anything());
    expect(store.getState().currentCart?.id).toBe('cart-fresh');
    expect(store.getState().error).toBeNull();
  });

  it('surfaces CartMutationCancelledError when a second reset cancels the retried addToCart', async () => {
    const store = seedStore(null);
    const pendingGet = deferred<ReturnType<typeof fcResult>>();
    const pendingCreate = deferred<Cart>();
    mockFetchCurrentCart.mockReturnValueOnce(pendingGet.promise);
    mockCreateCart.mockReturnValueOnce(pendingCreate.promise);

    const fetchPromise = store.getState().fetchCart();
    const addPromise = store.getState().addToCart('product-1', 1);
    await flushMicrotasks();
    act(() => {
      store.getState().clearCart();
    });
    pendingGet.resolve(fcResult(buildCart('cart-old')));
    await fetchPromise;
    await flushMicrotasks();

    // The retry is now creating a cart; a second reset lands before the create resolves.
    expect(mockCreateCart).toHaveBeenCalledTimes(1);
    act(() => {
      store.getState().clearCart();
    });
    pendingCreate.resolve(buildCart('cart-fresh'));

    await expect(addPromise).rejects.toBeInstanceOf(CartMutationCancelledError);
    expect(mockAddItemToCart).not.toHaveBeenCalled();
    expect(store.getState().currentCart).toBeNull();
    expect(store.getState().error).toBeNull();
  });

  it('skips an id-bound write that was queued behind another mutation when a reset happens meanwhile', async () => {
    const store = seedStore(buildCart('cart-1'));
    const pendingApply = deferred<Cart>();
    mockApplyCartDiscount.mockReturnValueOnce(pendingApply.promise);
    mockFetchCurrentCart.mockResolvedValue(fcResult(buildCart('cart-new')));

    const applyPromise = store.getState().applyDiscount('HOLD');
    const removePromise = store.getState().removeItem('item-from-old-cart');
    await flushMicrotasks();

    await act(async () => {
      await store.getState().validateCart('unauthenticated');
    });

    pendingApply.resolve(buildCart('cart-1'));
    await act(async () => {
      await expect(removePromise).rejects.toBeInstanceOf(CartMutationCancelledError);
      await applyPromise;
    });

    expect(mockRemoveCartItem).not.toHaveBeenCalled();
    expect(store.getState().currentCart?.id).toBe('cart-new');
    expect(store.getState().error).toBeNull();
  });

  type SeededStore = ReturnType<typeof seedStore>;
  const queuedWrites: Array<[string, (store: SeededStore) => Promise<void>, () => jest.Mock]> = [
    ['applyDiscount', (store) => store.getState().applyDiscount('QUEUED'), () => mockApplyCartDiscount],
    ['removeDiscount', (store) => store.getState().removeDiscount(0), () => mockRemoveCartDiscount],
    [
      'updateShippingInfo',
      (store) => store.getState().updateShippingInfo({ country: 'DE', zipCode: '10115' }),
      () => mockUpdateShippingInfo,
    ],
  ];

  it.each(queuedWrites)(
    'discards a %s queued before a reset instead of replaying it on the re-resolved cart',
    async (_name, start, api) => {
      const store = seedStore(buildCart('cart-1'));
      const pendingApply = deferred<Cart>();
      mockApplyCartDiscount.mockReturnValueOnce(pendingApply.promise);
      mockFetchCurrentCart.mockResolvedValue(fcResult(buildCart('cart-new')));

      const holdPromise = store.getState().applyDiscount('HOLD');
      const queuedPromise = start(store);
      await flushMicrotasks();

      await act(async () => {
        await store.getState().validateCart('unauthenticated');
      });

      pendingApply.resolve(buildCart('cart-1'));
      await act(async () => {
        if (_name === 'applyDiscount' || _name === 'removeDiscount') {
          await expect(queuedPromise).rejects.toBeInstanceOf(CartMutationCancelledError);
          await holdPromise;
          return;
        }
        await Promise.all([holdPromise, queuedPromise]);
      });

      expect(api().mock.calls.filter((call: unknown[]) => call[0] === 'cart-new')).toHaveLength(0);
      expect(mockApplyCartDiscount).toHaveBeenCalledTimes(1);
      expect(store.getState().currentCart?.id).toBe('cart-new');
      expect(store.getState().error).toBeNull();
    },
  );

  it('still reprices the re-resolved cart when a currency change was queued before a reset', async () => {
    const store = seedStore(buildCart('cart-1'));
    const pendingApply = deferred<Cart>();
    mockApplyCartDiscount.mockReturnValueOnce(pendingApply.promise);
    mockUpdateCartCurrency.mockResolvedValue(undefined);
    mockFetchCurrentCart.mockResolvedValueOnce(fcResult(buildCart('cart-new')));
    mockFetchCurrentCart.mockResolvedValueOnce(fcResult(buildCart('cart-new', { currency: 'CHF' })));

    const holdPromise = store.getState().applyDiscount('HOLD');
    const currencyPromise = store.getState().updateCurrency('CHF');
    await flushMicrotasks();

    await act(async () => {
      await store.getState().validateCart('unauthenticated');
    });

    pendingApply.resolve(buildCart('cart-1'));
    await act(async () => {
      await Promise.all([holdPromise, currencyPromise]);
    });

    // Currency is session intent, not bound to the old cart id: it must land on the new cart.
    expect(mockUpdateCartCurrency).toHaveBeenCalledTimes(1);
    expect(mockUpdateCartCurrency).toHaveBeenCalledWith('cart-new', 'CHF');
    expect(store.getState().currentCart?.currency).toBe('CHF');
    expect(store.getState().loading).toBe(false);
  });

  it('issues a fresh GET for a refetch after a write instead of deduping onto a pre-write GET', async () => {
    const store = seedStore(buildCart('cart-1', { items: [{ id: 'item-1' }] as Cart['items'] }));
    const staleGet = deferred<ReturnType<typeof fcResult>>();
    mockFetchCurrentCart.mockReturnValueOnce(staleGet.promise);
    mockApplyCartDiscount.mockResolvedValueOnce(buildCart('cart-1', { items: [{ id: 'item-1' }] as Cart['items'] }));
    mockRemoveCartItem.mockResolvedValueOnce(undefined);
    mockFetchCurrentCart.mockResolvedValueOnce(fcResult(buildCart('cart-1', { items: [] })));

    const fetchPromise = store.getState().fetchCart();
    await act(async () => {
      await store.getState().applyDiscount('FAST');
      await store.getState().removeItem('item-1');
    });

    // The post-remove refetch must not reuse the pre-write GET that is still in flight.
    expect(mockFetchCurrentCart).toHaveBeenCalledTimes(2);
    expect(store.getState().currentCart?.items).toHaveLength(0);

    staleGet.resolve(fcResult(buildCart('cart-1', { items: [{ id: 'item-1' }] as Cart['items'] })));
    await act(async () => {
      await fetchPromise;
    });

    expect(store.getState().currentCart?.items).toHaveLength(0);
    expect(store.getState().loading).toBe(false);
  });

  it('strips leftover coupons after the last line item is removed', async () => {
    const emptiedWithCoupon = buildCart('cart-1', {
      items: [],
      discounts: [{ code: 'ACCESSORIES15', discountIndex: 0, amount: 1.5, currency: 'EUR' }],
    });
    const emptiedClean = buildCart('cart-1', { items: [] });
    const store = seedStore(
      buildCart('cart-1', {
        items: [{ id: 'item-1' }] as Cart['items'],
        discounts: [{ code: 'ACCESSORIES15', discountIndex: 0, amount: 1.5, currency: 'EUR' }],
      }),
    );
    mockRemoveCartItem.mockResolvedValueOnce(undefined);
    mockFetchCurrentCart.mockResolvedValueOnce(fcResult(emptiedWithCoupon));
    mockRemoveCartDiscount.mockResolvedValueOnce(undefined);
    mockFetchCurrentCart.mockResolvedValueOnce(fcResult(emptiedClean));

    await act(async () => {
      await store.getState().removeItem('item-1');
    });

    expect(mockRemoveCartDiscount).toHaveBeenCalledWith('cart-1', 0);
    expect(store.getState().currentCart?.discounts).toBeUndefined();
    expect(store.getState().currentCart?.items).toHaveLength(0);
  });

  it('does not DELETE the TOTAL rollup when stripping leftover coupons from an empty cart', async () => {
    const emptiedWithRollup = buildCart('cart-1', {
      items: [],
      discounts: [
        { code: 'TOTAL', discountIndex: 0, amount: 1.5, currency: 'EUR' },
        { code: 'ACCESSORIES15', discountIndex: 1, amount: 1.5, currency: 'EUR' },
      ],
    });
    const emptiedClean = buildCart('cart-1', { items: [] });
    const store = seedStore(
      buildCart('cart-1', {
        items: [{ id: 'item-1' }] as Cart['items'],
        discounts: emptiedWithRollup.discounts,
      }),
    );
    mockRemoveCartItem.mockResolvedValueOnce(undefined);
    mockFetchCurrentCart.mockResolvedValueOnce(fcResult(emptiedWithRollup));
    mockRemoveCartDiscount.mockResolvedValueOnce(undefined);
    mockFetchCurrentCart.mockResolvedValueOnce(fcResult(emptiedClean));

    await act(async () => {
      await store.getState().removeItem('item-1');
    });

    expect(mockRemoveCartDiscount).toHaveBeenCalledTimes(1);
    expect(mockRemoveCartDiscount).toHaveBeenCalledWith('cart-1', 1);
  });

  it('rejects removeItem when leftover coupon cleanup fails', async () => {
    const emptiedWithCoupon = buildCart('cart-1', {
      items: [],
      discounts: [{ code: 'ACCESSORIES15', discountIndex: 0, amount: 1.5, currency: 'EUR' }],
    });
    const store = seedStore(
      buildCart('cart-1', {
        items: [{ id: 'item-1' }] as Cart['items'],
        discounts: [{ code: 'ACCESSORIES15', discountIndex: 0, amount: 1.5, currency: 'EUR' }],
      }),
    );
    mockRemoveCartItem.mockResolvedValueOnce(undefined);
    mockFetchCurrentCart.mockResolvedValueOnce(fcResult(emptiedWithCoupon));
    mockRemoveCartDiscount.mockRejectedValueOnce(new Error('coupon cleanup failed'));

    await act(async () => {
      await expect(store.getState().removeItem('item-1')).rejects.toThrow('coupon cleanup failed');
    });
  });

  it('sets mutating while a snapshot mutation is in flight without flipping loading', async () => {
    const store = seedStore(buildCart('cart-1'));
    const pending = deferred<Cart>();
    mockApplyCartDiscount.mockReturnValueOnce(pending.promise);

    const apply = store.getState().applyDiscount('CODE');
    expect(store.getState().mutating).toBe(true);
    expect(store.getState().loading).toBe(false);

    pending.resolve(buildCart('cart-1'));
    await act(async () => {
      await apply;
    });
    expect(store.getState().mutating).toBe(false);
  });

  it('re-resolves a queued remove to the coupon code after an earlier write reindexes discounts', async () => {
    const store = seedStore(
      buildCart('cart-1', {
        discounts: [
          { code: 'GOODS10', discountIndex: 0, amount: 10, currency: 'EUR' },
          { code: 'FREESHIP', discountIndex: 1, amount: 0, currency: 'EUR', type: 'FREE_SHIPPING' },
        ],
      }),
    );
    const pendingApply = deferred<Cart>();
    mockApplyCartDiscount.mockReturnValueOnce(pendingApply.promise);
    mockRemoveCartDiscount.mockResolvedValueOnce(
      buildCart('cart-1', { discounts: [{ code: 'GOODS10', discountIndex: 0, amount: 10, currency: 'EUR' }] }),
    );

    const applyPromise = store.getState().applyDiscount('OTHER');
    const removePromise = store.getState().removeDiscount(1);
    await flushMicrotasks();

    pendingApply.resolve(
      buildCart('cart-1', {
        discounts: [{ code: 'FREESHIP', discountIndex: 0, amount: 0, currency: 'EUR', type: 'FREE_SHIPPING' }],
      }),
    );
    await act(async () => {
      await Promise.all([applyPromise, removePromise]);
    });

    expect(mockRemoveCartDiscount).toHaveBeenCalledWith('cart-1', 0);
  });

  it('drops a GET issued before a discount write that resolves after the write published its snapshot', async () => {
    const store = seedStore(buildCart('cart-1'));
    const staleGet = deferred<ReturnType<typeof fcResult>>();
    mockFetchCurrentCart.mockReturnValueOnce(staleGet.promise);
    mockApplyCartDiscount.mockResolvedValueOnce(buildCart('cart-1', { currency: 'USD' }));

    const fetchPromise = store.getState().fetchCart();
    await act(async () => {
      await store.getState().applyDiscount('FAST');
    });
    expect(store.getState().currentCart?.currency).toBe('USD');

    staleGet.resolve(fcResult(buildCart('cart-1', { currency: 'EUR' })));
    await act(async () => {
      await fetchPromise;
    });

    // The pre-write GET must not roll the snapshot back to the pre-discount cart.
    expect(store.getState().currentCart?.currency).toBe('USD');
    expect(store.getState().loading).toBe(false);
  });

  it('drains a reprice recorded during a reset fetch once the busy gate releases', async () => {
    const store = seedStore(buildCart('cart-1'));
    const pendingApply = deferred<Cart>();
    mockApplyCartDiscount.mockReturnValueOnce(pendingApply.promise);
    const resetGet = deferred<ReturnType<typeof fcResult>>();
    mockFetchCurrentCart.mockReturnValueOnce(resetGet.promise);
    mockUpdateCartCurrency.mockResolvedValueOnce(undefined);
    mockFetchCurrentCart.mockResolvedValueOnce(fcResult(buildCart('cart-2', { site: 'other', currency: 'CHF' })));

    const applyPromise = store.getState().applyDiscount('HOLD');
    await flushMicrotasks();

    const validatePromise = store.getState().validateSite('other');
    await flushMicrotasks();
    // Session currency changes while the reset fetch is loading: recorded as pending intent.
    await store.getState().syncCurrencyWithSession('CHF', 'other');
    expect(store.getState().pendingCurrencySync).toEqual({ currency: 'CHF', siteCode: 'other', attempts: 1 });

    resetGet.resolve(fcResult(buildCart('cart-2', { site: 'other', currency: 'EUR' })));
    await act(async () => {
      await validatePromise;
    });
    // The gate is still held by applyDiscount, so the reset fetch must not await the reprice.
    expect(store.getState().currentCart?.id).toBe('cart-2');
    expect(mockUpdateCartCurrency).not.toHaveBeenCalled();

    pendingApply.resolve(buildCart('cart-1'));
    await act(async () => {
      await applyPromise;
    });

    await waitFor(() => expect(mockUpdateCartCurrency).toHaveBeenCalledWith('cart-2', 'CHF'));
    await waitFor(() => expect(store.getState().currentCart?.currency).toBe('CHF'));
    expect(store.getState().pendingCurrencySync).toBeNull();
  });

  it('does not deadlock when a session currency change arrives while updateCurrency holds the gate', async () => {
    const store = seedStore(buildCart('cart-1'));
    const pendingCurrencyUpdate = deferred<void>();
    mockUpdateCartCurrency.mockReturnValueOnce(pendingCurrencyUpdate.promise);
    mockUpdateCartCurrency.mockResolvedValueOnce(undefined);
    mockFetchCurrentCart.mockResolvedValueOnce(fcResult(buildCart('cart-1', { currency: 'USD' })));
    mockFetchCurrentCart.mockResolvedValueOnce(fcResult(buildCart('cart-1', { currency: 'CHF' })));

    const updatePromise = store.getState().updateCurrency('USD');
    await flushMicrotasks();
    expect(store.getState().loading).toBe(true);

    // Arrives mid-flight: the store records it as pending instead of mutating right away.
    await store.getState().syncCurrencyWithSession('CHF', 'main');
    expect(store.getState().pendingCurrencySync).toEqual({ currency: 'CHF', siteCode: 'main', attempts: 1 });

    pendingCurrencyUpdate.resolve();
    // Previously hung forever: fetchCart flushed the pending sync inside the held gate.
    await act(async () => {
      await updatePromise;
    });

    await waitFor(() => expect(mockUpdateCartCurrency).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(store.getState().currentCart?.currency).toBe('CHF'));
    expect(mockUpdateCartCurrency.mock.calls.map((call: unknown[]) => call[1])).toEqual(['USD', 'CHF']);
    expect(store.getState().pendingCurrencySync).toBeNull();
    expect(store.getState().loading).toBe(false);
  });
});
