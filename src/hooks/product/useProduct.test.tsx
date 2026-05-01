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

  test('should use cached product from store if available', async () => {
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

    // First, add a product to the store
    const { result: storeResult } = renderHook(() => useProductStore(), { wrapper: customWrapper });

    await act(async () => {
      storeResult.current.addProduct(mockProduct);
    });

    // Now, render the useProduct hook with the same product ID
    const { result: hookResult } = renderHook(() => useProduct('test-product-123'), { wrapper: customWrapper });

    // Product should be immediately available without loading
    expect(hookResult.current.loading).toBe(false);
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
});
