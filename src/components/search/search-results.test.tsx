/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PlpCategoryContext } from '@/lib/category/plp-category-context';
import { MobileCategoryDrawer } from './mobile-category-drawer';
import { SearchResultsComponent } from './search-results';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/hooks/search/useSearch', () => ({
  useSearch: () => ({
    data: [],
    loading: false,
    loadingMore: false,
    hasMore: false,
    total: 0,
    facets: {},
    currentPage: 1,
    pageSize: 12,
    search: jest.fn(),
    loadMore: jest.fn(),
    applyFacet: jest.fn(),
    applyRangeFacet: jest.fn(),
    applyAllFacets: jest.fn(),
    resetFacet: jest.fn(),
    resetAllFacets: jest.fn(),
    activeFilters: {},
    syncBrowseSearchStateFromUrl: jest.fn(),
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
  SearchResultsGrid: () => <div data-testid="SearchResultsGrid" />,
}));
jest.mock('@/components/search/search-results-list', () => ({
  SearchResultsList: ({ topControlsNode }: any) => <div data-testid="SearchResultsList">{topControlsNode}</div>,
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
