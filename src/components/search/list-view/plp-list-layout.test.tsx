/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { Category } from '@/platform/services/model/category';
import type { BatteryIncludedFacet, SearchSortOption } from '@/platform/services/model/common';
import { PlpListLayout } from './plp-list-layout';










const mockChangeSort = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    if (values && 'count' in values) {
      return `${key}:${values.count}`;
    }

    return key;
  },
}));

jest.mock('@/hooks/category/useCategoryProductCounts', () => ({
  useCategoryProductCounts: () => ({
    counts: { 'child-1': 7 },
    requestCounts: jest.fn(),
  }),
}));

jest.mock('@/components/search/list-view/plp-category-breadcrumbs', () => ({
  PlpCategoryBreadcrumbs: () => <div data-testid="plp-category-breadcrumbs" />,
}));

jest.mock('@/components/search/list-view/plp-category-tree', () => ({
  PlpCategoryTree: () => <div data-testid="plp-category-tree" />,
}));

jest.mock('@/components/search/facets', () => ({
  PlpFacetPanel: () => <div data-testid="plp-facet-panel" />,
}));

jest.mock('@/components/search/search-product-tile-grid', () => ({
  SearchProductTileGrid: () => <div data-testid="search-product-tile-grid" />,
}));

const batteryIncludedFacets: BatteryIncludedFacet[] = [
  {
    id: 'color',
    label: 'Color',
    kind: 'select',
    options: [{ id: 'red', label: 'Red', active: false }],
  },
];

const availableSorts: SearchSortOption[] = [
  {
    id: 'name',
    label: 'Product name',
    directions: ['asc', 'desc'],
    defaultDirection: 'asc',
  },
];

const child: Category = {
  id: 'child-1',
  name: { en: 'Current Category' },
  description: { en: 'Current category description' },
  children: [],
};

const parent: Category = {
  id: 'parent-1',
  name: { en: 'Parent Category' },
  children: [child],
};

const renderLayout = (selectedCategoryId?: string) => {
  render(
    <PlpListLayout
      products={[]}
      locale="en"
      pageSize={12}
      total={42}
      loading={false}
      navigationRoots={[parent]}
      selectedCategoryId={selectedCategoryId}
      hasMore={false}
      loadingMore={false}
      loadMore={jest.fn()}
      availableSorts={availableSorts}
      batteryIncludedFacets={batteryIncludedFacets}
      activeFilters={{}}
      currentSort="name:asc"
      applyFacet={jest.fn()}
      applyRangeFacet={jest.fn()}
      changeSort={mockChangeSort}
      resetFacet={jest.fn()}
    />,
  );
};

describe('PlpListLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the selected category summary with synced count semantics', () => {
    renderLayout('child-1');

    const summary = screen.getByTestId('plp-category-summary');

    expect(summary).toHaveTextContent('Current Category');
    expect(summary).toHaveTextContent('productCount:7');
    expect(summary).toHaveTextContent('Current category description');
  });

  it('falls back to the all products summary at the root level', () => {
    renderLayout();

    const summary = screen.getByTestId('plp-category-summary');

    expect(summary).toHaveTextContent('allProducts');
    expect(summary).toHaveTextContent('productCount:42');
    expect(summary).not.toHaveTextContent('Current category description');
  });

  it('renders the sort control between the desktop category tree and facet panel', () => {
    renderLayout('child-1');

    const aside = screen.getByLabelText('allProducts');
    const tree = screen.getByTestId('plp-category-tree');
    const sort = screen.getByRole('combobox');
    const facetPanel = screen.getByTestId('plp-facet-panel');

    expect(aside).toContainElement(tree);
    expect(aside).toContainElement(sort);
    expect(aside).toContainElement(facetPanel);
    expect(tree.compareDocumentPosition(sort) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sort.compareDocumentPosition(facetPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sort).toHaveTextContent('Product name');
  });
});
