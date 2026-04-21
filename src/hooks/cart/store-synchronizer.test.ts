// src/hooks/cart/store-synchronizer.test.ts
import { act, waitFor } from '@testing-library/react';
import type { Cart } from '@/platform/services/model/cart/cart';
import type { Site } from '@/platform/services/model/common/site';
import type { Session } from '@/platform/services/model/session';
import { createAvailabilityStore } from '@/stores/availability-store';
import { createCartStore } from '@/stores/cart-store';
import { createCustomerStore } from '@/stores/customer-store';
import { createProductStore } from '@/stores/products-store';
import { createSessionStore } from '@/stores/session-store-context';
import { createSiteStore } from '@/stores/site-store';
import { setupStoreSynchronization } from '@/stores/sync/store-synchronizer';

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('@/lib/client/carts', () => ({
  fetchCurrentCart: jest.fn().mockResolvedValue({ cart: null, sessionSiteCode: null }),
  updateCartCurrency: jest.fn().mockResolvedValue({ id: 'cart-1', currency: 'EUR' }),
  validateCartItems: jest.fn().mockResolvedValue(undefined),
  addToCart: jest.fn(),
  removeFromCart: jest.fn(),
  updateCartItemQuantity: jest.fn(),
  clearCart: jest.fn(),
  loadCartById: jest.fn(),
  updateCartShippingInfo: jest.fn(),
}));

const mockUpdateSessionSite = jest.fn().mockResolvedValue(true);
jest.mock('@/lib/client/session', () => ({
  updateSessionSite: (...args: unknown[]) => mockUpdateSessionSite(...args),
  fetchCurrentSession: jest.fn().mockResolvedValue(null),
}));

const createMockSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'session-1',
  currency: 'USD',
  siteCode: 'main',
  ...overrides,
});

const createMockSite = (overrides: Partial<Site> = {}): Site =>
  ({
    code: 'main',
    name: 'Main Site',
    defaultCurrency: 'USD',
    countries: [],
    shipToCountries: [],
    currencies: [],
    languages: [],
    regions: [],
    paymentModes: [],
    defaultLanguage: 'en',
    decimals: 2,
    address: {},
    includesTax: false,
    ...overrides,
  }) as Site;

const createMockCart = (overrides: Partial<Cart> = {}): Cart =>
  ({
    id: 'cart-1',
    site: 'main',
    currency: 'USD',
    items: [],
    totalPrice: { amount: 0, currency: 'USD' },
    subTotalPrice: { amount: 0, currency: 'USD' },
    tax: { amount: 0, currency: 'USD', netValue: 0, grossValue: 0 },
    ...overrides,
  }) as Cart;

describe('Store Synchronizer', () => {
  let sessionStore: ReturnType<typeof createSessionStore>;
  let cartStore: ReturnType<typeof createCartStore>;
  let siteStore: ReturnType<typeof createSiteStore>;
  let customerStore: ReturnType<typeof createCustomerStore>;
  let productStore: ReturnType<typeof createProductStore>;
  let availabilityStore: ReturnType<typeof createAvailabilityStore>;
  let unsubscribers: (() => void)[];

  beforeEach(() => {
    jest.clearAllMocks();

    sessionStore = createSessionStore({
      session: createMockSession(),
      loading: false,
    });

    cartStore = createCartStore();

    siteStore = createSiteStore({
      site: createMockSite(),
      availableSites: [],
      loading: false,
      error: null,
    });

    customerStore = createCustomerStore();
    productStore = createProductStore();
    availabilityStore = createAvailabilityStore();
  });

  afterEach(() => {
    if (unsubscribers) {
      unsubscribers.forEach((unsub) => unsub());
    }
  });

  describe('setupStoreSynchronization', () => {
    it('should return array of unsubscribe functions (6 reactive subscriptions; no reconciliation writers)', () => {
      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
        productStore,
        availabilityStore,
      });

      expect(Array.isArray(unsubscribers)).toBe(true);
      // shipping cache + product/availability cache + currency + site-validate + site-store-reset + legal-entity
      expect(unsubscribers.length).toBe(6);
      for (const unsub of unsubscribers) {
        expect(typeof unsub).toBe('function');
      }
    });

    it('never calls updateSessionSite from the synchronizer (all session mutations flow through performSiteSwitch)', async () => {
      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
        productStore,
        availabilityStore,
      });

      // Simulate scenarios that previously triggered reconcileSiteWithSession:
      //   (a) site store mismatch on init
      await act(async () => {
        siteStore.setState({ site: createMockSite({ code: 'secondary' }) });
      });
      //   (b) session site changed
      await act(async () => {
        sessionStore.setState({ session: createMockSession({ siteCode: 'other' }) });
      });
      //   (c) a full 3-second wait (previous debounce was 2s)
      await new Promise((resolve) => setTimeout(resolve, 3000));

      expect(mockUpdateSessionSite).not.toHaveBeenCalled();
    });

    it('should call syncCurrencyWithSession when session currency changes', async () => {
      act(() => {
        cartStore.setState({
          currentCart: createMockCart(),
        });
      });

      const syncSpy = jest.spyOn(cartStore.getState(), 'syncCurrencyWithSession');

      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
        productStore,
        availabilityStore,
      });

      await act(async () => {
        sessionStore.setState({
          session: createMockSession({ currency: 'EUR' }),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(syncSpy).toHaveBeenCalledWith('EUR', 'main');
    });

    it('should clear availability store when session currency changes (same subscription as product cache)', async () => {
      const clearSpy = jest.spyOn(availabilityStore.getState(), 'clearAllAvailabilities');

      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
        productStore,
        availabilityStore,
      });

      await act(async () => {
        sessionStore.setState({
          session: createMockSession({ currency: 'EUR' }),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(clearSpy).toHaveBeenCalled();
    });

    it('should call validateSite when session site changes', async () => {
      const validateSiteSpy = jest.spyOn(cartStore.getState(), 'validateSite');

      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
        productStore,
        availabilityStore,
      });

      await act(async () => {
        sessionStore.setState({
          session: createMockSession({ siteCode: 'secondary' }),
        });
      });

      await waitFor(() => {
        expect(validateSiteSpy).toHaveBeenCalledWith('secondary');
      });
    });

    it('should call validateLegalEntity when session legalEntityId changes', async () => {
      const validateLeSpy = jest.spyOn(cartStore.getState(), 'validateLegalEntity');

      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
        productStore,
        availabilityStore,
      });

      await act(async () => {
        sessionStore.setState({
          session: createMockSession({ legalEntityId: 'le-a' }),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(validateLeSpy).toHaveBeenCalledWith('le-a');

      await act(async () => {
        sessionStore.setState({
          session: createMockSession({ legalEntityId: 'le-b' }),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(validateLeSpy).toHaveBeenCalledWith('le-b');
    });

    it('should cleanup subscriptions when unsubscribe functions are called', () => {
      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
        productStore,
        availabilityStore,
      });

      expect(() => {
        unsubscribers.forEach((unsub) => unsub());
      }).not.toThrow();
    });

    it('should not call syncCurrencyWithSession when session is null', async () => {
      const syncSpy = jest.spyOn(cartStore.getState(), 'syncCurrencyWithSession');

      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
        productStore,
        availabilityStore,
      });

      await act(async () => {
        sessionStore.setState({ session: null });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(syncSpy).not.toHaveBeenCalled();
    });

    it('should not call validateSite when siteCode is undefined', async () => {
      const validateSiteSpy = jest.spyOn(cartStore.getState(), 'validateSite');

      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
        productStore,
        availabilityStore,
      });

      await act(async () => {
        sessionStore.setState({
          session: { id: 'test', currency: 'USD', siteCode: '' } as Session,
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(validateSiteSpy).not.toHaveBeenCalled();
    });

    it('should not update currency when cart site differs from session site', async () => {
      act(() => {
        cartStore.setState({
          currentCart: createMockCart({ site: 'other-site', currency: 'USD' }),
        });
      });

      const updateCurrencySpy = jest.spyOn(cartStore.getState(), 'updateCurrency');

      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
        productStore,
        availabilityStore,
      });

      await act(async () => {
        sessionStore.setState({
          session: createMockSession({ currency: 'EUR', siteCode: 'main' }),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(updateCurrencySpy).not.toHaveBeenCalled();
    });

    it('should not update currency when cart currency already matches session currency', async () => {
      act(() => {
        cartStore.setState({
          currentCart: createMockCart({ site: 'main', currency: 'EUR' }),
        });
      });

      const updateCurrencySpy = jest.spyOn(cartStore.getState(), 'updateCurrency');

      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
        productStore,
        availabilityStore,
      });

      await act(async () => {
        sessionStore.setState({
          session: createMockSession({ currency: 'EUR', siteCode: 'main' }),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(updateCurrencySpy).not.toHaveBeenCalled();
    });

    it('should handle multiple rapid currency changes correctly', async () => {
      act(() => {
        cartStore.setState({
          currentCart: createMockCart({ site: 'main', currency: 'USD' }),
        });
      });

      const syncSpy = jest.spyOn(cartStore.getState(), 'syncCurrencyWithSession');

      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
        productStore,
        availabilityStore,
      });

      await act(async () => {
        sessionStore.setState({ session: createMockSession({ currency: 'EUR' }) });
      });
      await act(async () => {
        sessionStore.setState({ session: createMockSession({ currency: 'GBP' }) });
      });
      await act(async () => {
        sessionStore.setState({ session: createMockSession({ currency: 'CHF' }) });
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(syncSpy).toHaveBeenCalledTimes(3);
      expect(syncSpy).toHaveBeenCalledWith('EUR', 'main');
      expect(syncSpy).toHaveBeenCalledWith('GBP', 'main');
      expect(syncSpy).toHaveBeenCalledWith('CHF', 'main');
    });

    it('should not update currency when cart store is in loading state (e.g., post-login transition)', async () => {
      act(() => {
        cartStore.setState({
          currentCart: createMockCart({ site: 'main', currency: 'USD' }),
          loading: true,
        });
      });

      const updateCurrencySpy = jest.spyOn(cartStore.getState(), 'updateCurrency');

      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
        productStore,
        availabilityStore,
      });

      await act(async () => {
        sessionStore.setState({
          session: createMockSession({ currency: 'EUR' }),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(updateCurrencySpy).not.toHaveBeenCalled();
    });

    it('should resume currency sync after loading state clears', async () => {
      act(() => {
        cartStore.setState({
          currentCart: createMockCart({ site: 'main', currency: 'USD' }),
          loading: true,
        });
      });

      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
        productStore,
        availabilityStore,
      });

      await act(async () => {
        sessionStore.setState({
          session: createMockSession({ currency: 'EUR' }),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const updateCurrencySpy = jest.spyOn(cartStore.getState(), 'updateCurrency');

      act(() => {
        cartStore.setState({ loading: false });
      });

      await act(async () => {
        sessionStore.setState({
          session: createMockSession({ currency: 'GBP' }),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(updateCurrencySpy).toHaveBeenCalled();
    });

    it('should call resetSite on site store when session site changes to a different site (preserves availableSites)', async () => {
      const resetSiteSpy = jest.spyOn(siteStore.getState(), 'resetSite');

      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
        productStore,
        availabilityStore,
      });

      await act(async () => {
        sessionStore.setState({
          session: createMockSession({ siteCode: 'us-branch' }),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(resetSiteSpy).toHaveBeenCalledTimes(1);
    });

    it('should not trigger currency sync when only the cart updates (develop parity — no cart subscription)', async () => {
      const syncSpy = jest.spyOn(cartStore.getState(), 'syncCurrencyWithSession');

      sessionStore = createSessionStore({
        session: createMockSession({ currency: 'EUR', siteCode: 'main' }),
        loading: false,
      });

      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
        productStore,
        availabilityStore,
      });

      await act(async () => {
        cartStore.setState({
          currentCart: createMockCart({ site: 'main', currency: 'CHF' }),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(syncSpy).not.toHaveBeenCalled();
    });

    it('should not call validateSite when only the cart updates with a different site (develop parity)', async () => {
      const validateSiteSpy = jest.spyOn(cartStore.getState(), 'validateSite');

      sessionStore = createSessionStore({
        session: createMockSession({ currency: 'EUR', siteCode: 'main' }),
        loading: false,
      });

      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
        productStore,
        availabilityStore,
      });

      await act(async () => {
        cartStore.setState({
          currentCart: createMockCart({ site: 'us-branch', currency: 'USD' }),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(validateSiteSpy).not.toHaveBeenCalled();
    });

    it('should not call resetSite when session site matches site store', async () => {
      const resetSiteSpy = jest.spyOn(siteStore.getState(), 'resetSite');

      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
        productStore,
        availabilityStore,
      });

      await act(async () => {
        sessionStore.setState({
          session: createMockSession({ siteCode: 'main', currency: 'GBP' }),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(resetSiteSpy).not.toHaveBeenCalled();
    });
  });
});
