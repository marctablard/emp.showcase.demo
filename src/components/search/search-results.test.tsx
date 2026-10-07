/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import { type ProductsModeContextValue, ProductsModeProvider } from '@/components/navigation/products-mode-context';
import { acquireNavigationWaitCursorLease, releaseNavigationWaitCursorLease } from '@/hooks/common/useGlobalCursor';
import { resetInFlightSearchRequests } from '@/lib/client/search';
import type { Product } from '@/platform/services/model/product';
import { browseSearchStateSignature } from '@/utils/filterUtils';
import { SearchResultsComponent } from './search-results';

const mockSearch = jest.fn();
const mockSyncBrowseSearchStateFromUrl = jest.fn();
let mockSearchParams = new URLSearchParams();
let searchResultsGridProps: { pendingCursor?: boolean; loading?: boolean; products?: Product[] } | null = null;
let searchResultsListProps: { pendingCursor?: boolean; loading?: boolean; products?: Product[] } | null = null;
let activeFiltersWithResetProps: Record<string, unknown> | null = null;
let mobileCategoryDrawerProps: Record<string, unknown> | null = null;
let searchFilterProps: Record<string, unknown>[] = [];
let searchSortProps: Record<string, unknown>[] = [];

const existingProduct: Product = {
  id: 'p-1',
  name: { en: 'Test product' },
  description: { en: 'Description' },
  purchasable: true,
};

interface MockUseSearchState {
  loading: boolean;
  currentPage: number;
  pageSize: number;
  currentQuery?: string;
  currentSort?: string;
  activeFilters: Record<string, unknown>;
  data: Product[];
}

let mockUseSearchState: MockUseSearchState;
const useSearchTestMode = { useRealHook: false };

const emptySsrResults = {
  items: [],
  total: 0,
  page: 0,
  pageSize: 12,
  availableFilters: [],
  availableSorts: [],
};

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/browse',
}));

jest.mock('@/hooks/history/useHistory', () => ({
  __esModule: true,
  default: () => ({ addSearchQuery: jest.fn() }),
}));

jest.mock('@/providers/StoreProvider', () => ({
  useSessionStore: () => ({ session: { currency: 'EUR' } }),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({ warn: jest.fn(), error: jest.fn() }),
}));

jest.mock('@/lib/client/customer-segment', () => ({
  setProductsMode: jest.fn(),
}));

jest.mock('@/hooks/site/useSiteCode', () => ({
  useSiteCode: () => 'main',
}));

jest.mock('@/hooks/search/useSearch', () => {
  const actual = jest.requireActual('@/hooks/search/useSearch');
  return {
    USE_SEARCH_CLIENT_ERROR: actual.USE_SEARCH_CLIENT_ERROR,
    useSearch: (initialSearch: unknown, initialResults: unknown) => {
      if (useSearchTestMode.useRealHook) {
        return actual.useSearch(initialSearch, initialResults);
      }
      return {
        data: mockUseSearchState.data,
        loading: mockUseSearchState.loading,
        loadingMore: false,
        hasMore: false,
        total: 0,
        facets: [],
        availableSorts: [
          {
            id: 'name',
            label: 'Product name',
            directions: ['asc', 'desc'],
            defaultDirection: 'asc',
          },
        ],
        batteryIncludedFacets: [
          {
            id: 'color',
            label: 'color',
            kind: 'select',
            options: [],
          },
        ],
        currentPage: mockUseSearchState.currentPage,
        pageSize: mockUseSearchState.pageSize,
        currentQuery: mockUseSearchState.currentQuery,
        currentSort: mockUseSearchState.currentSort,
        search: mockSearch,
        loadMore: jest.fn(),
        changeSort: jest.fn(),
        applyFacet: jest.fn(),
        applyRangeFacet: jest.fn(),
        applyAllFacets: jest.fn(),
        resetFacet: jest.fn(),
        resetAllFacets: jest.fn(),
        activeFilters: mockUseSearchState.activeFilters,
        syncBrowseSearchStateFromUrl: mockSyncBrowseSearchStateFromUrl,
        error: undefined,
      };
    },
  };
});

jest.mock('@/components/navigation/category-display-label-index-context', () => ({
  useCategoryDisplayLabelIndex: () => ({}),
}));
jest.mock('@/components/search/search-active-filters-with-reset', () => ({
  SearchActiveFiltersWithReset: (props: any) => {
    activeFiltersWithResetProps = props;
    return <div data-testid="SearchActiveFiltersWithReset" />;
  },
}));
jest.mock('@/components/search/search-filter', () => ({
  SearchFilter: (props: any) => {
    searchFilterProps.push(props);
    return <div data-testid="SearchFilter" />;
  },
}));
jest.mock('@/components/search/search-sort', () => ({
  SearchSort: (props: any) => {
    searchSortProps.push(props);
    return <div data-testid="SearchSort" />;
  },
}));
jest.mock('@/components/search/mobile-category-drawer', () => ({
  MobileCategoryDrawer: (props: any) => {
    mobileCategoryDrawerProps = props;
    return <div data-testid="MobileCategoryDrawer" />;
  },
}));
jest.mock('@/components/search/search-layout-toggle', () => ({
  SearchLayoutToggle: () => null,
}));
jest.mock('@/components/search/search-results-grid', () => ({
  SearchResultsGrid: (props: any) => {
    searchResultsGridProps = props;
    return <div data-testid="SearchResultsGrid" />;
  },
}));
jest.mock('@/components/search/search-results-list', () => ({
  SearchResultsList: (props: any) => {
    searchResultsListProps = props;
    return <div data-testid="SearchResultsList">{props.topControlsNode}</div>;
  },
}));

jest.mock('@/components/search/list-view/plp-category-tree', () => ({
  PlpCategoryTree: () => <div data-testid="PlpCategoryTree" />,
}));

describe('SearchResultsComponent', () => {
  beforeEach(() => {
    releaseNavigationWaitCursorLease({ force: true });
    resetInFlightSearchRequests();
    useSearchTestMode.useRealHook = false;
    mockSearchParams = new URLSearchParams();
    mockSearch.mockClear();
    mockSyncBrowseSearchStateFromUrl.mockClear();
    mockUseSearchState = {
      loading: false,
      currentPage: 0,
      pageSize: 12,
      currentQuery: undefined,
      currentSort: undefined,
      activeFilters: {},
      data: [],
    };
    searchResultsGridProps = null;
    searchResultsListProps = null;
    activeFiltersWithResetProps = null;
    mobileCategoryDrawerProps = null;
    searchFilterProps = [];
    searchSortProps = [];
  });

  afterEach(() => {
    releaseNavigationWaitCursorLease({ force: true });
  });

  it('renders list layout when configured by the server prop', () => {
    render(<SearchResultsComponent locale="en" initialLayout="list" />);

    expect(screen.getByTestId('SearchResultsList')).toBeInTheDocument();
    expect(screen.queryByTestId('SearchResultsGrid')).not.toBeInTheDocument();
  });

  it('renders grid layout when configured by the server prop', () => {
    render(<SearchResultsComponent locale="en" initialLayout="grid" />);

    expect(screen.getByTestId('SearchResultsGrid')).toBeInTheDocument();
    expect(screen.queryByTestId('SearchResultsList')).not.toBeInTheDocument();
  });

  it('still triggers a browse fetch when the URL only contains currency context', async () => {
    mockSearchParams = new URLSearchParams('currency=EUR');

    render(<SearchResultsComponent locale="en" initialLayout="list" />);

    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledWith({
        query: '',
        page: 0,
        size: 12,
        sort: undefined,
        filters: undefined,
      });
    });
    expect(mockSyncBrowseSearchStateFromUrl).not.toHaveBeenCalled();
  });

  it('does not refetch when SSR results already match the URL and currency is only session context', async () => {
    mockSearchParams = new URLSearchParams(
      'currency=EUR&filters%5B_product_i18n.categoryBreadcrumbs.displayPath%5D=Electrical+supplies+%3E+Power+generation+%3E+Solar+panels',
    );

    render(
      <SearchResultsComponent
        locale="en"
        initialLayout="list"
        initialSearch={{
          page: 0,
          size: 12,
          filters: {
            '_product_i18n.categoryBreadcrumbs.displayPath': 'Electrical supplies > Power generation > Solar panels',
          },
        }}
        initialResults={emptySsrResults}
      />,
    );

    await waitFor(() => {
      expect(mockSyncBrowseSearchStateFromUrl).toHaveBeenCalled();
    });
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('does not call search when initialSearch.sort matches the URL sort', async () => {
    mockSearchParams = new URLSearchParams('sort=price:asc');
    mockUseSearchState = {
      ...mockUseSearchState,
      currentSort: 'price:asc',
    };

    render(
      <SearchResultsComponent
        locale="en"
        initialLayout="list"
        initialSearch={{
          page: 0,
          size: 12,
          sort: 'price:asc',
        }}
        initialResults={emptySsrResults}
      />,
    );

    await waitFor(() => {
      expect(mockSyncBrowseSearchStateFromUrl).toHaveBeenCalled();
    });
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('does not call search when first-facet-style filters match initialSearch and hook state', async () => {
    mockSearchParams = new URLSearchParams('filters%5Bcolor%5D=red');
    mockUseSearchState = {
      ...mockUseSearchState,
      activeFilters: { color: 'red' },
    };

    render(
      <SearchResultsComponent
        locale="en"
        initialLayout="list"
        initialSearch={{
          page: 0,
          size: 12,
          filters: { color: 'red' },
        }}
        initialResults={emptySsrResults}
      />,
    );

    await waitFor(() => {
      expect(mockSyncBrowseSearchStateFromUrl).toHaveBeenCalled();
    });
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('does not double-fetch when the URL has sort and SSR initialSearch omitted sort', async () => {
    mockSearchParams = new URLSearchParams('sort=price:asc');

    render(
      <SearchResultsComponent
        locale="en"
        initialLayout="list"
        initialSearch={{
          page: 0,
          size: 12,
        }}
        initialResults={emptySsrResults}
      />,
    );

    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledTimes(1);
    });
    expect(mockSearch).toHaveBeenCalledWith({
      query: '',
      page: 0,
      size: 12,
      sort: 'price:asc',
      filters: undefined,
    });
    expect(mockSyncBrowseSearchStateFromUrl).not.toHaveBeenCalled();
  });

  it('does not fetch again for a second same-key search when initialResults is omitted', async () => {
    useSearchTestMode.useRealHook = true;
    window.history.replaceState({}, '', '/browse?sort=price%3Aasc&filters%5Bcolor%5D=red');
    mockSearchParams = new URLSearchParams('sort=price:asc&filters%5Bcolor%5D=red');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => emptySsrResults,
    });

    const initialSearch = {
      page: 0,
      size: 12,
      sort: 'price:asc',
      filters: { color: 'red' },
    };

    const { rerender } = render(
      <SearchResultsComponent locale="en" initialLayout="list" initialSearch={initialSearch} />,
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    rerender(<SearchResultsComponent locale="en" initialLayout="list" initialSearch={{ ...initialSearch }} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the cursor bridge active across repeated stale renders until hook state catches up', () => {
    const { rerender } = render(<SearchResultsComponent locale="en" initialLayout="list" />);

    expect(searchResultsListProps?.pendingCursor).toBeFalsy();

    mockSearchParams = new URLSearchParams('filters%5B_product_i18n.categoryBreadcrumbs.displayPath%5D=Smartphones');
    rerender(<SearchResultsComponent locale="en" initialLayout="list" />);

    expect(searchResultsListProps?.pendingCursor).toBe(true);

    rerender(<SearchResultsComponent locale="en" initialLayout="list" />);

    expect(searchResultsListProps?.pendingCursor).toBe(true);

    mockUseSearchState = {
      ...mockUseSearchState,
      activeFilters: {
        '_product_i18n.categoryBreadcrumbs.displayPath': 'Smartphones',
      },
    };
    rerender(<SearchResultsComponent locale="en" initialLayout="list" />);

    expect(searchResultsListProps?.pendingCursor).toBe(false);
  });

  it('keeps the global wait cursor from all-products through destination convergence for a targeted browse navigation', async () => {
    const targetSignature = browseSearchStateSignature({
      query: '',
      page: 0,
      size: 12,
      sort: undefined,
      filters: {
        '_product_i18n.categoryBreadcrumbs.displayPath': 'Smartphones',
      },
    });

    acquireNavigationWaitCursorLease(targetSignature);
    mockSearchParams = new URLSearchParams('currency=USD');

    const { rerender } = render(<SearchResultsComponent locale="en" initialLayout="list" />);

    expect(document.documentElement).toHaveAttribute('data-global-cursor', 'wait');

    rerender(<SearchResultsComponent locale="en" initialLayout="list" />);

    expect(document.documentElement).toHaveAttribute('data-global-cursor', 'wait');

    mockSearchParams = new URLSearchParams('filters%5B_product_i18n.categoryBreadcrumbs.displayPath%5D=Smartphones');
    rerender(<SearchResultsComponent locale="en" initialLayout="list" />);

    expect(document.documentElement).toHaveAttribute('data-global-cursor', 'wait');

    mockUseSearchState = {
      ...mockUseSearchState,
      activeFilters: {
        '_product_i18n.categoryBreadcrumbs.displayPath': 'Smartphones',
      },
    };
    rerender(<SearchResultsComponent locale="en" initialLayout="list" />);

    await waitFor(() => {
      expect(document.documentElement).not.toHaveAttribute('data-global-cursor');
    });
  });

  it('releases the navigation wait cursor after category navigation clears a stale sort selection', async () => {
    const targetSignature = browseSearchStateSignature({
      query: '',
      page: 0,
      size: 12,
      sort: undefined,
      filters: {
        '_product_i18n.categoryBreadcrumbs.displayPath': 'Solar panels',
      },
    });

    mockUseSearchState = {
      ...mockUseSearchState,
      currentSort: 'name:asc',
    };

    acquireNavigationWaitCursorLease(targetSignature);
    mockSearchParams = new URLSearchParams('currency=USD');

    const { rerender } = render(<SearchResultsComponent locale="en" initialLayout="list" />);

    mockSearchParams = new URLSearchParams('filters%5B_product_i18n.categoryBreadcrumbs.displayPath%5D=Solar+panels');
    rerender(<SearchResultsComponent locale="en" initialLayout="list" />);

    expect(document.documentElement).toHaveAttribute('data-global-cursor', 'wait');
    expect(searchResultsListProps?.pendingCursor).toBe(true);

    mockUseSearchState = {
      ...mockUseSearchState,
      currentSort: undefined,
      activeFilters: {
        '_product_i18n.categoryBreadcrumbs.displayPath': 'Solar panels',
      },
    };
    rerender(<SearchResultsComponent locale="en" initialLayout="list" />);

    await waitFor(() => {
      expect(document.documentElement).not.toHaveAttribute('data-global-cursor');
    });
    expect(searchResultsListProps?.pendingCursor).toBe(false);
  });

  it('passes BatteryIncluded typed facets into active-filter chips', () => {
    render(<SearchResultsComponent locale="en" initialLayout="list" />);

    expect(activeFiltersWithResetProps).toMatchObject({
      batteryIncludedFacets: [
        {
          id: 'color',
          kind: 'select',
        },
      ],
    });
  });

  it('uses the mobile PLP drawer instead of the generic filter when a PLP category context exists', () => {
    mockUseSearchState = {
      ...mockUseSearchState,
      activeFilters: {
        '_product_i18n.categoryBreadcrumbs.displayPath': 'Smartphones',
      },
    };

    render(
      <SearchResultsComponent
        locale="en"
        initialLayout="list"
        navigationRoots={[
          {
            id: 'root',
            name: { en: 'Root' },
            children: [{ id: 'child', name: { en: 'Smartphones' }, children: [] }],
          },
        ]}
      />,
    );

    expect(screen.getByTestId('MobileCategoryDrawer')).toBeInTheDocument();
    expect(screen.queryByTestId('SearchFilter')).not.toBeInTheDocument();
    expect(screen.queryByTestId('SearchActiveFiltersWithReset')).not.toBeInTheDocument();
    expect(screen.getByTestId('SearchSort')).toBeInTheDocument();
    expect(screen.queryByTestId('SearchResultsList')).toBeInTheDocument();
    expect(screen.getByTestId('MobileCategoryDrawer').parentElement).toHaveClass('shrink-0');
    expect(screen.getByTestId('SearchSort').parentElement).toHaveClass('w-[261px]', 'shrink-0');
    expect(mobileCategoryDrawerProps).toMatchObject({ appliedFilterCount: 0 });
  });

  it('keeps the generic desktop filter surface for non-PLP search results', () => {
    render(<SearchResultsComponent locale="en" initialLayout="list" />);

    expect(screen.getAllByTestId('SearchFilter')).toHaveLength(2);
    expect(screen.getAllByTestId('SearchSort')).toHaveLength(2);
    expect(screen.queryByTestId('MobileCategoryDrawer')).not.toBeInTheDocument();
    expect(searchFilterProps[0]).toMatchObject({ appliedFilterCount: 0 });
  });

  it('counts only non-category active filters for the mobile trigger badge', () => {
    mockUseSearchState = {
      ...mockUseSearchState,
      activeFilters: {
        color: 'red',
        '_product_i18n.categoryBreadcrumbs.displayPath': 'Smartphones',
      },
    };

    render(
      <SearchResultsComponent
        locale="en"
        initialLayout="list"
        navigationRoots={[
          {
            id: 'root',
            name: { en: 'Root' },
            children: [{ id: 'child', name: { en: 'Smartphones' }, children: [] }],
          },
        ]}
      />,
    );

    expect(mobileCategoryDrawerProps).toMatchObject({ appliedFilterCount: 1 });
  });

  it('passes sort state through to the list layout header placement', () => {
    mockSearchParams = new URLSearchParams('q=tubes');
    mockUseSearchState = {
      ...mockUseSearchState,
      currentQuery: 'tubes',
      currentSort: 'name:asc',
    };

    render(<SearchResultsComponent locale="en" initialLayout="list" />);

    expect(searchResultsListProps).toMatchObject({
      searchQuery: 'tubes',
      availableSorts: [
        {
          id: 'name',
          label: 'Product name',
        },
      ],
      currentSort: 'name:asc',
      changeSort: expect.any(Function),
    });
  });

  it('passes existing products to the list while a refinement search is loading', () => {
    mockUseSearchState = {
      ...mockUseSearchState,
      loading: true,
      data: [existingProduct],
    };

    render(<SearchResultsComponent locale="en" initialLayout="list" />);

    expect(searchResultsListProps).toMatchObject({
      loading: true,
      products: [existingProduct],
    });
    expect(screen.queryByTestId('product-tile-skeleton')).not.toBeInTheDocument();
  });

  describe('products mode switch in the grid layout (COP-4822 CR-1)', () => {
    const segmented = (canToggleAllProducts: boolean): ProductsModeContextValue => ({
      mode: 'assigned',
      isSegmented: true,
      canToggleAllProducts,
    });

    const renderWithMode = (layout: 'grid' | 'list', value: ProductsModeContextValue) =>
      render(
        <ProductsModeProvider value={value}>
          <SearchResultsComponent locale="en" initialLayout={layout} />
        </ProductsModeProvider>,
      );

    it('mounts the switch once above the Filter + Sort toolbar when the toggle is available', () => {
      renderWithMode('grid', segmented(true));

      const switches = screen.getAllByTestId('plp-productsModeSwitch');
      expect(switches).toHaveLength(1);

      const control = switches[0];
      const [firstFilter] = screen.getAllByTestId('SearchFilter');
      const [firstSort] = screen.getAllByTestId('SearchSort');
      const grid = screen.getByTestId('SearchResultsGrid');

      expect(control).toHaveAttribute('role', 'radiogroup');
      expect(screen.getByTestId('plp-productsModeAssigned')).toBeChecked();
      expect(screen.getByTestId('plp-productsModeLabel')).toHaveTextContent('assignedProductsShort');
      expect(screen.getByRole('radio', { name: 'allProductsShort' })).toBeInTheDocument();
      expect(grid).not.toContainElement(control);
      expect(control.compareDocumentPosition(firstFilter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(control.compareDocumentPosition(firstSort) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(control.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('does not mount the switch in the grid layout when the toggle is not available', () => {
      renderWithMode('grid', segmented(false));

      expect(screen.getByTestId('SearchResultsGrid')).toBeInTheDocument();
      expect(screen.queryByTestId('plp-productsModeSwitch')).not.toBeInTheDocument();
    });

    it('does not mount the switch in the grid layout for an anonymous products mode context', () => {
      render(<SearchResultsComponent locale="en" initialLayout="grid" />);

      expect(screen.queryByTestId('plp-productsModeSwitch')).not.toBeInTheDocument();
    });

    it('leaves the list layout to the category tree header (no toolbar switch)', () => {
      renderWithMode('list', segmented(true));

      expect(screen.getByTestId('SearchResultsList')).toBeInTheDocument();
      expect(screen.queryByTestId('plp-productsModeSwitch')).not.toBeInTheDocument();
    });
  });

  it('passes existing products to the grid while a refinement search is loading', () => {
    mockUseSearchState = {
      ...mockUseSearchState,
      loading: true,
      data: [existingProduct],
    };

    render(<SearchResultsComponent locale="en" initialLayout="grid" />);

    expect(searchResultsGridProps).toMatchObject({
      loading: true,
      products: [existingProduct],
    });
    expect(screen.queryByTestId('product-tile-skeleton')).not.toBeInTheDocument();
  });
});
