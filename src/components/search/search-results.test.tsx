/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { acquireNavigationWaitCursorLease, releaseNavigationWaitCursorLease } from '@/hooks/common/useGlobalCursor';
import type { PlpCategoryContext } from '@/lib/category/plp-category-context';
import { browseSearchStateSignature } from '@/utils/filterUtils';
import { MobileCategoryDrawer } from './mobile-category-drawer';
import { SearchResultsComponent } from './search-results';

const mockSearch = jest.fn();
const mockSyncBrowseSearchStateFromUrl = jest.fn();
let mockSearchParams = new URLSearchParams();
let searchResultsGridProps: { pendingCursor?: boolean } | null = null;
let searchResultsListProps: { pendingCursor?: boolean } | null = null;

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

jest.mock('@/hooks/search/useSearch', () => ({
  useSearch: () => ({
    data: [],
    loading: mockUseSearchState.loading,
    loadingMore: false,
    hasMore: false,
    total: 0,
    facets: {},
    currentPage: mockUseSearchState.currentPage,
    pageSize: mockUseSearchState.pageSize,
    currentQuery: mockUseSearchState.currentQuery,
    currentSort: mockUseSearchState.currentSort,
    search: mockSearch,
    loadMore: jest.fn(),
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
  SearchActiveFiltersWithReset: () => <div data-testid="SearchActiveFiltersWithReset" />,
}));
jest.mock('@/components/search/search-filter', () => ({
  SearchFilter: () => <div data-testid="SearchFilter" />,
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

jest.mock('@/components/ui/drawer', () => {
  const React = require('react');
  const DrawerContext = React.createContext({
    open: false,
    onOpenChange: (_nextOpen: boolean) => {},
  });

  const Drawer = ({ open, onOpenChange, children }: any) => (
    <DrawerContext.Provider value={{ open, onOpenChange }}>{children}</DrawerContext.Provider>
  );

  const DrawerTrigger = ({ asChild, children }: any) => {
    const { onOpenChange } = React.useContext(DrawerContext);
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        onClick: (event: React.MouseEvent) => {
          children.props.onClick?.(event);
          onOpenChange(true);
        },
      });
    }
    return <button onClick={() => onOpenChange(true)}>{children}</button>;
  };

  const DrawerClose = ({ asChild, children }: any) => {
    const { onOpenChange } = React.useContext(DrawerContext);
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        onClick: (event: React.MouseEvent) => {
          children.props.onClick?.(event);
          onOpenChange(false);
        },
      });
    }
    return <button onClick={() => onOpenChange(false)}>{children}</button>;
  };

  const DrawerContent = ({ children }: any) => {
    const { open } = React.useContext(DrawerContext);
    if (!open) {
      return null;
    }
    return <div role="dialog">{children}</div>;
  };

  const DrawerTitle = ({ asChild, children }: any) => {
    if (asChild && React.isValidElement(children)) {
      return children;
    }
    return <h2>{children}</h2>;
  };

  return {
    Drawer,
    DrawerTrigger,
    DrawerClose,
    DrawerContent,
    DrawerTitle,
  };
});

const mockPlpCategoryContext: PlpCategoryContext = {
  ancestorTrail: [],
  currentCategory: undefined,
  currentChildren: [],
  ribbonCategories: [],
  sidebarCountCategoryIds: [],
};

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
});

describe('MobileCategoryDrawer', () => {
  it('opens a drawer dialog with heading via trigger', async () => {
    render(<MobileCategoryDrawer plpCategoryContext={mockPlpCategoryContext} locale="en" total={12} />);

    fireEvent.click(screen.getByRole('button', { name: 'filterButton' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'filterButton' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'showProducts' })).toBeInTheDocument();
  });

  it('closes the drawer via close action', async () => {
    render(<MobileCategoryDrawer plpCategoryContext={mockPlpCategoryContext} locale="en" total={12} />);

    fireEvent.click(screen.getByRole('button', { name: 'filterButton' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'filterButton' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'showProducts' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
