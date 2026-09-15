'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  addItemToCart as apiAddItemToCart,
  applyCartDiscount as apiApplyCartDiscount,
  createCart as apiCreateCart,
  fetchCurrentCart as apiFetchCurrentCart,
  removeCartDiscount as apiRemoveCartDiscount,
  removeCartItem as apiRemoveCartItem,
  updateCartCurrency as apiUpdateCartCurrency,
  updateCartItemQuantity as apiUpdateCartItemQuantity,
  updateShippingInfo as apiUpdateShippingInfo,
  updateShippingMethod as apiUpdateShippingMethod,
  clearCartSession,
  loadSavedCart,
} from '@/lib/client/carts';
import { devSyncLog } from '@/lib/client/dev-sync-log';
import { getLogger } from '@/lib/logger/use-logger-client';
import type {
  CartShippingAddress,
  CartShippingMethodSelection,
  ModifyCartItemResult,
} from '@/platform/services/cart/CartService';
import type { Cart } from '@/platform/services/model/cart/cart';

export interface CartState {
  // Cart data, null means no cart, undefined means unknown state
  currentCart: Cart | null | undefined;
  loading: boolean;
  error: Error | null;
  lastShippingUpdate: {
    cartId?: string;
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
  fetchCart: (createCurrent?: boolean, options?: { quiet?: boolean }) => Promise<Cart | null | undefined>;
  addToCart: (productId: string, quantity: number, _retryCount?: number) => Promise<ModifyCartItemResult>;
  updateItemQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  updateShippingInfo: (shippingAddress: CartShippingAddress, billingAddress?: CartShippingAddress) => Promise<void>;
  updateShippingMethod: (method: CartShippingMethodSelection) => Promise<void>;
  applyDiscount: (code: string) => Promise<void>;
  removeDiscount: (discountIndex: number) => Promise<void>;
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
const SHIPPING_UPDATE_DEBOUNCE_MS = 2000;

function shouldSkipShippingUpdate(
  lastShippingUpdate: CartState['lastShippingUpdate'],
  cartId: string | undefined,
  shippingAddress: CartShippingAddress,
): boolean {
  if (!cartId || !lastShippingUpdate) {
    return false;
  }
  return (
    lastShippingUpdate.cartId === cartId &&
    lastShippingUpdate.country === shippingAddress.country &&
    lastShippingUpdate.zipCode === shippingAddress.zipCode &&
    Date.now() - lastShippingUpdate.timestamp < SHIPPING_UPDATE_DEBOUNCE_MS
  );
}

async function waitForInFlightCart(
  currentCart: Cart | null | undefined,
  fetchPromise: Promise<Cart | null | undefined> | null,
  readCart: () => Cart | null | undefined,
): Promise<Cart | null | undefined> {
  if (currentCart !== undefined && currentCart !== null) {
    return currentCart;
  }
  if (fetchPromise === null) {
    return currentCart;
  }
  await fetchPromise;
  return readCart();
}

async function createCartOrRetryAdd(args: {
  lastSiteCode: string | null;
  retryCount: number;
  fetchExisting: () => Promise<Cart | null | undefined>;
  retry: () => Promise<ModifyCartItemResult>;
}): Promise<{ kind: 'cart'; cart: Cart } | { kind: 'result'; result: ModifyCartItemResult }> {
  try {
    const cart = await apiCreateCart({
      ...(args.lastSiteCode ? { siteCode: args.lastSiteCode } : {}),
    });
    return { kind: 'cart', cart };
  } catch (err) {
    if (args.retryCount < 1) {
      const fetched = await args.fetchExisting();
      if (fetched) {
        return { kind: 'result', result: await args.retry() };
      }
    }
    throw err;
  }
}

async function realignCartToSessionSite(args: {
  cart: Cart;
  lastSiteCode: string | null;
  fetchAligned: () => Promise<Cart | null | undefined>;
}): Promise<Cart> {
  const { cart, lastSiteCode, fetchAligned } = args;
  if (!lastSiteCode || !cart.site || cart.site === lastSiteCode) {
    return cart;
  }
  getLogger().warn(
    { cartSite: cart.site, sessionSite: lastSiteCode },
    'Cart-site mismatch detected on client — clearing stale cart and re-resolving',
  );
  const aligned = await fetchAligned();
  if (!aligned) {
    throw new Error('Failed to get correct site cart');
  }
  return aligned;
}

async function commitAddedCartItem(args: {
  cartId: string;
  productId: string;
  quantity: number;
  setCart: (cart: Cart) => void;
  refetch: () => Promise<unknown>;
}): Promise<ModifyCartItemResult> {
  const result = await apiAddItemToCart(args.cartId, args.productId, args.quantity);
  if (result.cart) {
    args.setCart(result.cart);
  } else {
    await args.refetch();
  }
  return result;
}

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
  /**
   * Serializes cart mutations that publish `currentCart` (shipping, discounts,
   * line items, currency) so a slower in-flight response cannot overwrite a newer snapshot.
   */
  let _cartMutationGate: Promise<void> = Promise.resolve();
  /** Settling counter kept outside state so only 0→1 / N→0 transitions notify subscribers. */
  let _settlingCount = 0;

  const enqueueCartMutation = async <T>(work: () => Promise<T>): Promise<T> => {
    const afterPrevious = _cartMutationGate;
    let releaseNext!: () => void;
    _cartMutationGate = new Promise<void>((resolve) => {
      releaseNext = resolve;
    });
    await afterPrevious.catch(() => {});
    try {
      return await work();
    } finally {
      releaseNext();
    }
  };

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
      fetchCart: async (_createCurrent: boolean = false, options?: { quiet?: boolean }) => {
        if (_fetchPromise) {
          return _fetchPromise;
        }

        let thisPromise: Promise<Cart | null | undefined> | null = null;

        const currentFetchPromise = (async () => {
          try {
            set(options?.quiet ? { error: null } : { loading: true, error: null });

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
        const attempt = async (retryCount: number): Promise<ModifyCartItemResult> => {
          const { lastSiteCode } = get();
          let currentCart = await waitForInFlightCart(get().currentCart, _fetchPromise, () => get().currentCart);

          if (!currentCart) {
            try {
              const created = await createCartOrRetryAdd({
                lastSiteCode,
                retryCount,
                fetchExisting: async () => {
                  _fetchPromise = null;
                  return get().fetchCart();
                },
                retry: () => attempt(retryCount + 1),
              });
              if (created.kind === 'result') {
                return created.result;
              }
              set({ currentCart: created.cart, loading: false });
              currentCart = created.cart;
            } catch (err) {
              const error = err instanceof Error ? err : new Error('Failed to create cart');
              set({ error, loading: false });
              getLogger().error({ err }, 'Error creating cart before add-to-cart');
              throw err;
            }
          }

          currentCart = await realignCartToSessionSite({
            cart: currentCart,
            lastSiteCode,
            fetchAligned: async () => {
              _fetchPromise = null;
              set({ currentCart: null, loading: true, error: null });
              await get().fetchCart();
              return get().currentCart;
            },
          });

          set({ loading: true, error: null });
          try {
            return await commitAddedCartItem({
              cartId: currentCart.id,
              productId,
              quantity,
              setCart: (cart) => set({ currentCart: cart, loading: false }),
              refetch: () => get().fetchCart(),
            });
          } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to add item to cart');
            set({ error, loading: false });
            getLogger().error({ err }, 'Error adding item to cart');
            throw err;
          }
        };

        return enqueueCartMutation(() => attempt(_retryCount));
      },

      updateItemQuantity: async (itemId: string, quantity: number) => {
        await enqueueCartMutation(async () => {
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
        });
      },

      removeItem: async (itemId: string) => {
        await enqueueCartMutation(async () => {
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
        });
      },

      updateShippingInfo: async (shippingAddress: CartShippingAddress, billingAddress?: CartShippingAddress) => {
        await enqueueCartMutation(async () => {
          try {
            let cart = get().currentCart;
            if (!cart) {
              await get().fetchCart();
              cart = get().currentCart;
            }
            if (!cart) {
              set({ loading: false });
              return;
            }

            // Debounce after the real cart id is known. Same country+zip on a
            // *new* cart must still PATCH (leftover ship-to after approval/quote).
            if (shouldSkipShippingUpdate(get().lastShippingUpdate, cart.id, shippingAddress)) {
              return;
            }

            await apiUpdateShippingInfo(cart.id, shippingAddress, billingAddress);
            set({
              error: null,
              lastShippingUpdate: {
                cartId: cart.id,
                country: shippingAddress.country,
                zipCode: shippingAddress.zipCode,
                timestamp: Date.now(),
              },
            });

            await get().fetchCart(false, { quiet: true });
          } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to update shipping info');
            set({ error, loading: false });
            getLogger().error({ err }, 'Error updating shipping info');
          }
        });
      },

      updateShippingMethod: async (method: CartShippingMethodSelection) => {
        await enqueueCartMutation(async () => {
          try {
            const { currentCart } = get();
            if (!currentCart) {
              return;
            }

            // Do not flip `loading` — checkout and the header total should keep showing
            // the previous snapshot until the refreshed cart arrives.
            const updatedCart = await apiUpdateShippingMethod(currentCart.id, method);
            set({ currentCart: updatedCart, error: null });
          } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to update shipping method');
            set({ error });
            getLogger().error({ err }, 'Error updating shipping method');
          }
        });
      },

      applyDiscount: async (code: string) => {
        await enqueueCartMutation(async () => {
          try {
            const { currentCart } = get();
            if (!currentCart) {
              return;
            }

            // Do not flip `loading` — checkout must keep the previous cart snapshot
            // so a field error can show without a global spinner.
            const updatedCart = await apiApplyCartDiscount(currentCart.id, code);
            set({ currentCart: updatedCart, error: null });
          } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to apply cart discount');
            set({ error });
            getLogger().error({ err, cartId: get().currentCart?.id }, 'Error applying cart discount');
            throw error;
          }
        });
      },

      removeDiscount: async (discountIndex: number) => {
        await enqueueCartMutation(async () => {
          try {
            const { currentCart } = get();
            if (!currentCart) {
              return;
            }

            // Do not flip `loading` — same contract as updateShippingMethod / applyDiscount.
            const updatedCart = await apiRemoveCartDiscount(currentCart.id, discountIndex);
            set({ currentCart: updatedCart, error: null });
          } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to remove cart discount');
            set({ error });
            getLogger().error({ err, cartId: get().currentCart?.id }, 'Error removing cart discount');
            throw error;
          }
        });
      },

      updateCurrency: async (currency: string) => {
        await enqueueCartMutation(async () => {
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
        });
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
