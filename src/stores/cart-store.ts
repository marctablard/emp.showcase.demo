'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  addItemToCart as apiAddItemToCart,
  createCart as apiCreateCart,
  fetchCurrentCart as apiFetchCurrentCart,
  removeCartItem as apiRemoveCartItem,
  updateCartCurrency as apiUpdateCartCurrency,
  updateCartItemQuantity as apiUpdateCartItemQuantity,
  updateShippingInfo as apiUpdateShippingInfo,
  clearCartSession,
  loadSavedCart,
} from '@/lib/client/carts';
import { devSyncLog } from '@/lib/client/dev-sync-log';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { CartShippingAddress, ModifyCartItemResult } from '@/platform/services/cart/CartService';
import type { Cart } from '@/platform/services/model/cart/cart';

export interface CartState {
  // Cart data, null means no cart, undefined means unknown state
  currentCart: Cart | null | undefined;
  loading: boolean;
  error: Error | null;
  lastShippingUpdate: {
    country?: string;
    zipCode?: string;
    timestamp: number;
  } | null;
  sessionStatus: string | null;
  // Track last site code to detect site changes
  lastSiteCode: string | null;
  /** Normalized session legal entity; null = not initialized yet (mirrors lastSiteCode). */
  lastLegalEntityId: string | null;
  pendingCurrencySync: {
    currency: string;
    siteCode: string;
    attempts: number;
  } | null;
  /** Consolidated loader for orchestrated flows — flips 0→1 / N→0 to drive a single UI spinner. */
  isSettling: boolean;
}

interface CartActions {
  // Cart state operations
  setCurrentCart: (cart: Cart | null | undefined) => void;
  getCurrentCart: () => Cart | null | undefined;
  setLoading: (loading: boolean) => void;
  getLoading: () => boolean;
  setError: (error: Error | null) => void;
  loadCart: (cartId: string, type?: string) => Promise<Cart | null | undefined>;

  validateCart: (sessionStatus: string) => Promise<void>;
  validateSite: (siteCode: string) => Promise<void>;
  validateLegalEntity: (legalEntityId: string | undefined) => Promise<void>;

  // Cart API operations
  fetchCart: (createCurrent?: boolean) => Promise<Cart | null | undefined>;
  addToCart: (productId: string, quantity: number, _retryCount?: number) => Promise<ModifyCartItemResult>;
  updateItemQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  updateShippingInfo: (shippingAddress: CartShippingAddress, billingAddress?: CartShippingAddress) => Promise<void>;
  updateCurrency: (currency: string) => Promise<void>;
  clearCart: (options?: { deleteCart?: boolean; clearSession?: boolean }) => void;

  // Cross-store synchronization
  syncCurrencyWithSession: (currency: string, siteCode: string) => Promise<void>;
  flushPendingCurrencySync: () => Promise<void>;

  /** Nestable; flips `isSettling` on 0→1. */
  beginSettling: (reason?: string) => void;
  /** Flips `isSettling` off on N→0; unmatched calls clamp at 0. */
  endSettling: (reason?: string) => void;
}
export type CartStore = CartState & CartActions;

const MAX_PENDING_CURRENCY_SYNC_RETRIES = 3;

// default state explicitly 'undefined' since it means, we don't know the cart's state
const defaultState: CartState = {
  currentCart: undefined,
  loading: false,
  error: null,
  lastShippingUpdate: null,
  sessionStatus: null,
  lastSiteCode: null,
  lastLegalEntityId: null,
  pendingCurrencySync: null,
  isSettling: false,
};

export const createCartStore = (initState: CartState = defaultState) => {
  /** Dedupes concurrent `fetchCart` calls; kept outside state to avoid re-renders. */
  let _fetchPromise: Promise<Cart | null | undefined> | null = null;
  /** Serializes PATCH /shipping so parallel callers cannot race Emporix optimistic locking. */
  let _shippingUpdateGate: Promise<void> = Promise.resolve();
  /** Settling counter kept outside state so only 0→1 / N→0 transitions notify subscribers. */
  let _settlingCount = 0;

  return create<CartStore>()(
    subscribeWithSelector((set, get) => ({
      ...initState,
      validateCart: async (newSessionStatus: string) => {
        const { sessionStatus } = get();
        if (sessionStatus !== newSessionStatus) {
          set({ sessionStatus: newSessionStatus });
          // Only clear cart on actual auth transitions (not initial mount)
          // On first mount, sessionStatus is null — this is initialization, not an auth change
          if (sessionStatus !== null) {
            _fetchPromise = null;
            set({
              currentCart: null,
              loading: true,
              error: null,
              lastShippingUpdate: null,
              pendingCurrencySync: null,
            });
            await get().fetchCart();
          }
        }
      },
      /**
       * Snap `lastSiteCode`, clear the cart, and refetch once. The session is already settled
       * by the orchestrator; `fetchCart` guards catch any residual races.
       */
      validateSite: async (newSiteCode: string) => {
        const { lastSiteCode, currentCart } = get();
        devSyncLog('cart-store: validateSite', {
          newSiteCode,
          lastSiteCode,
          cartSite: currentCart?.site,
          cartId: currentCart?.id,
        });
        if (!newSiteCode || newSiteCode === lastSiteCode) {
          if (lastSiteCode === null && newSiteCode) {
            set({ lastSiteCode: newSiteCode });
          }
          return;
        }
        _fetchPromise = null;
        set({
          lastSiteCode: newSiteCode,
          currentCart: null,
          loading: true,
          error: null,
          lastShippingUpdate: null,
          pendingCurrencySync: null,
        });
        await get().fetchCart();
      },
      validateLegalEntity: async (newLegalEntityId: string | undefined) => {
        const normalized = newLegalEntityId?.trim() ?? '';
        const { lastLegalEntityId } = get();
        if (lastLegalEntityId !== null && lastLegalEntityId !== normalized) {
          _fetchPromise = null;
          set({
            lastLegalEntityId: normalized,
            currentCart: null,
            loading: true,
            error: null,
            lastShippingUpdate: null,
            pendingCurrencySync: null,
          });
          await get().fetchCart();
        } else if (lastLegalEntityId === null) {
          set({ lastLegalEntityId: normalized });
          // First bound session legal entity (e.g. B2B company selection): re-resolve cart server-side
          // so we never keep a cart from another company or from before LE context existed.
          if (normalized !== '') {
            _fetchPromise = null;
            set({
              currentCart: null,
              loading: true,
              error: null,
              lastShippingUpdate: null,
              pendingCurrencySync: null,
            });
            await get().fetchCart();
          }
        }
      },
      // State setters
      setCurrentCart: (cart: Cart | null | undefined) => {
        if (cart === get().currentCart) {
          return;
        }
        set({ currentCart: cart, loading: false });
      },
      getCurrentCart: () => get().currentCart,
      setLoading: (loading: boolean) => set({ loading }),
      getLoading: () => get().loading,
      setError: (error: Error | null) => set({ error }),

      /**
       * Read the current cart. Never creates. Discards responses whose site disagrees with the
       * session's `x-session-site-code` header or the local `lastSiteCode`. `_createCurrent` is
       * retained for API compatibility and ignored.
       */
      fetchCart: async (_createCurrent: boolean = false) => {
        if (_fetchPromise) {
          return _fetchPromise;
        }

        let thisPromise: Promise<Cart | null | undefined> | null = null;

        const currentFetchPromise = (async () => {
          try {
            set({ loading: true, error: null });

            try {
              const { cart: fetchedCart, sessionSiteCode } = await apiFetchCurrentCart();
              let cartData = fetchedCart;
              const expectedSite = get().lastSiteCode;

              // Server inconsistency guard: cart tenant ≠ Emporix session.siteCode from the same GET.
              if (cartData && sessionSiteCode && cartData.site && cartData.site !== sessionSiteCode) {
                devSyncLog('cart-store: fetchCart discarding cart/session site mismatch', {
                  cartSite: cartData.site,
                  sessionSiteCode,
                  cartId: cartData.id,
                });
                getLogger().warn(
                  { cartSite: cartData.site, sessionSiteCode },
                  'fetchCart received cart whose site does not match session site — discarding',
                );
                cartData = null;
              } else if (
                cartData &&
                !sessionSiteCode &&
                expectedSite &&
                cartData.site &&
                cartData.site !== expectedSite
              ) {
                // No header (legacy): fall back to lastSiteCode-only mismatch guard.
                devSyncLog('cart-store: fetchCart discarding wrong-site cart (no session header)', {
                  cartSite: cartData.site,
                  expectedSite,
                  cartId: cartData.id,
                });
                getLogger().warn(
                  { cartSite: cartData.site, expectedSite },
                  'fetchCart received cart from wrong site — discarding',
                );
                cartData = null;
              }

              set({ currentCart: cartData, loading: false });
              try {
                getLogger().info(
                  {
                    event: 'fetch_cart_snapshot',
                    cartId: cartData?.id ?? null,
                    site: cartData?.site ?? null,
                    currency: cartData?.currency ?? cartData?.totalPrice?.currency ?? null,
                    sessionId: cartData?.sessionId ?? null,
                    sessionSiteCode,
                    lastSiteCode: get().lastSiteCode,
                  },
                  'fetchCart: cart id, site, currency, session id, and session header (single snapshot)',
                );
              } catch {
                /* logging must never clear cart state */
              }
              if (_fetchPromise === thisPromise) {
                _fetchPromise = null;
              }
              await get().flushPendingCurrencySync();
              return cartData;
            } catch (_err) {
              set({ currentCart: null, loading: false });
              if (_fetchPromise === thisPromise) {
                _fetchPromise = null;
              }
              await get().flushPendingCurrencySync();
              return null;
            }
          } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to fetch cart');
            set({ error, loading: false });
            getLogger().error({ err }, 'Error fetching cart');
            if (_fetchPromise === thisPromise) {
              _fetchPromise = null;
            }
            await get().flushPendingCurrencySync();
            return undefined;
          }
        })();
        thisPromise = currentFetchPromise;
        _fetchPromise = currentFetchPromise;

        void currentFetchPromise.finally(() => {
          if (_fetchPromise === currentFetchPromise) {
            _fetchPromise = null;
          }
        });

        return _fetchPromise;
      },

      loadCart: async (cartId: string, type: string = 'shopping') => {
        try {
          set({ loading: true, error: null });

          // Try to fetch existing cart
          try {
            const cartData = await loadSavedCart(cartId, type);
            set({ currentCart: cartData, loading: false });
            return cartData;
          } catch (_err) {
            // Silent error when cart is gone
            set({ currentCart: null, loading: false });
            return null;
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Failed to fetch cart');
          set({ error, loading: false });
          getLogger().error({ err }, 'Error fetching cart');
          return undefined;
        }
      },

      /**
       * Add an item to the cart. Creates the cart explicitly (`POST /api/cart`) if missing, and
       * re-resolves via `fetchCart` if the existing cart belongs to the wrong site.
       */
      addToCart: async (productId: string, quantity: number, _retryCount = 0) => {
        const { lastSiteCode } = get();

        let { currentCart } = get();
        if (!currentCart) {
          // Wait for any in-flight fetchCart (e.g. from validateCart after login) before
          // attempting to create — avoids a 409 Conflict when the auth service already
          // created/merged a cart server-side.
          if (_fetchPromise) {
            await _fetchPromise;
            currentCart = get().currentCart;
          }
        }
        if (!currentCart) {
          try {
            const newCart = await apiCreateCart({
              ...(lastSiteCode ? { siteCode: lastSiteCode } : {}),
            });
            set({ currentCart: newCart, loading: false });
            currentCart = newCart;
          } catch (err) {
            // Cart creation failed — likely a 409 Conflict from a post-login race where
            // the session already owns a cart. Fetch the existing cart and retry once.
            if (_retryCount < 1) {
              _fetchPromise = null;
              const fetched = await get().fetchCart();
              if (fetched) {
                return get().addToCart(productId, quantity, _retryCount + 1);
              }
            }
            const error = err instanceof Error ? err : new Error('Failed to create cart');
            set({ error, loading: false });
            getLogger().error({ err }, 'Error creating cart before add-to-cart');
            throw err;
          }
        }

        // Cart belongs to a different site than `validateSite` last snapped — re-resolve via GET.
        if (lastSiteCode && currentCart.site && currentCart.site !== lastSiteCode) {
          getLogger().warn(
            { cartSite: currentCart.site, sessionSite: lastSiteCode },
            'Cart-site mismatch detected on client — clearing stale cart and re-resolving',
          );
          _fetchPromise = null;
          set({ currentCart: null, loading: true, error: null });
          await get().fetchCart();
          const { currentCart: correctCart } = get();
          if (!correctCart) {
            throw new Error('Failed to get correct site cart');
          }
          currentCart = correctCart;
        }

        set({ loading: true, error: null });

        try {
          const cartId = currentCart.id;

          const result = await apiAddItemToCart(cartId, productId, quantity);

          if (result.cart) {
            set({ currentCart: result.cart, loading: false });
          } else {
            await get().fetchCart();
          }

          return result;
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Failed to add item to cart');
          set({ error, loading: false });
          getLogger().error({ err }, 'Error adding item to cart');
          throw err;
        }
      },

      updateItemQuantity: async (itemId: string, quantity: number) => {
        const { currentCart } = get();
        if (!currentCart) {
          await get().fetchCart();
          const updatedCart = get().currentCart;
          if (!updatedCart) throw new Error('No cart available');
        }

        try {
          set({ loading: true, error: null });
          const cart = get().currentCart;
          if (!cart) throw new Error('No cart available');

          // Call API to update item
          await apiUpdateCartItemQuantity(cart.id, itemId, quantity);

          // Refetch cart to get updated state
          await get().fetchCart();
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Failed to update cart item');
          set({ error, loading: false });
          getLogger().error({ err }, 'Error updating cart item');
        }
      },

      removeItem: async (itemId: string) => {
        const { currentCart } = get();
        if (!currentCart) {
          await get().fetchCart();
          const updatedCart = get().currentCart;
          if (!updatedCart) throw new Error('No cart available');
        }

        try {
          set({ loading: true, error: null });
          const cart = get().currentCart;
          if (!cart) throw new Error('No cart available');

          // Call API to remove item
          await apiRemoveCartItem(cart.id, itemId);

          // Refetch cart to get updated state
          await get().fetchCart();
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Failed to remove cart item');
          set({ error, loading: false });
          getLogger().error({ err }, 'Error removing cart item');
        }
      },

      updateShippingInfo: async (shippingAddress: CartShippingAddress, billingAddress?: CartShippingAddress) => {
        const afterPrevious = _shippingUpdateGate;
        let releaseNext!: () => void;
        _shippingUpdateGate = new Promise<void>((resolve) => {
          releaseNext = resolve;
        });
        await afterPrevious.catch(() => {});

        try {
          const { lastShippingUpdate } = get();
          const now = Date.now();
          const DEBOUNCE_TIME = 2000;

          if (
            lastShippingUpdate &&
            lastShippingUpdate.country === shippingAddress.country &&
            lastShippingUpdate.zipCode === shippingAddress.zipCode &&
            now - lastShippingUpdate.timestamp < DEBOUNCE_TIME
          ) {
            return;
          }

          set({
            loading: true,
            error: null,
            lastShippingUpdate: {
              country: shippingAddress.country,
              zipCode: shippingAddress.zipCode,
              timestamp: now,
            },
          });

          const { currentCart } = get();
          if (!currentCart) {
            await get().fetchCart();
            const updatedCart = get().currentCart;
            if (!updatedCart) return;
          }

          const cart = get().currentCart;
          if (!cart) {
            set({ loading: false });
            return;
          }

          await apiUpdateShippingInfo(cart.id, shippingAddress, billingAddress);

          await get().fetchCart();
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Failed to update shipping info');
          set({ error, loading: false });
          getLogger().error({ err }, 'Error updating shipping info');
        } finally {
          releaseNext();
        }
      },

      updateCurrency: async (currency: string) => {
        try {
          const { currentCart } = get();
          if (!currentCart) {
            await get().fetchCart();
            const updatedCart = get().currentCart;
            if (!updatedCart) return;
          }

          set({ loading: true, error: null });

          const cart = get().currentCart;
          if (!cart) return;

          await apiUpdateCartCurrency(cart.id, currency);
          await get().fetchCart(false);
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Failed to update cart currency');
          set({ error, loading: false });
          getLogger().error({ err }, 'Error updating cart currency');
        }
      },

      clearCart: (options?: { deleteCart?: boolean; clearSession?: boolean }) => {
        const { deleteCart = false, clearSession = true } = options ?? {};
        _fetchPromise = null;
        set({
          currentCart: null,
          loading: false,
          error: null,
          lastShippingUpdate: null,
          lastSiteCode: null,
          lastLegalEntityId: null,
          pendingCurrencySync: null,
        });
        // Fire-and-forget server-side clear; skipped during login where merge already sets cartId.
        if (clearSession) {
          clearCartSession(deleteCart).catch((err) => {
            getLogger().error({ err }, 'Failed to clear cart session on server');
          });
        }
      },

      syncCurrencyWithSession: async (currency: string, siteCode: string) => {
        devSyncLog('cart-store: syncCurrencyWithSession', {
          currency,
          siteCode,
          cartSite: get().currentCart?.site,
          cartCurrency: get().currentCart?.currency ?? get().currentCart?.totalPrice?.currency,
          loading: get().loading,
        });
        // Queue retry while cart/session transitions are in-flight.
        if (get().loading) {
          devSyncLog('cart-store: syncCurrencyWithSession deferred — cart loading', {
            currency,
            siteCode,
            cartId: get().currentCart?.id ?? null,
          });
          const pendingCurrencySync = get().pendingCurrencySync;
          if (
            pendingCurrencySync &&
            pendingCurrencySync.currency === currency &&
            pendingCurrencySync.siteCode === siteCode &&
            pendingCurrencySync.attempts >= MAX_PENDING_CURRENCY_SYNC_RETRIES
          ) {
            getLogger().warn(
              { currency, siteCode, attempts: pendingCurrencySync.attempts },
              'Dropping pending currency sync after max retries',
            );
            return;
          }

          const nextAttempts =
            pendingCurrencySync &&
            pendingCurrencySync.currency === currency &&
            pendingCurrencySync.siteCode === siteCode
              ? pendingCurrencySync.attempts + 1
              : 1;
          set({
            pendingCurrencySync: {
              currency,
              siteCode,
              attempts: nextAttempts,
            },
          });
          return;
        }

        const { currentCart } = get();
        if (!currentCart) {
          devSyncLog('cart-store: syncCurrencyWithSession skipped — no cart', { currency, siteCode });
          return;
        }

        if (currentCart.site !== siteCode) {
          devSyncLog('cart-store: syncCurrencyWithSession skipped — cart site mismatch', {
            currency,
            siteCode,
            cartSite: currentCart.site,
            cartId: currentCart.id,
          });
          return;
        }

        const cartCurrency = currentCart.currency || currentCart.totalPrice?.currency;
        if (cartCurrency && cartCurrency !== currency) {
          await get().updateCurrency(currency);
        }

        // Clear stale intent once currencies converge.
        set({ pendingCurrencySync: null });
      },

      flushPendingCurrencySync: async () => {
        const pendingCurrencySync = get().pendingCurrencySync;
        if (!pendingCurrencySync) {
          return;
        }

        set({ pendingCurrencySync: null });
        await get().syncCurrencyWithSession(pendingCurrencySync.currency, pendingCurrencySync.siteCode);
      },

      beginSettling: (reason?: string) => {
        _settlingCount += 1;
        devSyncLog('cart-store: beginSettling', { reason, count: _settlingCount });
        if (_settlingCount === 1 && !get().isSettling) {
          set({ isSettling: true });
        }
      },

      endSettling: (reason?: string) => {
        if (_settlingCount <= 0) {
          _settlingCount = 0;
          getLogger().warn({ reason }, 'cart-store: endSettling called without matching beginSettling — clamping at 0');
          if (get().isSettling) {
            set({ isSettling: false });
          }
          return;
        }
        _settlingCount -= 1;
        devSyncLog('cart-store: endSettling', { reason, count: _settlingCount });
        if (_settlingCount === 0 && get().isSettling) {
          set({ isSettling: false });
        }
      },
    })),
  );
};
