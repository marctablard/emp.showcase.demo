import { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { fetchProductById } from '@/lib/client/products';
import type { Session } from '@/platform/services/model/session/session';
import {
  CartStoreContext,
  HistoryStoreContext,
  ProductStoreContext,
  SessionStoreContext,
  StoreProvider,
  useProductStore,
} from '@/providers/StoreProvider';
import { createCartStore } from '@/stores/cart-store';
import { createHistoryStore } from '@/stores/history-store';
import { createProductStore } from '@/stores/products-store';
import { createSessionStore } from '@/stores/session-store-context';
import { useProduct } from './useProduct';

// Mock logger to avoid DI container requirements in tests
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

// Mock the API module
jest.mock('@/lib/client/products', () => ({
  fetchProductById: jest.fn(),
}));

jest.mock('@/hooks/site/useSite', () => ({
  useSite: () => ({
    site: {
      code: 'main',
      name: 'Main',
      countries: [],
      shipToCountries: [],
      defaultCurrency: { id: 'USD', name: 'USD' },
      currencies: [{ id: 'USD' }, { id: 'EUR' }],
      languages: ['en'],
      regions: [],
      paymentModes: [],
      defaultLanguage: 'en',
      decimals: 2,
      address: {},
      includesTax: false,
    },
  }),
}));

// Sample product data for testing
const mockProduct = {
  id: 'test-product-123',
  name: 'Test Product',
  description: 'This is a test product',
  price: {
    amount: 99.99,
    currency: 'USD',
  },
  images: [{ url: 'https://example.com/image.jpg' }],
  purchasable: true,
};

const defaultTestShopSession: Session = {
  id: 'jest-session',
  siteCode: 'main',
  currency: 'USD',
  customerId: 'ANONYMOUS',
};

// Wrapper component to provide the store context
const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider shopSession={defaultTestShopSession}>{children}</StoreProvider>
);

describe('useProduct hook', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  /**
   * Test 1: Dispatch product fetch → Store shows loaded state
   *
   * This test verifies that when a product is fetched successfully,
   * the loading state transitions correctly and the product is stored.
   */
  test('should fetch product and update store with loaded state', async () => {
    // Mock the API response
    (fetchProductById as jest.Mock).mockResolvedValue(mockProduct);
    const { result } = renderHook(() => useProduct('test-product-123'), { wrapper });

    // Initially, loading should be true
    expect(result.current.loading).toBe(true);
    expect(result.current.product).toBe(null);
    expect(result.current.error).toBe(null);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // After loading, product should be available and loading should be false
    expect(result.current.product).toEqual(mockProduct);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);

    // Verify that the API was called with the correct ID and options
    expect(fetchProductById).toHaveBeenCalledWith('test-product-123', undefined, 'main|USD');
  });

  /**
   * Test 2: Simulate error during product fetch → Store shows error status
   *
   * This test verifies that when a product fetch fails,
   * the error state is properly set and loading is completed.
   */
  test('should handle errors during product fetch', async () => {
    // Mock console.error to suppress expected error messages
    const originalConsoleError = console.error;
    console.error = jest.fn();

    try {
      // Mock the API to throw an error
      const mockError = new Error('Failed to fetch product');
      (fetchProductById as jest.Mock).mockRejectedValue(mockError);

      // Use act to wrap the entire async operation
      const { result } = renderHook(() => useProduct('test-product-123'), { wrapper });

      // Initially, loading should be true
      expect(result.current.loading).toBe(true);
      expect(result.current.product).toBe(null);
      expect(result.current.error).toBe(null);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // After error, error state should be set and loading should be false
      expect(result.current.product).toBe(null);
      expect(result.current.error).toBe(mockError);

      // Verify that the API was called with the correct ID and options
      expect(fetchProductById).toHaveBeenCalledWith('test-product-123', undefined, 'main|USD');
    } finally {
      // Restore the original console.error
      console.error = originalConsoleError;
    }
  });

  /**
   * Test 3: Other components correctly read state from the store
   *
   * This test verifies that after using the useProduct hook,
   * the product is correctly stored in the Zustand store and
   * can be accessed by other components using useProductStore
   * directly.
   */
  test('should populate the store so other components can access the product', async () => {
    // Create a shared store
    const sharedStore = createProductStore();
    const historyStore = createHistoryStore();
    const sessionStore = createSessionStore({
      session: { id: 'test-session', siteCode: 'main', currency: 'USD', customerId: 'ANONYMOUS' },
      loading: false,
    });
    const cartStore = createCartStore();
    const customWrapper = ({ children }: { children: ReactNode }) => (
      <SessionStoreContext.Provider value={sessionStore}>
        <CartStoreContext.Provider value={cartStore}>
          <HistoryStoreContext.Provider value={historyStore}>
            <ProductStoreContext.Provider value={sharedStore}>{children}</ProductStoreContext.Provider>
          </HistoryStoreContext.Provider>
        </CartStoreContext.Provider>
      </SessionStoreContext.Provider>
    );

    // Mock the API response
    (fetchProductById as jest.Mock).mockResolvedValue(mockProduct);

    // Render the product hook with the shared store
    const { result: hookResult } = renderHook(() => useProduct('test-product-123'), { wrapper: customWrapper });

    expect(hookResult.current.loading).toBe(true);
    await waitFor(() => {
      expect(hookResult.current.loading).toBe(false);
      expect(hookResult.current.product).toEqual(mockProduct);
    });

    // Now, render a hook that directly accesses the same store
    const { result: storeResult } = renderHook(() => useProductStore(), { wrapper: customWrapper });
    // Verify that the product is in the store
    expect(storeResult.current.getProduct('test-product-123')).toEqual(mockProduct);

    // Test setting as current product
    await act(async () => {
      hookResult.current.setAsCurrent();
    });

    // Verify that the current product is set in the store
    expect(storeResult.current.getCurrentProduct()).toEqual(mockProduct);
  });

  test('id-only still fetches when sessionPricingKey is ready even if ProductStore already has that id', async () => {
    const sharedStore = createProductStore();
    const historyStore = createHistoryStore();
    const sessionStore = createSessionStore({
      session: { id: 'test-session', siteCode: 'main', currency: 'USD', customerId: 'ANONYMOUS' },
      loading: false,
    });
    const cartStore = createCartStore();
    const customWrapper = ({ children }: { children: ReactNode }) => (
      <SessionStoreContext.Provider value={sessionStore}>
        <CartStoreContext.Provider value={cartStore}>
          <HistoryStoreContext.Provider value={historyStore}>
            <ProductStoreContext.Provider value={sharedStore}>{children}</ProductStoreContext.Provider>
          </HistoryStoreContext.Provider>
        </CartStoreContext.Provider>
      </SessionStoreContext.Provider>
    );

    const { result: storeResult } = renderHook(() => useProductStore(), { wrapper: customWrapper });

    await act(async () => {
      storeResult.current.addProduct(mockProduct);
    });

    const fetchedProduct = { ...mockProduct, name: 'Fetched despite store cache' };
    (fetchProductById as jest.Mock).mockResolvedValue(fetchedProduct);

    const { result: hookResult } = renderHook(() => useProduct('test-product-123'), { wrapper: customWrapper });

    await waitFor(() => {
      expect(hookResult.current.loading).toBe(false);
    });

    expect(fetchProductById).toHaveBeenCalledWith('test-product-123', undefined, 'main|USD');
    expect(hookResult.current.product).toEqual(fetchedProduct);
  });

  test('should set error when session is irrecoverably null', async () => {
    const sharedStore = createProductStore();
    const historyStore = createHistoryStore();
    const sessionStore = createSessionStore({
      session: null,
      loading: false,
    });
    const cartStore = createCartStore();
    const customWrapper = ({ children }: { children: ReactNode }) => (
      <SessionStoreContext.Provider value={sessionStore}>
        <CartStoreContext.Provider value={cartStore}>
          <HistoryStoreContext.Provider value={historyStore}>
            <ProductStoreContext.Provider value={sharedStore}>{children}</ProductStoreContext.Provider>
          </HistoryStoreContext.Provider>
        </CartStoreContext.Provider>
      </SessionStoreContext.Provider>
    );

    const { result } = renderHook(() => useProduct('test-product-123'), { wrapper: customWrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain('Session unavailable');
    expect(fetchProductById).not.toHaveBeenCalled();
  });

  test('refetch should work correctly', async () => {
    // Create a shared store
    const sharedStore = createProductStore();
    const historyStore = createHistoryStore();
    const sessionStore = createSessionStore({
      session: { id: 'test-session', siteCode: 'main', currency: 'USD', customerId: 'ANONYMOUS' },
      loading: false,
    });
    const cartStore = createCartStore();
    const customWrapper = ({ children }: { children: ReactNode }) => (
      <SessionStoreContext.Provider value={sessionStore}>
        <CartStoreContext.Provider value={cartStore}>
          <HistoryStoreContext.Provider value={historyStore}>
            <ProductStoreContext.Provider value={sharedStore}>{children}</ProductStoreContext.Provider>
          </HistoryStoreContext.Provider>
        </CartStoreContext.Provider>
      </SessionStoreContext.Provider>
    );

    // Mock the API response
    const updatedProduct = { ...mockProduct, name: 'Updated Product' };
    (fetchProductById as jest.Mock).mockResolvedValueOnce(mockProduct);

    // Render the hook with the shared store
    const { result } = renderHook(() => useProduct('test-product-123'), { wrapper: customWrapper });

    // Update the mock to return a different product
    (fetchProductById as jest.Mock).mockResolvedValueOnce(updatedProduct);

    // Call refetch
    await act(async () => {
      result.current.refetch();
    });

    // Product should be updated
    expect(result.current.product).toEqual(updatedProduct);
    expect(result.current.loading).toBe(false);

    // Update the mock to return a third product
    const thirdProduct = { ...mockProduct, name: 'Third Product' };
    (fetchProductById as jest.Mock).mockResolvedValueOnce(thirdProduct);

    // Call refetch
    await act(async () => {
      result.current.refetch();
    });

    // Product should be updated
    expect(result.current.product).toEqual(thirdProduct);
    expect(result.current.loading).toBe(false);
  });

  /**
   * Cold-bootstrap race (preserve-on-failure contract for Phase 2).
   * Public PDP SSR seeds omit price.currency (PUBLIC_PRODUCT_OPTIONS.prices = false).
   * When sessionPricingKey arrives, current production force-refreshes and clears product to null;
   * a failed/null client refetch then yields loading=false + product=null (false Not Found path).
   * Wishlist is not involved — no wishlist mocks.
   */
  describe('cold-bootstrap SSR seed + sessionPricingKey race', () => {
    const publicProductOptions = {
      prices: false,
      variants: false,
      categories: false,
      availability: false,
      customerSegments: false,
    };

    const ssrProductWithoutPrice = {
      id: 'enjoysolar-200w-module',
      name: 'EnjoySolar 200W Module',
      description: 'SSR public product without displayable price',
      purchasable: true,
      // intentionally no price.currency — mirrors public SSR seed
    };

    const readySession: Session = {
      id: 'cold-session',
      siteCode: 'main',
      currency: 'USD',
      customerId: 'ANONYMOUS',
    };

    const createBootstrapWrapper = (sessionStore: ReturnType<typeof createSessionStore>) => {
      const sharedStore = createProductStore();
      const historyStore = createHistoryStore();
      const cartStore = createCartStore();
      return ({ children }: { children: ReactNode }) => (
        <SessionStoreContext.Provider value={sessionStore}>
          <CartStoreContext.Provider value={cartStore}>
            <HistoryStoreContext.Provider value={historyStore}>
              <ProductStoreContext.Provider value={sharedStore}>{children}</ProductStoreContext.Provider>
            </HistoryStoreContext.Provider>
          </CartStoreContext.Provider>
        </SessionStoreContext.Provider>
      );
    };

    test('does not catalog-refetch when hook argument is an SSR Product object with ready session', async () => {
      const sessionStore = createSessionStore({
        session: readySession,
        loading: false,
      });
      const customWrapper = createBootstrapWrapper(sessionStore);
      (fetchProductById as jest.Mock).mockRejectedValue(new Error('should not be called'));

      const { result } = renderHook(() => useProduct(ssrProductWithoutPrice, publicProductOptions), {
        wrapper: customWrapper,
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.product).not.toBeNull();
      expect(result.current.product?.id).toBe(ssrProductWithoutPrice.id);
      expect(result.current.error).toBe(null);
      expect(fetchProductById).not.toHaveBeenCalled();
    });

    test('does not catalog-refetch when sessionPricingKey changes for an SSR Product object', async () => {
      const sessionStore = createSessionStore({
        session: readySession,
        loading: false,
      });
      const customWrapper = createBootstrapWrapper(sessionStore);
      (fetchProductById as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() => useProduct(ssrProductWithoutPrice, publicProductOptions), {
        wrapper: customWrapper,
      });

      expect(fetchProductById).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(false);

      await act(async () => {
        sessionStore.getState().setSession({ ...readySession, currency: 'EUR' });
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.product).not.toBeNull();
      expect(result.current.product?.id).toBe(ssrProductWithoutPrice.id);
      expect(result.current.error).toBe(null);
      expect(fetchProductById).not.toHaveBeenCalled();
    });

    test('does not catalog-refetch when sessionPricingKey is introduced after cold start for an SSR Product object', async () => {
      const sessionStore = createSessionStore({
        // Incomplete session — no siteCode/currency yet (sessionPricingKey empty)
        session: { id: 'cold-incomplete', customerId: 'ANONYMOUS', siteCode: '', currency: '' },
        loading: true,
      });
      const customWrapper = createBootstrapWrapper(sessionStore);
      (fetchProductById as jest.Mock).mockRejectedValue(new Error('should not be called'));

      const { result } = renderHook(() => useProduct(ssrProductWithoutPrice, publicProductOptions), {
        wrapper: customWrapper,
      });

      expect(result.current.product?.id).toBe(ssrProductWithoutPrice.id);
      expect(result.current.loading).toBe(false);
      expect(fetchProductById).not.toHaveBeenCalled();

      await act(async () => {
        sessionStore.getState().setSession(readySession);
        sessionStore.getState().setLoading(false);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.product).not.toBeNull();
      expect(result.current.product?.id).toBe(ssrProductWithoutPrice.id);
      expect(result.current.error).toBe(null);
      expect(fetchProductById).not.toHaveBeenCalled();
    });

    test('explicit refetch still fetches for an SSR Product object seed', async () => {
      const sessionStore = createSessionStore({
        session: readySession,
        loading: false,
      });
      const customWrapper = createBootstrapWrapper(sessionStore);
      const refetchedProduct = { ...ssrProductWithoutPrice, name: 'Refetched catalog product' };
      (fetchProductById as jest.Mock).mockResolvedValue(refetchedProduct);

      const { result } = renderHook(() => useProduct(ssrProductWithoutPrice, publicProductOptions), {
        wrapper: customWrapper,
      });

      expect(fetchProductById).not.toHaveBeenCalled();

      await act(async () => {
        await result.current.refetch();
      });

      expect(fetchProductById).toHaveBeenCalledWith(ssrProductWithoutPrice.id, publicProductOptions, 'main|USD');
      expect(result.current.product?.name).toBe(refetchedProduct.name);
      expect(result.current.loading).toBe(false);
    });

    test('session-null fail-safe does not strand SSR-seeded product as null without loading', async () => {
      const sessionStore = createSessionStore({
        session: null,
        loading: false,
      });
      const customWrapper = createBootstrapWrapper(sessionStore);

      const { result } = renderHook(() => useProduct(ssrProductWithoutPrice, publicProductOptions), {
        wrapper: customWrapper,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.product).not.toBeNull();
      expect(result.current.product?.id).toBe(ssrProductWithoutPrice.id);
      expect(fetchProductById).not.toHaveBeenCalled();
    });
  });
});
