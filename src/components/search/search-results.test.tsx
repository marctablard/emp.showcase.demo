/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { acquireNavigationWaitCursorLease, releaseNavigationWaitCursorLease } from '@/hooks/common/useGlobalCursor';
import { browseSearchStateSignature } from '@/utils/filterUtils';
import { SearchResultsComponent } from './search-results';

const mockSearch = jest.fn();
const mockSyncBrowseSearchStateFromUrl = jest.fn();
let mockSearchParams = new URLSearchParams();
let searchResultsGridProps: { pendingCursor?: boolean } | null = null;
let searchResultsListProps: { pendingCursor?: boolean } | null = null;
let activeFiltersWithResetProps: Record<string, unknown> | null = null;
let mobileCategoryDrawerProps: Record<string, unknown> | null = null;
let searchSortProps: Record<string, unknown>[] = [];

interface MockUseSearchState {
  loading: boolean;
  currentPage: number;
  pageSize: number;
  currentQuery?: string;
  currentSort?: string;
  activeFilters: Record<string, unknown>;
}

let mockUseSearchState: MockUseSearchState;

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

jest.mock('@/components/search/mobile-category-drawer', () => ({
  MobileCategoryDrawer: (props: any) => {
    mobileCategoryDrawerProps = props;
    return <div data-testid="MobileCategoryDrawer" />;
  },
}));

jest.mock('@/hooks/search/useSearch', () => ({
  useSearch: () => ({
    data: [],
    loading: mockUseSearchState.loading,
    loadingMore: false,
    hasMore: false,
    total: 0,
    facets: [],
    availableSorts: [
      {
        id: 'name',
        label: 'Name',
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
  }),
}));

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
  SearchFilter: () => <div data-testid="SearchFilter" />,
}));
jest.mock('@/components/search/search-sort', () => ({
  SearchSort: (props: any) => {
    searchSortProps.push(props);
    return <div data-testid="SearchSort" />;
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
    };
    searchResultsGridProps = null;
    searchResultsListProps = null;
    activeFiltersWithResetProps = null;
    mobileCategoryDrawerProps = null;
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
    expect(mobileCategoryDrawerProps).toMatchObject({
      facets: [
        {
          id: 'color',
          kind: 'select',
        },
      ],
    });
    expect(searchSortProps.at(-1)).toMatchObject({
      availableSorts: [
        {
          id: 'name',
          label: 'Name',
        },
      ],
      currentSort: undefined,
      changeSort: expect.any(Function),
    });
  });

  it('keeps the generic desktop filter surface for non-PLP search results', () => {
    render(<SearchResultsComponent locale="en" initialLayout="list" />);

    expect(screen.getAllByTestId('SearchFilter')).toHaveLength(2);
    expect(screen.getAllByTestId('SearchSort')).toHaveLength(2);
    expect(screen.queryByTestId('MobileCategoryDrawer')).not.toBeInTheDocument();
  });

  it('passes sort state and handler through to the list view for desktop PLP placement', () => {
    render(<SearchResultsComponent locale="en" initialLayout="list" />);

    expect(searchResultsListProps).toMatchObject({
      availableSorts: [
        {
          id: 'name',
          label: 'Name',
        },
      ],
      currentSort: undefined,
      changeSort: expect.any(Function),
    });
  });
});
