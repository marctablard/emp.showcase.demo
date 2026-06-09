import { updateSessionContext } from '@/lib/client/session';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Cart } from '@/platform/services/model/cart/cart';
import type { Session } from '@/platform/services/model/session/session';
import type { SiteSwitchStores } from './site-switch';
import { NAVIGATION_REFRESH_DELAY_MS, performSiteSwitch } from './site-switch';

jest.mock('@/lib/client/session', () => ({
  updateSessionContext: jest.fn(),
}));

// Mocked so the regression suite below (which uses the real `createCartStore`) can
// intercept `apiFetchCurrentCart` without hitting the network. The earlier suites build
// a fully-faked cart state and never call through, so this mock is a no-op for them.
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
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  }),
}));

const mockedUpdateSessionContext = updateSessionContext as jest.Mock;

type SessionStoreState = {
  session: Partial<Session> | null | undefined;
  tryAcquireMutationLock: jest.Mock<boolean, []>;
  releaseMutationLock: jest.Mock<void, []>;
  setSession: jest.Mock<void, [unknown]>;
  setLoading: jest.Mock<void, [boolean]>;
};

type SiteStoreState = {
  resetSite: jest.Mock<void, []>;
  getSite: jest.Mock<{ code: string } | null | undefined, []>;
};

type CartStoreState = {
  beginSettling: jest.Mock<void, [string?]>;
  endSettling: jest.Mock<void, [string?]>;
  clearCart: jest.Mock<void, [unknown?]>;
  validateSite: jest.Mock<Promise<void>, [string]>;
  fetchCart: jest.Mock<Promise<Cart | null | undefined>, []>;
  syncCurrencyWithSession: jest.Mock<Promise<void>, [string, string]>;
  setError: jest.Mock<void, [Error | null]>;
  currentCart?: Cart | null | undefined;
  loading?: boolean;
};

function createLogger(): jest.Mocked<LoggerService> {
  return {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  } as unknown as jest.Mocked<LoggerService>;
}

interface BuildStoresOptions {
  session?: Partial<Session> | null | undefined;
  lockAvailable?: boolean;
  siteInStore?: { code: string } | null | undefined;
  currentCart?: Cart | null | undefined;
  /** Cart the mocked `validateSite` should make visible on the cart state after resolving. */
  validateSiteResult?: Cart | null | undefined;
  /** When provided, the mocked `validateSite` rejects with this error. */
  validateSiteRejectsWith?: Error;
}

function buildStores(options: BuildStoresOptions = {}): {
  stores: SiteSwitchStores;
  sessionState: SessionStoreState;
  siteState: SiteStoreState;
  cartState: CartStoreState;
  cartSetState: jest.Mock;
} {
  const sessionState: SessionStoreState = {
    session: options.session ?? {
      siteCode: 'a',
      currency: 'EUR',
      language: 'en',
      metadata: { version: 3 },
    },
    tryAcquireMutationLock: jest.fn(() => options.lockAvailable !== false),
    releaseMutationLock: jest.fn(),
    setSession: jest.fn(),
    setLoading: jest.fn(),
  };
  const siteState: SiteStoreState = {
    resetSite: jest.fn(),
    getSite: jest.fn(() => options.siteInStore),
  };
  const cartState: CartStoreState = {
    beginSettling: jest.fn(),
    endSettling: jest.fn(),
    clearCart: jest.fn(),
    // `validateSite` is the orchestrator's canonical per-site cart reset + refetch path;
    // its production implementation nulls `_fetchPromise` and runs `fetchCart` internally.
    // The mock reflects the resolved cart the orchestrator should observe afterwards when
    // `validateSiteResult` is provided (via property mutation, matching how the real store
    // would have updated `currentCart` for the subsequent currency-reconcile check).
    validateSite: options.validateSiteRejectsWith
      ? jest.fn<Promise<void>, [string]>(() => Promise.reject(options.validateSiteRejectsWith as Error))
      : jest.fn<Promise<void>, [string]>(() => {
          if (Object.prototype.hasOwnProperty.call(options, 'validateSiteResult')) {
            cartState.currentCart = options.validateSiteResult;
          }
          return Promise.resolve();
        }),
    fetchCart: jest.fn<Promise<Cart | null | undefined>, []>(() => Promise.resolve(null)),
    syncCurrencyWithSession: jest.fn<Promise<void>, [string, string]>(() => Promise.resolve()),
    setError: jest.fn<void, [Error | null]>(),
    currentCart: options.currentCart,
    loading: false,
  };
  const cartSetState = jest.fn();
  const stores = {
    sessionStore: { getState: () => sessionState },
    siteStore: { getState: () => siteState },
    cartStore: { getState: () => cartState, setState: cartSetState },
  } as unknown as SiteSwitchStores;
  return { stores, sessionState, siteState, cartState, cartSetState };
}

describe('performSiteSwitch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('happy path', () => {
    it('user source: combined PATCH /api/session + GET /api/cart (per-site resolution) + navigate + scheduled refresh', async () => {
      const targetSiteCart = { id: 'cart-b', site: 'b', currency: 'EUR' } as Cart;
      const { stores, sessionState, siteState, cartState } = buildStores({
        session: {
          siteCode: 'a',
          currency: 'EUR',
          language: 'en',
          cartId: 'cart-1',
          metadata: { version: 3 },
        },
        currentCart: { id: 'cart-1', site: 'a', currency: 'EUR' } as Cart,
        validateSiteResult: targetSiteCart,
      });
      mockedUpdateSessionContext.mockResolvedValue({
        siteCode: 'b',
        currency: 'EUR',
        language: 'en',
        cartId: 'cart-1',
        metadata: { version: 4 },
      });

      const navigateTo = jest.fn();
      const getRedirectPath = jest.fn(() => '/b-path');
      const refresh = jest.fn();
      const getSiteByCode = jest.fn(() => Promise.resolve({ languages: ['en'], currencies: ['EUR'] }));
      const logger = createLogger();

      const result = await performSiteSwitch('b', stores, {
        source: 'user',
        locale: 'en',
        navigateTo,
        getRedirectPath,
        getSiteByCode,
        router: { refresh },
        logger,
      });

      expect(result).toEqual(expect.objectContaining({ success: true, upstreamCalls: 2 }));

      expect(sessionState.tryAcquireMutationLock).toHaveBeenCalledTimes(1);
      expect(cartState.beginSettling).toHaveBeenCalledWith('site-switch');
      expect(cartState.endSettling).toHaveBeenCalledWith('site-switch');
      expect(sessionState.releaseMutationLock).toHaveBeenCalledTimes(1);

      expect(mockedUpdateSessionContext).toHaveBeenCalledTimes(1);
      expect(mockedUpdateSessionContext).toHaveBeenCalledWith({ siteCode: 'b' }, 3);
      expect(sessionState.setSession).toHaveBeenCalledWith(
        expect.objectContaining({ siteCode: 'b', metadata: { version: 4 } }),
      );

      // Cart-per-site resolution: delegated to validateSite (which nulls the shared
      // _fetchPromise, clears currentCart/lastSiteCode, and kicks off a fresh fetchCart
      // for the target site).
      expect(cartState.validateSite).toHaveBeenCalledTimes(1);
      expect(cartState.validateSite).toHaveBeenCalledWith('b');

      expect(siteState.resetSite).toHaveBeenCalledTimes(1);

      expect(navigateTo).toHaveBeenCalledWith('/b-path');
      expect(refresh).not.toHaveBeenCalled();
      jest.advanceTimersByTime(NAVIGATION_REFRESH_DELAY_MS);
      expect(refresh).toHaveBeenCalledTimes(1);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'site_switch', outcome: 'success', upstreamCalls: 2 }),
        expect.any(String),
      );
    });

    it('anonymous (no cart): still issues a single GET /api/cart that resolves to null for new sites', async () => {
      const { stores, cartState } = buildStores({
        session: { siteCode: 'a', currency: 'EUR', language: 'en', metadata: { version: 1 } },
        currentCart: null,
        validateSiteResult: null,
      });
      mockedUpdateSessionContext.mockResolvedValue({
        siteCode: 'b',
        currency: 'EUR',
        language: 'en',
        metadata: { version: 2 },
      });

      const result = await performSiteSwitch('b', stores, {
        source: 'deep-link',
        getSiteByCode: () => Promise.resolve({ languages: ['en'], currencies: ['EUR'] }),
      });

      expect(result).toEqual(expect.objectContaining({ success: true, upstreamCalls: 2 }));
      expect(cartState.validateSite).toHaveBeenCalledTimes(1);
      expect(cartState.validateSite).toHaveBeenCalledWith('b');
    });
  });

  describe('guard rails', () => {
    it('same-site target is a no-op (no lock, no upstream calls)', async () => {
      const { stores, sessionState, cartState } = buildStores({
        session: { siteCode: 'a', currency: 'EUR' },
      });
      const logger = createLogger();

      const result = await performSiteSwitch('a', stores, { source: 'user', logger });

      expect(result).toEqual(expect.objectContaining({ success: true, reason: 'same-site', upstreamCalls: 0 }));
      expect(sessionState.tryAcquireMutationLock).not.toHaveBeenCalled();
      expect(cartState.beginSettling).not.toHaveBeenCalled();
      expect(mockedUpdateSessionContext).not.toHaveBeenCalled();
      expect(cartState.validateSite).not.toHaveBeenCalled();
    });

    it('returns locked when the session mutation lock is held (no PATCH, no settling)', async () => {
      const { stores, sessionState, cartState } = buildStores({
        session: { siteCode: 'a' },
        lockAvailable: false,
      });
      const logger = createLogger();

      const result = await performSiteSwitch('b', stores, { source: 'user', logger });

      expect(result).toEqual(expect.objectContaining({ success: false, reason: 'locked' }));
      expect(sessionState.releaseMutationLock).not.toHaveBeenCalled();
      expect(cartState.beginSettling).not.toHaveBeenCalled();
      expect(mockedUpdateSessionContext).not.toHaveBeenCalled();
    });

    it('returns unknown-site when getSiteByCode returns nothing and releases settling + lock', async () => {
      const { stores, sessionState, cartState } = buildStores();
      const getSiteByCode = jest.fn(() => Promise.resolve(null));
      const logger = createLogger();

      const result = await performSiteSwitch('missing', stores, {
        source: 'user',
        getSiteByCode,
        logger,
      });

      expect(result).toEqual(expect.objectContaining({ success: false, reason: 'unknown-site' }));
      expect(cartState.beginSettling).toHaveBeenCalledTimes(1);
      expect(cartState.endSettling).toHaveBeenCalledTimes(1);
      expect(sessionState.releaseMutationLock).toHaveBeenCalledTimes(1);
      expect(mockedUpdateSessionContext).not.toHaveBeenCalled();
    });

    it('returns error and runs cleanup when the combined PATCH rejects', async () => {
      const { stores, sessionState, cartState } = buildStores();
      mockedUpdateSessionContext.mockRejectedValue(new Error('500'));
      const navigateTo = jest.fn();
      const logger = createLogger();

      const result = await performSiteSwitch('b', stores, {
        source: 'user',
        logger,
        navigateTo,
        getSiteByCode: () => Promise.resolve({ languages: ['en'], currencies: ['EUR'] }),
      });

      expect(result).toEqual(expect.objectContaining({ success: false, reason: 'error' }));
      expect(sessionState.releaseMutationLock).toHaveBeenCalledTimes(1);
      expect(cartState.endSettling).toHaveBeenCalledWith('site-switch');
      expect(cartState.validateSite).not.toHaveBeenCalled();
      expect(navigateTo).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'error' }), expect.any(String));
    });

    it('returns error when updateSessionContext resolves with null', async () => {
      const { stores, sessionState } = buildStores();
      mockedUpdateSessionContext.mockResolvedValue(null);
      const logger = createLogger();

      const result = await performSiteSwitch('b', stores, {
        source: 'deep-link',
        logger,
        getSiteByCode: () => Promise.resolve({ languages: ['en'], currencies: ['EUR'] }),
      });

      expect(result).toEqual(expect.objectContaining({ success: false, reason: 'error' }));
      expect(sessionState.releaseMutationLock).toHaveBeenCalledTimes(1);
    });
  });

  describe('target-site delta computation', () => {
    it('falls back to default currency when current currency is not supported on target site', async () => {
      const { stores } = buildStores({
        session: { siteCode: 'a', currency: 'CHF', language: 'en', metadata: { version: 1 } },
      });
      mockedUpdateSessionContext.mockResolvedValue({
        siteCode: 'b',
        currency: 'USD',
        language: 'en',
        metadata: { version: 2 },
      });

      await performSiteSwitch('b', stores, {
        source: 'deep-link',
        getSiteByCode: () =>
          Promise.resolve({
            languages: ['en'],
            currencies: [{ id: 'USD' }],
            defaultCurrency: { id: 'USD' },
          }),
      });

      expect(mockedUpdateSessionContext).toHaveBeenCalledWith({ siteCode: 'b', currency: 'USD' }, 1);
    });

    it('preserves currency when target site supports it (no currency field in PATCH)', async () => {
      const { stores } = buildStores({
        session: { siteCode: 'a', currency: 'CHF', language: 'en', metadata: { version: 1 } },
      });
      mockedUpdateSessionContext.mockResolvedValue({
        siteCode: 'b',
        currency: 'CHF',
        language: 'en',
        metadata: { version: 2 },
      });

      await performSiteSwitch('b', stores, {
        source: 'deep-link',
        getSiteByCode: () =>
          Promise.resolve({
            languages: ['en'],
            currencies: ['CHF', 'USD'],
            defaultCurrency: 'USD',
          }),
      });

      expect(mockedUpdateSessionContext).toHaveBeenCalledWith({ siteCode: 'b' }, 1);
    });

    it('falls back to default language when current language is not supported on target site', async () => {
      const { stores } = buildStores({
        session: { siteCode: 'fw', currency: 'CHF', language: 'de', metadata: { version: 1 } },
      });
      mockedUpdateSessionContext.mockResolvedValue({
        siteCode: 'us',
        currency: 'CHF',
        language: 'en',
        metadata: { version: 2 },
      });

      await performSiteSwitch('us', stores, {
        source: 'deep-link',
        getSiteByCode: () =>
          Promise.resolve({
            languages: ['en'],
            currencies: ['CHF'],
            defaultLanguage: 'en',
          }),
      });

      expect(mockedUpdateSessionContext).toHaveBeenCalledWith({ siteCode: 'us', language: 'en' }, 1);
    });
  });

  describe('navigation', () => {
    it('deep-link source does not navigate or call router.refresh', async () => {
      const { stores } = buildStores({
        session: { siteCode: 'a', currency: 'EUR', metadata: { version: 1 } },
      });
      mockedUpdateSessionContext.mockResolvedValue({
        siteCode: 'b',
        currency: 'EUR',
        metadata: { version: 2 },
      });

      const navigateTo = jest.fn();
      const getRedirectPath = jest.fn();
      const refresh = jest.fn();

      await performSiteSwitch('b', stores, {
        source: 'deep-link',
        navigateTo,
        getRedirectPath,
        router: { refresh },
      });

      jest.advanceTimersByTime(NAVIGATION_REFRESH_DELAY_MS * 5);
      expect(navigateTo).not.toHaveBeenCalled();
      expect(getRedirectPath).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
    });

    it('skips resetSite when siteStore already holds the target site (SSR-aligned deep-link)', async () => {
      const { stores, siteState } = buildStores({
        session: { siteCode: 'a', currency: 'EUR', language: 'en', metadata: { version: 1 } },
        siteInStore: { code: 'b' },
      });
      mockedUpdateSessionContext.mockResolvedValue({
        siteCode: 'b',
        currency: 'EUR',
        language: 'en',
        metadata: { version: 2 },
      });

      const result = await performSiteSwitch('b', stores, {
        source: 'deep-link',
        getSiteByCode: () => Promise.resolve({ languages: ['en'], currencies: ['EUR'] }),
      });

      expect(result.success).toBe(true);
      expect(siteState.resetSite).not.toHaveBeenCalled();
    });

    it('picks a target-site-compatible redirect locale when current UI locale is unsupported', async () => {
      const { stores } = buildStores({
        session: { siteCode: 'fw', currency: 'CHF', language: 'de', metadata: { version: 1 } },
      });
      mockedUpdateSessionContext.mockResolvedValue({
        siteCode: 'us',
        currency: 'USD',
        language: 'en',
        metadata: { version: 2 },
      });

      const navigateTo = jest.fn();
      const getRedirectPath = jest.fn(() => '/us');
      const refresh = jest.fn();

      const result = await performSiteSwitch('us', stores, {
        source: 'user',
        locale: 'de',
        navigateTo,
        getRedirectPath,
        getSiteByCode: () => Promise.resolve({ languages: ['en'], currencies: ['USD'] }),
        router: { refresh },
      });

      expect(result.success).toBe(true);
      expect(getRedirectPath).toHaveBeenCalledWith(
        expect.objectContaining({ locale: 'en', site: 'us', forcePrefix: true }),
      );
      expect(navigateTo).toHaveBeenCalledWith('/us');
    });
  });

  describe('cart-per-site resolution', () => {
    it('completes successfully and logs error when fetchCart rejects (leaves cart unresolved)', async () => {
      const { stores, cartState } = buildStores({
        session: {
          siteCode: 'a',
          currency: 'EUR',
          language: 'en',
          cartId: 'cart-1',
          metadata: { version: 1 },
        },
        currentCart: { id: 'cart-1', site: 'a', currency: 'EUR' } as Cart,
        validateSiteRejectsWith: new Error('upstream 500'),
      });
      mockedUpdateSessionContext.mockResolvedValue({
        siteCode: 'b',
        currency: 'EUR',
        language: 'en',
        cartId: 'cart-1',
        metadata: { version: 2 },
      });

      const logger = createLogger();
      const result = await performSiteSwitch('b', stores, {
        source: 'deep-link',
        getSiteByCode: () => Promise.resolve({ languages: ['en'], currencies: ['EUR'] }),
        logger,
      });

      expect(result.success).toBe(true);
      expect(cartState.validateSite).toHaveBeenCalledTimes(1);
      expect(cartState.validateSite).toHaveBeenCalledWith('b');
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ siteCode: 'b' }),
        expect.stringContaining('fetchCart failed'),
      );
    });

    it('resolves per-site cart via validateSite even when previous site had a cart (cart-per-site, not carried)', async () => {
      const previousCart = { id: 'cart-a', site: 'a', currency: 'EUR' } as Cart;
      const perSiteCart = { id: 'cart-b', site: 'b', currency: 'EUR' } as Cart;
      const { stores, cartState } = buildStores({
        session: {
          siteCode: 'a',
          currency: 'EUR',
          language: 'en',
          cartId: 'cart-a',
          metadata: { version: 1 },
        },
        currentCart: previousCart,
        validateSiteResult: perSiteCart,
      });
      mockedUpdateSessionContext.mockResolvedValue({
        siteCode: 'b',
        currency: 'EUR',
        language: 'en',
        cartId: 'cart-a',
        metadata: { version: 2 },
      });

      await performSiteSwitch('b', stores, {
        source: 'deep-link',
        getSiteByCode: () => Promise.resolve({ languages: ['en'], currencies: ['EUR'] }),
      });

      // The orchestrator delegates cart reset + refetch to validateSite, which in production
      // invalidates the in-flight _fetchPromise (closure) before issuing a fresh GET.
      expect(cartState.validateSite).toHaveBeenCalledTimes(1);
      expect(cartState.validateSite).toHaveBeenCalledWith('b');
    });

    it('reconciles cart currency to session currency when the resolved per-site cart is stale (e.g. us-branch cached USD cart, session CHF)', async () => {
      // Post-switch the test helper's cartSetState does not actually mutate cartState.currentCart,
      // so we seed the "resolved" per-site cart via options.currentCart. This simulates the
      // state after fetchCart has installed a us-branch/USD cart while the session moved to
      // us-branch/CHF (two sites sharing CHF — orchestrator preserved the prior currency).
      const staleUsBranchCart = { id: 'us-cart', site: 'us-branch', currency: 'USD' } as Cart;
      const { stores, cartState } = buildStores({
        session: {
          siteCode: 'fw-site',
          currency: 'CHF',
          language: 'de',
          cartId: 'fw-cart',
          metadata: { version: 20 },
        },
        currentCart: staleUsBranchCart,
      });
      mockedUpdateSessionContext.mockResolvedValue({
        siteCode: 'us-branch',
        currency: 'CHF',
        language: 'en',
        cartId: 'us-cart',
        metadata: { version: 21 },
      });

      await performSiteSwitch('us-branch', stores, {
        source: 'deep-link',
        getSiteByCode: () => Promise.resolve({ languages: ['en'], currencies: ['USD', 'CHF'], defaultCurrency: 'USD' }),
      });

      expect(cartState.syncCurrencyWithSession).toHaveBeenCalledTimes(1);
      expect(cartState.syncCurrencyWithSession).toHaveBeenCalledWith('CHF', 'us-branch');
    });

    it('does not reconcile cart currency when the resolved per-site cart already agrees with session currency', async () => {
      const alignedCart = { id: 'us-cart', site: 'us-branch', currency: 'CHF' } as Cart;
      const { stores, cartState } = buildStores({
        session: {
          siteCode: 'fw-site',
          currency: 'CHF',
          language: 'de',
          cartId: 'fw-cart',
          metadata: { version: 20 },
        },
        currentCart: alignedCart,
      });
      mockedUpdateSessionContext.mockResolvedValue({
        siteCode: 'us-branch',
        currency: 'CHF',
        language: 'en',
        cartId: 'us-cart',
        metadata: { version: 21 },
      });

      await performSiteSwitch('us-branch', stores, {
        source: 'deep-link',
        getSiteByCode: () => Promise.resolve({ languages: ['en'], currencies: ['USD', 'CHF'], defaultCurrency: 'USD' }),
      });

      expect(cartState.syncCurrencyWithSession).not.toHaveBeenCalled();
    });

    it('does not reconcile cart currency when the resolved cart belongs to a different site (guard against cross-site mutation)', async () => {
      // If somehow the fetchCart result still points at the previous site's cart (race or
      // upstream edge case), the reconcile must NOT fire — otherwise we would `PATCH /changeCurrency`
      // on a cart tagged to the wrong site. The site-guard inside syncCurrencyWithSession already
      // enforces this, but the orchestrator should short-circuit before even calling it.
      const wrongSiteCart = { id: 'fw-cart', site: 'fw-site', currency: 'CHF' } as Cart;
      const { stores, cartState } = buildStores({
        session: {
          siteCode: 'fw-site',
          currency: 'CHF',
          language: 'de',
          cartId: 'fw-cart',
          metadata: { version: 20 },
        },
        currentCart: wrongSiteCart,
      });
      mockedUpdateSessionContext.mockResolvedValue({
        siteCode: 'us-branch',
        currency: 'USD',
        language: 'en',
        cartId: 'fw-cart',
        metadata: { version: 21 },
      });

      await performSiteSwitch('us-branch', stores, {
        source: 'deep-link',
        getSiteByCode: () => Promise.resolve({ languages: ['en'], currencies: ['USD'], defaultCurrency: 'USD' }),
      });

      expect(cartState.syncCurrencyWithSession).not.toHaveBeenCalled();
    });
  });

  /**
   * Emporix's `POST /cart/{cartId}/changeCurrency` is transactional: if any line item has
   * no price list for the target currency it rejects with 400 and leaves the cart in the
   * prior currency. The cart store's `updateCurrency` swallows that error (stores it in
   * state, does not rethrow), so `syncCurrencyWithSession` resolves normally. The
   * orchestrator must therefore also detect non-convergence of the post-call cart currency
   * and fall back to the target site's `defaultCurrency` to keep session/cart aligned.
   */
  describe('cart currency reprice fallback', () => {
    it('rolls session currency back to target default when syncCurrencyWithSession resolves but cart currency stays stale', async () => {
      const staleUsBranchCart = { id: 'us-cart', site: 'us-branch', currency: 'USD' } as Cart;
      const { stores, sessionState, cartState } = buildStores({
        session: {
          siteCode: 'fw-site',
          currency: 'CHF',
          language: 'de',
          cartId: 'fw-cart',
          metadata: { version: 20 },
        },
        currentCart: staleUsBranchCart,
      });
      // First PATCH: site switch preserves CHF (listed as supported by us-branch).
      mockedUpdateSessionContext.mockResolvedValueOnce({
        siteCode: 'us-branch',
        currency: 'CHF',
        language: 'en',
        cartId: 'us-cart',
        metadata: { version: 21 },
      });
      // Second PATCH: rollback to target default USD after reprice fails silently.
      mockedUpdateSessionContext.mockResolvedValueOnce({
        siteCode: 'us-branch',
        currency: 'USD',
        language: 'en',
        cartId: 'us-cart',
        metadata: { version: 22 },
      });
      // syncCurrencyWithSession resolves (default behaviour) but cartState.currentCart stays USD.

      const result = await performSiteSwitch('us-branch', stores, {
        source: 'deep-link',
        getSiteByCode: () => Promise.resolve({ languages: ['en'], currencies: ['USD', 'CHF'], defaultCurrency: 'USD' }),
      });

      expect(result.success).toBe(true);
      expect(result.currencyFallback).toEqual({ from: 'CHF', to: 'USD' });

      expect(cartState.syncCurrencyWithSession).toHaveBeenCalledTimes(1);
      // First call aligned session → CHF, second call rolled it back → USD.
      expect(mockedUpdateSessionContext).toHaveBeenCalledTimes(2);
      expect(mockedUpdateSessionContext).toHaveBeenNthCalledWith(2, { currency: 'USD' }, 21);
      // Session store re-updated with rolled-back session.
      expect(sessionState.setSession).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ currency: 'USD', metadata: { version: 22 } }),
      );
      // Residual cart error cleared so UI doesn't surface the reprice 400.
      expect(cartState.setError).toHaveBeenCalledWith(null);
      // Cart is NOT cleared — contents preserved.
      expect(cartState.clearCart).not.toHaveBeenCalled();
    });

    it('rolls back when syncCurrencyWithSession rejects outright', async () => {
      const staleUsBranchCart = { id: 'us-cart', site: 'us-branch', currency: 'USD' } as Cart;
      const { stores, sessionState, cartState } = buildStores({
        session: {
          siteCode: 'fw-site',
          currency: 'CHF',
          language: 'de',
          cartId: 'fw-cart',
          metadata: { version: 20 },
        },
        currentCart: staleUsBranchCart,
      });
      cartState.syncCurrencyWithSession.mockRejectedValueOnce(new Error('reprice failed'));
      mockedUpdateSessionContext.mockResolvedValueOnce({
        siteCode: 'us-branch',
        currency: 'CHF',
        language: 'en',
        cartId: 'us-cart',
        metadata: { version: 21 },
      });
      mockedUpdateSessionContext.mockResolvedValueOnce({
        siteCode: 'us-branch',
        currency: 'USD',
        language: 'en',
        cartId: 'us-cart',
        metadata: { version: 22 },
      });

      const result = await performSiteSwitch('us-branch', stores, {
        source: 'deep-link',
        getSiteByCode: () => Promise.resolve({ languages: ['en'], currencies: ['USD', 'CHF'], defaultCurrency: 'USD' }),
      });

      expect(result.success).toBe(true);
      expect(result.currencyFallback).toEqual({ from: 'CHF', to: 'USD' });
      expect(mockedUpdateSessionContext).toHaveBeenCalledTimes(2);
      expect(sessionState.setSession).toHaveBeenCalledTimes(2);
    });

    it('does not roll back when reprice converges (cart currency updated to session currency)', async () => {
      const staleUsBranchCart = { id: 'us-cart', site: 'us-branch', currency: 'USD' } as Cart;
      const { stores, cartState } = buildStores({
        session: {
          siteCode: 'fw-site',
          currency: 'CHF',
          language: 'de',
          cartId: 'fw-cart',
          metadata: { version: 20 },
        },
        currentCart: staleUsBranchCart,
      });
      // Simulate successful reprice by mutating the cart currency during the call.
      cartState.syncCurrencyWithSession.mockImplementationOnce(() => {
        cartState.currentCart = { ...staleUsBranchCart, currency: 'CHF' } as Cart;
        return Promise.resolve();
      });
      mockedUpdateSessionContext.mockResolvedValueOnce({
        siteCode: 'us-branch',
        currency: 'CHF',
        language: 'en',
        cartId: 'us-cart',
        metadata: { version: 21 },
      });

      const result = await performSiteSwitch('us-branch', stores, {
        source: 'deep-link',
        getSiteByCode: () => Promise.resolve({ languages: ['en'], currencies: ['USD', 'CHF'], defaultCurrency: 'USD' }),
      });

      expect(result.success).toBe(true);
      expect(result.currencyFallback).toBeUndefined();
      expect(mockedUpdateSessionContext).toHaveBeenCalledTimes(1);
      expect(cartState.setError).not.toHaveBeenCalled();
    });

    it('skips rollback when the target site has no usable defaultCurrency', async () => {
      const staleUsBranchCart = { id: 'us-cart', site: 'us-branch', currency: 'USD' } as Cart;
      const { stores, cartState } = buildStores({
        session: {
          siteCode: 'fw-site',
          currency: 'CHF',
          language: 'de',
          cartId: 'fw-cart',
          metadata: { version: 20 },
        },
        currentCart: staleUsBranchCart,
      });
      mockedUpdateSessionContext.mockResolvedValueOnce({
        siteCode: 'us-branch',
        currency: 'CHF',
        language: 'en',
        cartId: 'us-cart',
        metadata: { version: 21 },
      });

      const result = await performSiteSwitch('us-branch', stores, {
        source: 'deep-link',
        // No defaultCurrency → nothing to roll back to.
        getSiteByCode: () => Promise.resolve({ languages: ['en'], currencies: ['USD', 'CHF'] }),
      });

      expect(result.success).toBe(true);
      expect(result.currencyFallback).toBeUndefined();
      expect(mockedUpdateSessionContext).toHaveBeenCalledTimes(1);
      expect(cartState.setError).not.toHaveBeenCalled();
    });

    it('skips rollback when target defaultCurrency equals the attempted currency (already aligned to default)', async () => {
      // Session carried CHF; target site lists CHF as default. Reprice still failed silently
      // (the cart simply cannot be repriced to CHF) — but there's no other currency to fall
      // back to, so the orchestrator must not issue a no-op PATCH.
      const staleCart = { id: 'cart-1', site: 'us-branch', currency: 'USD' } as Cart;
      const { stores, cartState } = buildStores({
        session: {
          siteCode: 'fw-site',
          currency: 'CHF',
          language: 'de',
          cartId: 'cart-1',
          metadata: { version: 20 },
        },
        currentCart: staleCart,
      });
      mockedUpdateSessionContext.mockResolvedValueOnce({
        siteCode: 'us-branch',
        currency: 'CHF',
        language: 'en',
        cartId: 'cart-1',
        metadata: { version: 21 },
      });

      const result = await performSiteSwitch('us-branch', stores, {
        source: 'deep-link',
        getSiteByCode: () => Promise.resolve({ languages: ['en'], currencies: ['CHF'], defaultCurrency: 'CHF' }),
      });

      expect(result.success).toBe(true);
      expect(result.currencyFallback).toBeUndefined();
      expect(mockedUpdateSessionContext).toHaveBeenCalledTimes(1);
      expect(cartState.setError).not.toHaveBeenCalled();
    });

    it('applies fallback on user source too (so the switcher can toast)', async () => {
      const staleUsBranchCart = { id: 'us-cart', site: 'us-branch', currency: 'USD' } as Cart;
      const { stores } = buildStores({
        session: {
          siteCode: 'fw-site',
          currency: 'CHF',
          language: 'de',
          cartId: 'us-cart',
          metadata: { version: 20 },
        },
        currentCart: staleUsBranchCart,
      });
      mockedUpdateSessionContext.mockResolvedValueOnce({
        siteCode: 'us-branch',
        currency: 'CHF',
        language: 'en',
        cartId: 'us-cart',
        metadata: { version: 21 },
      });
      mockedUpdateSessionContext.mockResolvedValueOnce({
        siteCode: 'us-branch',
        currency: 'USD',
        language: 'en',
        cartId: 'us-cart',
        metadata: { version: 22 },
      });

      const result = await performSiteSwitch('us-branch', stores, {
        source: 'user',
        locale: 'de',
        navigateTo: jest.fn(),
        getRedirectPath: jest.fn(() => '/us-branch'),
        router: { refresh: jest.fn() },
        getSiteByCode: () => Promise.resolve({ languages: ['en'], currencies: ['USD', 'CHF'], defaultCurrency: 'USD' }),
      });

      expect(result.success).toBe(true);
      expect(result.currencyFallback).toEqual({ from: 'CHF', to: 'USD' });
    });
  });

  /**
   * Regression test for the `_fetchPromise` race (Copilot review
   * https://github.com/emporix/emporix-showcase/pull/283#discussion_r3128797246).
   *
   * Uses the REAL `createCartStore` so the closure-level `_fetchPromise` dedupe is exercised.
   * Before the fix, `performSiteSwitch` would call `setState + fetchCart`, which short-circuited
   * on the in-flight `_fetchPromise` and reused the previous site's GET — no second HTTP request
   * was issued. After the fix, `validateSite` nulls `_fetchPromise` first, so the orchestrator
   * always drives a fresh per-site `GET /api/cart`.
   */
  describe('regression: in-flight fetchCart dedupe is invalidated across site switch', () => {
    // Alias the top-of-file mocked `fetchCurrentCart` so the real cart store's
    // `apiFetchCurrentCart` import resolves here.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mockedFetchCurrentCart = require('@/lib/client/carts').fetchCurrentCart as jest.Mock;

    beforeEach(() => {
      mockedFetchCurrentCart.mockReset();
    });

    it('fires a second GET /api/cart for the target site even when a previous-site fetchCart is in-flight', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createCartStore: createRealCartStore } =
        require('@/stores/cart-store') as typeof import('@/stores/cart-store');

      const realCartStore = createRealCartStore();

      // Seed the store as if a previous `validateSite('a')` had already run.
      realCartStore.setState({ lastSiteCode: 'a' });

      // Two deferreds: one for the in-flight previous-site GET, one for the new post-switch GET.
      type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
      const defer = <T>(): Deferred<T> => {
        let resolve!: (value: T) => void;
        const promise = new Promise<T>((r) => {
          resolve = r;
        });
        return { promise, resolve };
      };

      const firstFetch = defer<{ cart: Cart | null; sessionSiteCode: string | null }>();
      const secondFetch = defer<{ cart: Cart | null; sessionSiteCode: string | null }>();

      mockedFetchCurrentCart
        .mockImplementationOnce(() => firstFetch.promise)
        .mockImplementationOnce(() => secondFetch.promise);

      // 1) Kick off the in-flight cart read for site 'a' and leave it unresolved —
      //    this installs `_fetchPromise` inside the real cart store.
      const inFlight = realCartStore.getState().fetchCart();
      expect(mockedFetchCurrentCart).toHaveBeenCalledTimes(1);

      // 2) Drive `performSiteSwitch('b')` while the first fetchCart is still pending.
      mockedUpdateSessionContext.mockResolvedValueOnce({
        siteCode: 'b',
        currency: 'EUR',
        language: 'en',
        cartId: 'cart-b',
        metadata: { version: 2 },
      });

      const sessionState: SessionStoreState = {
        session: { siteCode: 'a', currency: 'EUR', language: 'en', metadata: { version: 1 } },
        tryAcquireMutationLock: jest.fn(() => true),
        releaseMutationLock: jest.fn(),
        setSession: jest.fn(),
        setLoading: jest.fn(),
      };
      const siteState: SiteStoreState = {
        resetSite: jest.fn(),
        getSite: jest.fn(() => undefined),
      };
      const stores = {
        sessionStore: { getState: () => sessionState },
        siteStore: { getState: () => siteState },
        cartStore: realCartStore,
      } as unknown as SiteSwitchStores;

      const switchDone = performSiteSwitch('b', stores, {
        source: 'deep-link',
        getSiteByCode: () => Promise.resolve({ languages: ['en'], currencies: ['EUR'] }),
      });

      // 3) Let the microtask queue flush so `validateSite` has time to null `_fetchPromise`
      //    and issue the NEW `apiFetchCurrentCart`. Several ticks cover each await in the
      //    orchestrator body (getSiteByCode → updateSessionContext → validateSite).
      for (let i = 0; i < 10; i += 1) {
        await Promise.resolve();
      }

      // Contract: a second HTTP call fires for the target site. This is the behaviour that
      // was broken under the old `setState + fetchCart` approach — it would have stayed at 1.
      expect(mockedFetchCurrentCart).toHaveBeenCalledTimes(2);

      // 4) Resolve both GETs: old → a cart, new → b cart.
      firstFetch.resolve({
        cart: { id: 'cart-a', site: 'a', currency: 'EUR' } as Cart,
        sessionSiteCode: 'a',
      });
      secondFetch.resolve({
        cart: { id: 'cart-b', site: 'b', currency: 'EUR' } as Cart,
        sessionSiteCode: 'b',
      });

      await inFlight;
      await switchDone;

      // The store snapped to site 'b' and the orchestrator drove a per-site fetch.
      expect(realCartStore.getState().lastSiteCode).toBe('b');
    });
  });
});
