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
import { removableCartDiscountIndexes } from '@/lib/common/applied-promo-display';
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
  /**
   * True while a cart write is queued or in flight. Promo apply/remove use
   * `runCartSnapshotMutation` and do not flip `loading` — checkout submit must read this.
   */
  mutating: boolean;
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

/** State patch shared by every cart reset (auth, site, legal-entity change, `clearCart`). */
const CART_RESET_PATCH: Partial<CartState> = {
  currentCart: null,
  error: null,
  lastShippingUpdate: null,
  pendingCurrencySync: null,
};

/**
 * Serializes cart mutations that publish `currentCart` (shipping, discounts, line items,
 * currency) so a slower in-flight response cannot overwrite a newer snapshot.
 *
 * It also tracks a reset *epoch*: every cart reset (`clearCart`, auth/site/legal-entity change)
 * bumps it, and a mutation that started under an older epoch must not write state anymore —
 * otherwise a delayed response could resurrect the cart that was just cleared.
 */
class CartMutationQueue {
  private tail: Promise<void> = Promise.resolve();
  private inFlight = 0;
  private epoch = 0;
  private onBusyChange?: (busy: boolean) => void;

  /** True while any mutation is queued or running. */
  get isBusy(): boolean {
    return this.inFlight > 0;
  }

  onBusy(listener: (busy: boolean) => void): void {
    this.onBusyChange = listener;
  }

  private notifyBusy(): void {
    this.onBusyChange?.(this.inFlight > 0);
  }

  get currentEpoch(): number {
    return this.epoch;
  }

  /** Marks every mutation and fetch that already started as stale. */
  invalidate(): void {
    this.epoch += 1;
  }

  isCurrent(epoch: number): boolean {
    return epoch === this.epoch;
  }

  /** Resolves once every mutation enqueued so far has released the gate. */
  whenIdle(): Promise<void> {
    return this.tail;
  }

  /** `work` receives the epoch seen when it was enqueued and the one seen when it actually started. */
  async run<T>(work: (epochs: { enqueued: number; started: number }) => Promise<T>): Promise<T> {
    const enqueued = this.epoch;
    const afterPrevious = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.inFlight += 1;
    this.notifyBusy();
    await afterPrevious;
    try {
      return await work({ enqueued, started: this.epoch });
    } finally {
      this.inFlight -= 1;
      this.notifyBusy();
      release();
    }
  }
}

/** Thrown when a cart write is abandoned because the cart was reset while it was in flight. */
export class CartMutationCancelledError extends Error {
  constructor(operation: string, options?: ErrorOptions) {
    super(`Cart ${operation} cancelled: the cart was reset while the request was in flight`, options);
    this.name = 'CartMutationCancelledError';
  }
}

/** Epoch-bound helpers handed to each mutation body. */
interface CartMutationContext {
  get: () => CartStore;
  /** True when a reset happened between enqueueing and starting; id-bound writes must bail out. */
  resetWhileQueued: boolean;
  /** False once the cart was reset after this mutation started. */
  isCurrent: () => boolean;
  /** `set` that is silently dropped when the cart was reset after this mutation started. */
  commit: (patch: Partial<CartState>) => void;
  /** Waits for a deduped in-flight `fetchCart` (if any), then reads the cart. */
  awaitInFlightFetch: () => Promise<Cart | null | undefined>;
  /**
   * Epoch-guarded `fetchCart` that returns the cart now in state. `fresh` drops the dedupe
   * promise first so a previous-site GET cannot short-circuit it.
   */
  refetch: (options?: { fresh?: boolean; quiet?: boolean }) => Promise<Cart | null | undefined>;
}

/** Closure-free dependencies for `runFetchCart`; bound per call by the store. */
interface FetchCartDeps {
  get: () => CartStore;
  set: (patch: Partial<CartState>) => void;
  /** False once a cart reset happened after this fetch was issued. */
  isCurrent: () => boolean;
  /** True once a mutation published a newer cart snapshot after this fetch was issued. */
  isSuperseded: () => boolean;
  /** Quiet fetches never set `loading: true`, so they must not clear it either. */
  quiet: boolean;
  /** Drops this fetch from the dedupe slot so a follow-up fetch issues a new GET. */
  releaseDedupe: () => void;
  drainPendingCurrencySync: () => Promise<void>;
}

const STALE_FETCH = Symbol('stale-fetch');

function toError(err: unknown, fallbackMessage: string): Error {
  return err instanceof Error ? err : new Error(fallbackMessage);
}

/** Guards a server write: a stale mutation must not touch the server-side cart anymore. */
function assertMutationCurrent(ctx: CartMutationContext, operation: string, cause?: unknown): void {
  if (!ctx.isCurrent()) {
    throw new CartMutationCancelledError(operation, cause === undefined ? undefined : { cause });
  }
}

/**
 * Drops a cart whose tenant disagrees with the Emporix session (`x-session-site-code` header)
 * or, when the header is missing, with the locally tracked `lastSiteCode`.
 */
function discardWrongSiteCart(
  cart: Cart | null | undefined,
  sessionSiteCode: string | null,
  expectedSite: string | null,
): Cart | null | undefined {
  if (!cart?.site) {
    return cart;
  }
  if (sessionSiteCode) {
    if (cart.site === sessionSiteCode) {
      return cart;
    }
    devSyncLog('cart-store: fetchCart discarding cart/session site mismatch', {
      cartSite: cart.site,
      sessionSiteCode,
      cartId: cart.id,
    });
    getLogger().warn(
      { cartSite: cart.site, sessionSiteCode },
      'fetchCart received cart whose site does not match session site — discarding',
    );
    return null;
  }
  if (expectedSite && cart.site !== expectedSite) {
    devSyncLog('cart-store: fetchCart discarding wrong-site cart (no session header)', {
      cartSite: cart.site,
      expectedSite,
      cartId: cart.id,
    });
    getLogger().warn({ cartSite: cart.site, expectedSite }, 'fetchCart received cart from wrong site — discarding');
    return null;
  }
  return cart;
}

function logFetchCartSnapshot(
  cart: Cart | null | undefined,
  sessionSiteCode: string | null,
  lastSiteCode: string | null,
) {
  try {
    getLogger().info(
      {
        event: 'fetch_cart_snapshot',
        cartId: cart?.id ?? null,
        site: cart?.site ?? null,
        currency: cart?.currency ?? cart?.totalPrice?.currency ?? null,
        sessionId: cart?.sessionId ?? null,
        sessionSiteCode,
        lastSiteCode,
      },
      'fetchCart: cart id, site, currency, session id, and session header (single snapshot)',
    );
  } catch {
    /* logging must never clear cart state */
  }
}

/**
 * GETs the cart and publishes it — unless a reset happened meanwhile (nothing is written) or a
 * mutation already published a newer snapshot (the older GET must not roll it back).
 */
async function resolveCurrentCart(deps: FetchCartDeps): Promise<Cart | null | undefined | typeof STALE_FETCH> {
  const response = await apiFetchCurrentCart().catch((err: unknown) => {
    // Cart is gone (or the GET failed): treat as "no cart" without surfacing an error.
    devSyncLog('cart-store: fetchCart failed — treating as no cart', { err });
    return null;
  });
  if (!deps.isCurrent()) {
    devSyncLog('cart-store: fetchCart dropped stale response after cart reset', {
      cartId: response?.cart?.id ?? null,
    });
    return STALE_FETCH;
  }
  if (deps.isSuperseded()) {
    devSyncLog('cart-store: fetchCart dropped GET superseded by a newer mutation snapshot', {
      cartId: response?.cart?.id ?? null,
    });
    if (!deps.quiet) {
      deps.set({ loading: false });
    }
    return STALE_FETCH;
  }
  if (response === null) {
    deps.set({ currentCart: null, loading: false });
    return null;
  }
  const cartData = discardWrongSiteCart(response.cart, response.sessionSiteCode, deps.get().lastSiteCode);
  deps.set({ currentCart: cartData, loading: false });
  logFetchCartSnapshot(cartData, response.sessionSiteCode, deps.get().lastSiteCode);
  return cartData;
}

/**
 * Read the current cart. Never creates. Responses that arrive after a cart reset are dropped so a
 * refetch issued by an older mutation cannot resurrect a cleared cart.
 */
async function runFetchCart(deps: FetchCartDeps, options?: { quiet?: boolean }): Promise<Cart | null | undefined> {
  try {
    deps.set(options?.quiet ? { error: null } : { loading: true, error: null });
    const outcome = await resolveCurrentCart(deps);
    if (outcome === STALE_FETCH) {
      return deps.get().currentCart;
    }
    deps.releaseDedupe();
    await deps.drainPendingCurrencySync();
    return outcome;
  } catch (err) {
    getLogger().error({ err }, 'Error fetching cart');
    if (deps.isCurrent()) {
      deps.set({ error: toError(err, 'Failed to fetch cart'), loading: false });
    }
    deps.releaseDedupe();
    await deps.drainPendingCurrencySync();
    return undefined;
  }
}

function matchesPendingSync(
  pending: CartState['pendingCurrencySync'],
  currency: string,
  siteCode: string,
): pending is NonNullable<CartState['pendingCurrencySync']> {
  return pending?.currency === currency && pending.siteCode === siteCode;
}

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

type EnsuredCart = { kind: 'cart'; cart: Cart } | { kind: 'result'; result: ModifyCartItemResult };

/** Creates the cart explicitly (`POST /api/cart`); on failure re-resolves once and retries the add. */
async function ensureCartForAdd(
  ctx: CartMutationContext,
  retryCount: number,
  retry: () => Promise<ModifyCartItemResult>,
): Promise<EnsuredCart> {
  const { lastSiteCode } = ctx.get();
  assertMutationCurrent(ctx, 'create');
  try {
    const cart = await apiCreateCart({
      ...(lastSiteCode ? { siteCode: lastSiteCode } : {}),
    });
    ctx.commit({ currentCart: cart, loading: false });
    return { kind: 'cart', cart };
  } catch (err) {
    assertMutationCurrent(ctx, 'create', err);
    if (retryCount < 1) {
      const existing = await ctx.refetch({ fresh: true });
      assertMutationCurrent(ctx, 'create', err);
      if (existing) {
        return { kind: 'result', result: await retry() };
      }
    }
    ctx.commit({ error: toError(err, 'Failed to create cart'), loading: false });
    getLogger().error({ err }, 'Error creating cart before add-to-cart');
    throw err;
  }
}

async function realignCartToSessionSite(ctx: CartMutationContext, cart: Cart): Promise<Cart> {
  const { lastSiteCode } = ctx.get();
  if (!lastSiteCode || !cart.site || cart.site === lastSiteCode) {
    return cart;
  }
  getLogger().warn(
    { cartSite: cart.site, sessionSite: lastSiteCode },
    'Cart-site mismatch detected on client — clearing stale cart and re-resolving',
  );
  ctx.commit({ currentCart: null, loading: true, error: null });
  const aligned = await ctx.refetch({ fresh: true });
  if (!aligned) {
    assertMutationCurrent(ctx, 'add-to-cart');
    throw new Error('Failed to get correct site cart');
  }
  return aligned;
}

/**
 * Add an item to the cart. Creates the cart if missing and re-resolves via `fetchCart` when
 * the existing cart belongs to the wrong site.
 */
async function runAddToCart(
  ctx: CartMutationContext,
  productId: string,
  quantity: number,
  retryCount: number,
): Promise<ModifyCartItemResult> {
  let currentCart = ctx.get().currentCart ?? (await ctx.awaitInFlightFetch());

  if (!currentCart) {
    const ensured = await ensureCartForAdd(ctx, retryCount, () =>
      runAddToCart(ctx, productId, quantity, retryCount + 1),
    );
    if (ensured.kind === 'result') {
      return ensured.result;
    }
    currentCart = ensured.cart;
  }

  currentCart = await realignCartToSessionSite(ctx, currentCart);
  assertMutationCurrent(ctx, 'add-to-cart');

  ctx.commit({ loading: true, error: null });
  try {
    const result = await apiAddItemToCart(currentCart.id, productId, quantity);
    if (result.cart) {
      ctx.commit({ currentCart: result.cart, loading: false });
    } else {
      await ctx.refetch();
    }
    return result;
  } catch (err) {
    ctx.commit({ error: toError(err, 'Failed to add item to cart'), loading: false });
    getLogger().error({ err }, 'Error adding item to cart');
    throw err;
  }
}

/**
 * Empty carts still keep applied coupons on the platform, which then block currency
 * changes and cannot be edited on the "Oh no" empty-cart screen (COP-4815 QA).
 */
async function stripOrphanCouponsAfterEmptyCart(ctx: CartMutationContext): Promise<void> {
  const emptied = ctx.get().currentCart;
  if (!emptied || emptied.items.length > 0 || !emptied.discounts?.length || !ctx.isCurrent()) {
    return;
  }
  const indexes = removableCartDiscountIndexes(emptied.discounts);
  for (const discountIndex of indexes) {
    if (!ctx.isCurrent()) {
      return;
    }
    await apiRemoveCartDiscount(emptied.id, discountIndex);
  }
  await ctx.refetch();
}

/**
 * Line-item write whose fresh state comes from a follow-up `fetchCart`. Item ids belong to the
 * cart that was current when the user acted, so a reset while queued cancels the write.
 */
async function runLineItemMutation(
  ctx: CartMutationContext,
  args: { call: (cartId: string) => Promise<unknown>; failureMessage: string; logMessage: string },
): Promise<void> {
  if (ctx.resetWhileQueued) {
    return;
  }
  const cart = ctx.get().currentCart ?? (await ctx.refetch());
  if (!ctx.isCurrent()) {
    return;
  }
  if (!cart) {
    throw new Error('No cart available');
  }
  try {
    ctx.commit({ loading: true, error: null });
    await args.call(cart.id);
    await ctx.refetch();
    await stripOrphanCouponsAfterEmptyCart(ctx);
  } catch (err) {
    ctx.commit({ error: toError(err, args.failureMessage), loading: false });
    getLogger().error({ err }, args.logMessage);
    throw err;
  }
}

function runUpdateItemQuantity(ctx: CartMutationContext, itemId: string, quantity: number): Promise<void> {
  return runLineItemMutation(ctx, {
    call: (cartId) => apiUpdateCartItemQuantity(cartId, itemId, quantity),
    failureMessage: 'Failed to update cart item',
    logMessage: 'Error updating cart item',
  });
}

function runRemoveItem(ctx: CartMutationContext, itemId: string): Promise<void> {
  return runLineItemMutation(ctx, {
    call: (cartId) => apiRemoveCartItem(cartId, itemId),
    failureMessage: 'Failed to remove cart item',
    logMessage: 'Error removing cart item',
  });
}

/**
 * Write whose response already carries the refreshed cart snapshot. Does not flip `loading` —
 * checkout and the header total keep the previous snapshot until the new one arrives, so a
 * field error can show without a global spinner.
 */
async function runCartSnapshotMutation(
  ctx: CartMutationContext,
  args: {
    call: (cartId: string) => Promise<Cart>;
    failureMessage: string;
    logMessage: string;
    rethrow?: boolean;
    /**
     * Set for writes whose intent belongs to the cart the shopper was looking at (discount index,
     * shipping method, coupon code) — never replay them against a cart re-resolved by a reset.
     */
    cancelIfResetWhileQueued?: boolean;
  },
): Promise<void> {
  if (args.cancelIfResetWhileQueued && ctx.resetWhileQueued) {
    return;
  }
  const { currentCart } = ctx.get();
  if (!currentCart) {
    return;
  }
  try {
    const updatedCart = await args.call(currentCart.id);
    ctx.commit({ currentCart: updatedCart, error: null });
  } catch (err) {
    const error = toError(err, args.failureMessage);
    ctx.commit({ error });
    getLogger().error({ err, cartId: currentCart.id }, args.logMessage);
    if (args.rethrow) {
      throw error;
    }
  }
}

function runUpdateShippingMethod(ctx: CartMutationContext, method: CartShippingMethodSelection): Promise<void> {
  return runCartSnapshotMutation(ctx, {
    call: (cartId) => apiUpdateShippingMethod(cartId, method),
    failureMessage: 'Failed to update shipping method',
    logMessage: 'Error updating shipping method',
    cancelIfResetWhileQueued: true,
  });
}

function runApplyDiscount(ctx: CartMutationContext, code: string): Promise<void> {
  return runCartSnapshotMutation(ctx, {
    call: (cartId) => apiApplyCartDiscount(cartId, code),
    failureMessage: 'Failed to apply cart discount',
    logMessage: 'Error applying cart discount',
    rethrow: true,
    cancelIfResetWhileQueued: true,
  });
}

function runRemoveDiscount(ctx: CartMutationContext, discountIndex: number): Promise<void> {
  return runCartSnapshotMutation(ctx, {
    call: (cartId) => apiRemoveCartDiscount(cartId, discountIndex),
    failureMessage: 'Failed to remove cart discount',
    logMessage: 'Error removing cart discount',
    rethrow: true,
    cancelIfResetWhileQueued: true,
  });
}

async function runUpdateShippingInfo(
  ctx: CartMutationContext,
  shippingAddress: CartShippingAddress,
  billingAddress?: CartShippingAddress,
): Promise<void> {
  // The address belongs to the checkout the shopper was in; a reset re-resolves the cart
  // (other session/site) and checkout re-sends its own address for that cart.
  if (ctx.resetWhileQueued) {
    return;
  }
  try {
    const cart = ctx.get().currentCart ?? (await ctx.refetch());
    if (!cart) {
      ctx.commit({ loading: false });
      return;
    }

    // Debounce after the real cart id is known. Same country+zip on a
    // *new* cart must still PATCH (leftover ship-to after approval/quote).
    if (shouldSkipShippingUpdate(ctx.get().lastShippingUpdate, cart.id, shippingAddress) || !ctx.isCurrent()) {
      return;
    }

    await apiUpdateShippingInfo(cart.id, shippingAddress, billingAddress);
    ctx.commit({
      error: null,
      lastShippingUpdate: {
        cartId: cart.id,
        country: shippingAddress.country,
        zipCode: shippingAddress.zipCode,
        timestamp: Date.now(),
      },
    });

    await ctx.refetch({ quiet: true });
  } catch (err) {
    ctx.commit({ error: toError(err, 'Failed to update shipping info'), loading: false });
    getLogger().error({ err }, 'Error updating shipping info');
  }
}

/**
 * Currency is session-scoped intent, not bound to a cart id: a reprice queued before a reset
 * must still reach the re-resolved cart (`syncCurrencyWithSession` clears its pending intent once
 * this runs), so — unlike id-bound writes — `resetWhileQueued` is deliberately not a cancel here.
 */
async function runUpdateCurrency(ctx: CartMutationContext, currency: string): Promise<void> {
  try {
    const cart = ctx.get().currentCart ?? (await ctx.refetch());
    if (!cart || !ctx.isCurrent()) {
      return;
    }
    ctx.commit({ loading: true, error: null });
    await apiUpdateCartCurrency(cart.id, currency);
    await ctx.refetch();
  } catch (err) {
    ctx.commit({ error: toError(err, 'Failed to update cart currency'), loading: false });
    getLogger().error({ err }, 'Error updating cart currency');
  }
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
  mutating: false,
};

export const createCartStore = (initState: CartState = defaultState) => {
  /** Dedupes concurrent `fetchCart` calls; kept outside state to avoid re-renders. */
  let _fetchPromise: Promise<Cart | null | undefined> | null = null;
  const _mutations = new CartMutationQueue();
  /**
   * Bumped whenever a mutation publishes `currentCart`. `fetchCart` is not serialized behind the
   * mutation gate, so a GET issued before the bump must not overwrite that newer snapshot — and
   * a refetch issued after the bump must not dedupe onto that older GET either.
   */
  let _snapshotVersion = 0;
  /** Snapshot version the deduped `_fetchPromise` was issued under. */
  let _fetchPromiseVersion = 0;
  /** Settling counter kept outside state so only 0→1 / N→0 transitions notify subscribers. */
  let _settlingCount = 0;

  return create<CartStore>()(
    subscribeWithSelector((set, get) => {
      _mutations.onBusy((busy) => {
        if (get().mutating !== busy) {
          set({ mutating: busy });
        }
      });
      const createMutationContext = ({
        enqueued,
        started: epoch,
      }: {
        enqueued: number;
        started: number;
      }): CartMutationContext => ({
        get,
        resetWhileQueued: enqueued !== epoch,
        isCurrent: () => _mutations.isCurrent(epoch),
        commit: (patch) => {
          if (_mutations.isCurrent(epoch)) {
            if ('currentCart' in patch) {
              _snapshotVersion += 1;
            }
            set(patch);
            return;
          }
          devSyncLog('cart-store: dropped stale mutation commit after cart reset', {
            epoch,
            keys: Object.keys(patch),
          });
        },
        awaitInFlightFetch: async () => {
          if (_fetchPromise !== null) {
            await _fetchPromise;
          }
          return get().currentCart;
        },
        refetch: async (options) => {
          if (!_mutations.isCurrent(epoch)) {
            return get().currentCart;
          }
          if (options?.fresh) {
            _fetchPromise = null;
          }
          await get().fetchCart(false, options?.quiet ? { quiet: true } : undefined);
          return get().currentCart;
        },
      });

      /** Runs `work` behind the mutation gate with an epoch-bound context. */
      const runMutation = <A extends unknown[], T>(
        work: (ctx: CartMutationContext, ...args: A) => Promise<T>,
        ...args: A
      ): Promise<T> => _mutations.run((epochs) => work(createMutationContext(epochs), ...args));

      /** Bumps the mutation epoch, drops the fetch dedupe and clears cart state before a re-resolve. */
      const resetCart = (patch: Partial<CartState>) => {
        _mutations.invalidate();
        _fetchPromise = null;
        set({ ...CART_RESET_PATCH, ...patch });
      };

      /**
       * Flushes a deferred currency sync after `fetchCart`. When a mutation holds the gate (the
       * fetch was issued from inside it) the flush would re-enter `updateCurrency` and deadlock
       * on that same gate, so it is drained once the queue is idle instead of being awaited.
       */
      const drainPendingCurrencySync = async (): Promise<void> => {
        if (!get().pendingCurrencySync) {
          return;
        }
        if (!_mutations.isBusy) {
          await get().flushPendingCurrencySync();
          return;
        }
        void _mutations
          .whenIdle()
          .then(() => get().flushPendingCurrencySync())
          .catch((err) => getLogger().error({ err }, 'Deferred currency sync after cart mutation failed'));
      };

      const addToCartOnce = (productId: string, quantity: number, createRetryCount: number) =>
        runMutation(runAddToCart, productId, quantity, createRetryCount);

      return {
        ...initState,
        validateCart: async (newSessionStatus: string) => {
          const { sessionStatus } = get();
          if (sessionStatus !== newSessionStatus) {
            set({ sessionStatus: newSessionStatus });
            // Only clear cart on actual auth transitions (not initial mount)
            // On first mount, sessionStatus is null — this is initialization, not an auth change
            if (sessionStatus !== null) {
              resetCart({ loading: true });
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
          resetCart({ lastSiteCode: newSiteCode, loading: true });
          await get().fetchCart();
        },
        validateLegalEntity: async (newLegalEntityId: string | undefined) => {
          const normalized = newLegalEntityId?.trim() ?? '';
          const { lastLegalEntityId } = get();
          if (lastLegalEntityId !== null && lastLegalEntityId !== normalized) {
            resetCart({ lastLegalEntityId: normalized, loading: true });
            await get().fetchCart();
          } else if (lastLegalEntityId === null) {
            set({ lastLegalEntityId: normalized });
            // First bound session legal entity (e.g. B2B company selection): re-resolve cart server-side
            // so we never keep a cart from another company or from before LE context existed.
            if (normalized !== '') {
              resetCart({ loading: true });
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
         * session's `x-session-site-code` header or the local `lastSiteCode`, and drops responses
         * that arrive after a cart reset or after a mutation published a newer snapshot.
         * `_createCurrent` is retained for API compatibility and
         * ignored. When a mutation holds the gate, a pending currency reprice is drained after the
         * gate releases rather than awaited here (see `drainPendingCurrencySync`).
         */
        fetchCart: (_createCurrent: boolean = false, options?: { quiet?: boolean }) => {
          if (_fetchPromise !== null && _fetchPromiseVersion === _snapshotVersion) {
            return _fetchPromise;
          }
          const fetchEpoch = _mutations.currentEpoch;
          const fetchSnapshotVersion = _snapshotVersion;
          let thisPromise: Promise<Cart | null | undefined> | null = null;
          const releaseDedupe = () => {
            if (_fetchPromise === thisPromise) {
              _fetchPromise = null;
            }
          };
          thisPromise = runFetchCart(
            {
              get,
              set,
              isCurrent: () => _mutations.isCurrent(fetchEpoch),
              isSuperseded: () => _snapshotVersion !== fetchSnapshotVersion,
              quiet: options?.quiet === true,
              releaseDedupe,
              drainPendingCurrencySync,
            },
            options,
          );
          _fetchPromise = thisPromise;
          _fetchPromiseVersion = fetchSnapshotVersion;
          void thisPromise.finally(releaseDedupe);
          return thisPromise;
        },

        loadCart: async (cartId: string, type: string = 'shopping') => {
          try {
            set({ loading: true, error: null });

            // Try to fetch existing cart
            try {
              const cartData = await loadSavedCart(cartId, type);
              set({ currentCart: cartData, loading: false });
              return cartData;
            } catch (err) {
              // Silent error when cart is gone
              devSyncLog('cart-store: loadCart failed — treating as no cart', { cartId, type, err });
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

        // Every write below runs behind the mutation gate; see `CartMutationQueue`.
        /**
         * A cart reset mid-add cancels the write against the old cart. The click is still valid
         * user intent, so retry once against the re-resolved cart; a second reset surfaces the
         * `CartMutationCancelledError` to the caller.
         */
        addToCart: (productId: string, quantity: number, _retryCount = 0) =>
          addToCartOnce(productId, quantity, _retryCount).catch((err: unknown) => {
            if (!(err instanceof CartMutationCancelledError)) {
              throw err;
            }
            devSyncLog('cart-store: addToCart retried after cart reset', { productId, quantity });
            return addToCartOnce(productId, quantity, _retryCount);
          }),
        updateItemQuantity: (itemId: string, quantity: number) => runMutation(runUpdateItemQuantity, itemId, quantity),
        removeItem: (itemId: string) => runMutation(runRemoveItem, itemId),
        updateShippingInfo: (shippingAddress: CartShippingAddress, billingAddress?: CartShippingAddress) =>
          runMutation(runUpdateShippingInfo, shippingAddress, billingAddress),
        updateShippingMethod: (method: CartShippingMethodSelection) => runMutation(runUpdateShippingMethod, method),
        applyDiscount: (code: string) => runMutation(runApplyDiscount, code),
        removeDiscount: (discountIndex: number) => runMutation(runRemoveDiscount, discountIndex),
        updateCurrency: (currency: string) => runMutation(runUpdateCurrency, currency),

        clearCart: (options?: { deleteCart?: boolean; clearSession?: boolean }) => {
          const { deleteCart = false, clearSession = true } = options ?? {};
          resetCart({ loading: false, lastSiteCode: null, lastLegalEntityId: null });
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
            const isSameIntent = matchesPendingSync(pendingCurrencySync, currency, siteCode);
            if (isSameIntent && pendingCurrencySync.attempts >= MAX_PENDING_CURRENCY_SYNC_RETRIES) {
              getLogger().warn(
                { currency, siteCode, attempts: pendingCurrencySync.attempts },
                'Dropping pending currency sync after max retries',
              );
              return;
            }

            const nextAttempts = isSameIntent ? pendingCurrencySync.attempts + 1 : 1;
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
            getLogger().warn(
              { reason },
              'cart-store: endSettling called without matching beginSettling — clamping at 0',
            );
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
      };
    }),
  );
};
