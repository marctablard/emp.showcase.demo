/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import { SearchFlyOut } from '@/components/header/search/search-fly-out';
import { useProductsMode } from '@/components/navigation/products-mode-context';
import { useHistory } from '@/hooks/history/useHistory';
import { clearModeScopedLastSeenCache } from '@/hooks/history/useModeScopedLastSeen';
import { fetchProductById } from '@/lib/client/products';
import type { Product } from '@/platform/services/model/product';
import type { ProductsMode } from '@/platform/services/products-mode/ProductsModeService';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/components/header/search/query-completions', () => ({
  QueryCompletions: () => <div data-testid="query-completions" />,
}));

jest.mock('@/components/header/search/side-bar', () => ({
  SideBar: () => <div data-testid="side-bar" />,
}));

jest.mock('@/components/header/search/no-results', () => ({
  NoResults: () => <div data-testid="no-results" />,
}));

jest.mock('@/components/product/product-tile-fly-out', () => ({
  ProductTileFlyOut: ({ product }: { product: Product }) => <div data-testid={`tile-${product.id}`} />,
}));

jest.mock('@/components/navigation/products-mode-context', () => ({
  useProductsMode: jest.fn(),
}));

jest.mock('@/hooks/history/useHistory', () => ({
  useHistory: jest.fn(),
}));

const mockLoggerDebug = jest.fn();
const mockLogger = { debug: mockLoggerDebug, info: jest.fn(), warn: jest.fn(), error: jest.fn() };
jest.mock('@/hooks/common/useLogger', () => ({
  // Stable reference like the real memoised hook.
  useLogger: () => mockLogger,
}));

jest.mock('@/lib/client/products', () => ({
  fetchProductById: jest.fn(),
}));

const mockUseProductsMode = useProductsMode as jest.MockedFunction<typeof useProductsMode>;
const mockUseHistory = useHistory as jest.MockedFunction<typeof useHistory>;
const mockFetchProductById = fetchProductById as jest.MockedFunction<typeof fetchProductById>;

const product = (id: string): Product => ({ id, name: { en: `Product ${id}` } }) as unknown as Product;

const IN_SCOPE = product('in-scope');
const OUT_OF_SCOPE = product('out-of-scope');
const ALSO_IN_SCOPE = product('also-in-scope');

function setMode(mode: ProductsMode) {
  mockUseProductsMode.mockReturnValue({
    mode,
    isSegmented: mode === 'assigned',
    canToggleAllProducts: false,
  });
}

function setLastSeen(products: Product[]) {
  mockUseHistory.mockReturnValue({
    lastSeenProducts: products,
    searchHistory: [],
    addLastSeenProduct: jest.fn(),
    addSearchQuery: jest.fn(),
    clearLastSeenProducts: jest.fn(),
    clearSearchHistory: jest.fn(),
  });
}

function renderFlyOut() {
  return render(
    <SearchFlyOut
      suggestions={{ categories: [], queryCompletions: [], products: [] }}
      hasInitialSearch
      query=""
      loading={false}
      setQuery={jest.fn()}
    />,
  );
}

describe('SearchFlyOut last-seen products (COP-4822 products mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearModeScopedLastSeenCache();
    mockFetchProductById.mockImplementation(async (id) => (id === OUT_OF_SCOPE.id ? null : product(id)));
  });

  describe.each<ProductsMode>(['anonymous', 'unsegmented', 'all'])('in %s mode', (mode) => {
    it('renders the cached last-seen products without any product request', () => {
      setMode(mode);
      setLastSeen([IN_SCOPE, OUT_OF_SCOPE]);

      renderFlyOut();

      expect(screen.getByTestId(`tile-${IN_SCOPE.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`tile-${OUT_OF_SCOPE.id}`)).toBeInTheDocument();
      expect(screen.getByText('lastSeenProducts')).toBeInTheDocument();
      expect(mockFetchProductById).not.toHaveBeenCalled();
    });
  });

  describe('in assigned mode', () => {
    beforeEach(() => {
      setMode('assigned');
    });

    it('renders only the products that still resolve and hides the ones answered with 404', async () => {
      setLastSeen([IN_SCOPE, OUT_OF_SCOPE, ALSO_IN_SCOPE]);

      renderFlyOut();

      await waitFor(() => expect(screen.getByTestId(`tile-${IN_SCOPE.id}`)).toBeInTheDocument());
      expect(screen.getByTestId(`tile-${ALSO_IN_SCOPE.id}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`tile-${OUT_OF_SCOPE.id}`)).not.toBeInTheDocument();

      expect(mockFetchProductById).toHaveBeenCalledTimes(3);
      expect(mockFetchProductById).toHaveBeenCalledWith(IN_SCOPE.id);
      expect(mockFetchProductById).toHaveBeenCalledWith(OUT_OF_SCOPE.id);
      expect(mockFetchProductById).toHaveBeenCalledWith(ALSO_IN_SCOPE.id);
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        { mode: 'assigned', total: 3, dropped: 1 },
        'Hid last-seen products outside the assigned products scope',
      );
    });

    it('keeps the list and "no results" hidden while the validation is pending', async () => {
      let resolveLookup: (value: Product | null) => void = () => {};
      mockFetchProductById.mockImplementation(
        () =>
          new Promise<Product | null>((resolve) => {
            resolveLookup = resolve;
          }),
      );
      setLastSeen([OUT_OF_SCOPE]);

      renderFlyOut();

      expect(screen.queryByTestId(`tile-${OUT_OF_SCOPE.id}`)).not.toBeInTheDocument();
      expect(screen.queryByText('lastSeenProducts')).not.toBeInTheDocument();
      expect(screen.queryByTestId('no-results')).not.toBeInTheDocument();

      await act(async () => {
        resolveLookup(null);
      });

      expect(screen.queryByTestId(`tile-${OUT_OF_SCOPE.id}`)).not.toBeInTheDocument();
      expect(screen.getByTestId('no-results')).toBeInTheDocument();
    });

    it('does not refetch when the fly-out is re-opened with the same ids', async () => {
      setLastSeen([IN_SCOPE, OUT_OF_SCOPE]);

      const first = renderFlyOut();
      await waitFor(() => expect(screen.getByTestId(`tile-${IN_SCOPE.id}`)).toBeInTheDocument());
      expect(mockFetchProductById).toHaveBeenCalledTimes(2);
      first.unmount();

      renderFlyOut();
      await waitFor(() => expect(screen.getByTestId(`tile-${IN_SCOPE.id}`)).toBeInTheDocument());
      expect(screen.queryByTestId(`tile-${OUT_OF_SCOPE.id}`)).not.toBeInTheDocument();
      expect(mockFetchProductById).toHaveBeenCalledTimes(2);
    });

    it('re-validates when the last-seen ids change', async () => {
      setLastSeen([IN_SCOPE]);

      const { rerender } = renderFlyOut();
      await waitFor(() => expect(screen.getByTestId(`tile-${IN_SCOPE.id}`)).toBeInTheDocument());
      expect(mockFetchProductById).toHaveBeenCalledTimes(1);

      setLastSeen([IN_SCOPE, ALSO_IN_SCOPE]);
      rerender(
        <SearchFlyOut
          suggestions={{ categories: [], queryCompletions: [], products: [] }}
          hasInitialSearch
          query=""
          loading={false}
          setQuery={jest.fn()}
        />,
      );

      await waitFor(() => expect(screen.getByTestId(`tile-${ALSO_IN_SCOPE.id}`)).toBeInTheDocument());
      expect(mockFetchProductById).toHaveBeenCalledTimes(3);
    });

    it('hides every cached item when a lookup fails (fail closed)', async () => {
      mockFetchProductById.mockRejectedValue(new Error('network'));
      setLastSeen([IN_SCOPE]);

      renderFlyOut();

      await waitFor(() => expect(screen.getByTestId('no-results')).toBeInTheDocument());
      expect(screen.queryByTestId(`tile-${IN_SCOPE.id}`)).not.toBeInTheDocument();
    });
  });

  describe('mode transitions', () => {
    const rerenderFlyOut = (rerender: ReturnType<typeof render>['rerender']) =>
      rerender(
        <SearchFlyOut
          suggestions={{ categories: [], queryCompletions: [], products: [] }}
          hasInitialSearch
          query=""
          loading={false}
          setQuery={jest.fn()}
        />,
      );

    it('ALL → ASSIGNED validates the cached items and hides the out-of-scope one', async () => {
      setMode('all');
      setLastSeen([IN_SCOPE, OUT_OF_SCOPE]);

      const { rerender } = renderFlyOut();
      expect(screen.getByTestId(`tile-${OUT_OF_SCOPE.id}`)).toBeInTheDocument();
      expect(mockFetchProductById).not.toHaveBeenCalled();

      setMode('assigned');
      rerenderFlyOut(rerender);

      await waitFor(() => expect(screen.queryByTestId(`tile-${OUT_OF_SCOPE.id}`)).not.toBeInTheDocument());
      await waitFor(() => expect(screen.getByTestId(`tile-${IN_SCOPE.id}`)).toBeInTheDocument());
      expect(mockFetchProductById).toHaveBeenCalledTimes(2);
    });

    it('ASSIGNED → ALL shows every cached item again without new requests', async () => {
      setMode('assigned');
      setLastSeen([IN_SCOPE, OUT_OF_SCOPE]);

      const { rerender } = renderFlyOut();
      await waitFor(() => expect(screen.getByTestId(`tile-${IN_SCOPE.id}`)).toBeInTheDocument());
      expect(screen.queryByTestId(`tile-${OUT_OF_SCOPE.id}`)).not.toBeInTheDocument();
      expect(mockFetchProductById).toHaveBeenCalledTimes(2);

      setMode('all');
      rerenderFlyOut(rerender);

      expect(screen.getByTestId(`tile-${IN_SCOPE.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`tile-${OUT_OF_SCOPE.id}`)).toBeInTheDocument();
      expect(mockFetchProductById).toHaveBeenCalledTimes(2);
    });

    it('switches modes without a render-phase state update warning', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      try {
        setMode('assigned');
        setLastSeen([IN_SCOPE, OUT_OF_SCOPE]);

        const { rerender } = renderFlyOut();
        await waitFor(() => expect(screen.getByTestId(`tile-${IN_SCOPE.id}`)).toBeInTheDocument());

        setMode('all');
        rerenderFlyOut(rerender);
        expect(screen.getByTestId(`tile-${OUT_OF_SCOPE.id}`)).toBeInTheDocument();

        setMode('assigned');
        rerenderFlyOut(rerender);
        await waitFor(() => expect(screen.getByTestId(`tile-${IN_SCOPE.id}`)).toBeInTheDocument());

        const renderPhaseWarnings = consoleErrorSpy.mock.calls.filter((call) =>
          call.some((arg) => typeof arg === 'string' && arg.includes('Cannot update a component')),
        );
        expect(renderPhaseWarnings).toHaveLength(0);
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('re-validates after leaving and re-entering assigned mode (cache cleared on logout / ALL)', async () => {
      setMode('assigned');
      setLastSeen([IN_SCOPE]);

      const { rerender } = renderFlyOut();
      await waitFor(() => expect(screen.getByTestId(`tile-${IN_SCOPE.id}`)).toBeInTheDocument());
      expect(mockFetchProductById).toHaveBeenCalledTimes(1);

      setMode('anonymous');
      rerenderFlyOut(rerender);
      expect(screen.getByTestId(`tile-${IN_SCOPE.id}`)).toBeInTheDocument();

      let resolveLookup: (value: Product | null) => void = () => {};
      mockFetchProductById.mockImplementation(
        () =>
          new Promise<Product | null>((resolve) => {
            resolveLookup = resolve;
          }),
      );
      setMode('assigned');
      rerenderFlyOut(rerender);
      // The earlier validation result is not reused: the list stays hidden until the fresh lookup resolves.
      expect(mockFetchProductById).toHaveBeenCalledTimes(2);
      expect(screen.queryByTestId(`tile-${IN_SCOPE.id}`)).not.toBeInTheDocument();

      await act(async () => {
        resolveLookup(IN_SCOPE);
      });
      expect(screen.getByTestId(`tile-${IN_SCOPE.id}`)).toBeInTheDocument();
    });
  });
});
