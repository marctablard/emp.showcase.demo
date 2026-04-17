// src/hooks/cart/store-synchronizer.test.ts
import { act } from '@testing-library/react';
import type { Cart } from '@/platform/services/model/cart/cart';
import type { Site } from '@/platform/services/model/common/site';
import type { Session } from '@/platform/services/model/session';
import { createCartStore } from '@/stores/cart-store';
import { createCustomerStore } from '@/stores/customer-store';
import { createSessionStore } from '@/stores/session-store-context';
import { createSiteStore } from '@/stores/site-store';
import { setupStoreSynchronization } from '@/stores/sync/store-synchronizer';

// Mock logger
jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock cart API calls
jest.mock('@/lib/client/carts', () => ({
  fetchCurrentCart: jest.fn().mockResolvedValue(null),
  updateCartCurrency: jest.fn().mockResolvedValue({ id: 'cart-1', currency: 'EUR' }),
  validateCartItems: jest.fn().mockResolvedValue(undefined),
  addToCart: jest.fn(),
  removeFromCart: jest.fn(),
  updateCartItemQuantity: jest.fn(),
  clearCart: jest.fn(),
  loadCartById: jest.fn(),
  updateCartShippingInfo: jest.fn(),
}));

// Helper to create minimal mock data
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
  });

  afterEach(() => {
    // Cleanup subscriptions after each test
    if (unsubscribers) {
      unsubscribers.forEach((unsub) => unsub());
    }
  });

  describe('setupStoreSynchronization', () => {
    it('should return array of unsubscribe functions', () => {
      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
      });

      expect(Array.isArray(unsubscribers)).toBe(true);
      expect(unsubscribers.length).toBe(5); // shipping cache + currency + site + siteStore + legalEntity
      expect(typeof unsubscribers[0]).toBe('function');
      expect(typeof unsubscribers[1]).toBe('function');
      expect(typeof unsubscribers[2]).toBe('function');
      expect(typeof unsubscribers[3]).toBe('function');
      expect(typeof unsubscribers[4]).toBe('function');
    });

    it('should call syncCurrencyWithSession when session currency changes', async () => {
      // Set up cart with different currency
      act(() => {
        cartStore.setState({
          currentCart: createMockCart(),
        });
      });

      // Spy on syncCurrencyWithSession
      const syncSpy = jest.spyOn(cartStore.getState(), 'syncCurrencyWithSession');

      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
      });

      // Change session currency
      await act(async () => {
        sessionStore.setState({
          session: createMockSession({ currency: 'EUR' }),
        });
      });

      // Allow subscription to process
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(syncSpy).toHaveBeenCalledWith('EUR', 'main');
    });

    it('should call validateSite when session site changes', async () => {
      // Spy on validateSite
      const validateSiteSpy = jest.spyOn(cartStore.getState(), 'validateSite');

      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
      });

      // Change session site
      await act(async () => {
        sessionStore.setState({
          session: createMockSession({ siteCode: 'secondary' }),
        });
      });

      // Allow subscription to process
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(validateSiteSpy).toHaveBeenCalledWith('secondary');
    });

    it('should call validateLegalEntity when session legalEntityId changes', async () => {
      const validateLeSpy = jest.spyOn(cartStore.getState(), 'validateLegalEntity');

      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
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
      });

      // All unsubscribe functions should execute without error
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
      });

      // Set session to null
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
      });

      // Set session with undefined siteCode - cast to allow partial session for testing
      await act(async () => {
        sessionStore.setState({
          session: { id: 'test', currency: 'USD', siteCode: '' } as Session,
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(validateSiteSpy).not.toHaveBeenCalled();
    });

    it('should not update currency when cart site differs from session site', async () => {
      // Set up cart belonging to a different site
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
      });

      // Change session currency for 'main' site, but cart belongs to 'other-site'
      await act(async () => {
        sessionStore.setState({
          session: createMockSession({ currency: 'EUR', siteCode: 'main' }),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // syncCurrencyWithSession should be called, but updateCurrency should NOT
      // because the cart belongs to a different site
      expect(updateCurrencySpy).not.toHaveBeenCalled();
    });

    it('should not update currency when cart currency already matches session currency', async () => {
      // Set up cart with same currency as session
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
      });

      // Change session to EUR (same as cart)
      await act(async () => {
        sessionStore.setState({
          session: createMockSession({ currency: 'EUR', siteCode: 'main' }),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // updateCurrency should NOT be called because currencies already match
      expect(updateCurrencySpy).not.toHaveBeenCalled();
    });

    it('should handle multiple rapid currency changes correctly', async () => {
      // Set up cart
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
      });

      // Rapid currency changes
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

      // Each change should trigger a sync call
      expect(syncSpy).toHaveBeenCalledTimes(3);
      expect(syncSpy).toHaveBeenCalledWith('EUR', 'main');
      expect(syncSpy).toHaveBeenCalledWith('GBP', 'main');
      expect(syncSpy).toHaveBeenCalledWith('CHF', 'main');
    });

    it('should not update currency when cart store is in loading state (e.g., post-login transition)', async () => {
      // Set up cart with loading state (simulating post-login cart fetch in progress)
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
      });

      // Change session currency while cart is loading
      await act(async () => {
        sessionStore.setState({
          session: createMockSession({ currency: 'EUR' }),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // syncCurrencyWithSession should be called but should early-return due to loading state,
      // so updateCurrency should NOT be called
      expect(updateCurrencySpy).not.toHaveBeenCalled();
    });

    it('should resume currency sync after loading state clears', async () => {
      // Start with loading state
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
      });

      // Change currency while loading — should be skipped
      await act(async () => {
        sessionStore.setState({
          session: createMockSession({ currency: 'EUR' }),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const updateCurrencySpy = jest.spyOn(cartStore.getState(), 'updateCurrency');

      // Clear loading state (simulating fetchCart completed)
      act(() => {
        cartStore.setState({ loading: false });
      });

      // Now change currency again — should trigger sync
      await act(async () => {
        sessionStore.setState({
          session: createMockSession({ currency: 'GBP' }),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // This time updateCurrency should be called since loading is false
      expect(updateCurrencySpy).toHaveBeenCalled();
    });

    it('should reset site store when session site changes to a different site', async () => {
      // Site store starts with 'main' site
      const resetSpy = jest.spyOn(siteStore.getState(), 'reset');

      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
      });

      // Switch session to 'us-branch'
      await act(async () => {
        sessionStore.setState({
          session: createMockSession({ siteCode: 'us-branch' }),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(resetSpy).toHaveBeenCalledTimes(1);
    });

    it('should not reset site store when session site matches site store', async () => {
      // Site store starts with 'main', session also starts with 'main'
      const resetSpy = jest.spyOn(siteStore.getState(), 'reset');

      unsubscribers = setupStoreSynchronization({
        sessionStore,
        cartStore,
        siteStore,
        customerStore,
      });

      // Set same site again — should not trigger reset
      await act(async () => {
        sessionStore.setState({
          session: createMockSession({ siteCode: 'main', currency: 'GBP' }),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(resetSpy).not.toHaveBeenCalled();
    });
  });
});
