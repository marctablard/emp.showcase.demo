/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { Category } from '@/platform/services/model/category';
import type { BatteryIncludedFacet } from '@/platform/services/model/common';
import { PlpListLayout } from './plp-list-layout';

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

jest.mock('@/components/search/list-view/plp-category-carousel', () => ({
  PlpCategoryCarousel: () => <div data-testid="plp-category-carousel" />,
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

describe('PlpListLayout', () => {
  const batteryIncludedFacets: BatteryIncludedFacet[] = [
    {
      id: 'color',
      label: 'Color',
      kind: 'select',
      options: [{ id: 'red', label: 'Red', active: false }],
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

  it('renders the selected category summary with synced count semantics', () => {
    render(
      <PlpListLayout
        products={[]}
        locale="en"
        pageSize={12}
        total={42}
        loading={false}
        navigationRoots={[parent]}
        selectedCategoryId="child-1"
        hasMore={false}
        loadingMore={false}
        loadMore={jest.fn()}
        batteryIncludedFacets={batteryIncludedFacets}
        activeFilters={{}}
        applyFacet={jest.fn()}
        applyRangeFacet={jest.fn()}
        resetFacet={jest.fn()}
      />,
    );

    const summary = screen.getByTestId('plp-category-summary');

    expect(summary).toHaveTextContent('Current Category');
    expect(summary).toHaveTextContent('productCount:7');
    expect(summary).toHaveTextContent('Current category description');
  });

  it('falls back to the all products summary at the root level', () => {
    render(
      <PlpListLayout
        products={[]}
        locale="en"
        pageSize={12}
        total={42}
        loading={false}
        navigationRoots={[parent]}
        hasMore={false}
        loadingMore={false}
        loadMore={jest.fn()}
        batteryIncludedFacets={batteryIncludedFacets}
        activeFilters={{}}
        applyFacet={jest.fn()}
        applyRangeFacet={jest.fn()}
        resetFacet={jest.fn()}
      />,
    );

    const summary = screen.getByTestId('plp-category-summary');

    expect(summary).toHaveTextContent('allProducts');
    expect(summary).toHaveTextContent('productCount:42');
    expect(summary).not.toHaveTextContent('Current category description');
  });

  it('renders the facet panel directly below the desktop category tree', () => {
    render(
      <PlpListLayout
        products={[]}
        locale="en"
        pageSize={12}
        total={42}
        loading={false}
        navigationRoots={[parent]}
        selectedCategoryId="child-1"
        hasMore={false}
        loadingMore={false}
        loadMore={jest.fn()}
        batteryIncludedFacets={batteryIncludedFacets}
        activeFilters={{}}
        applyFacet={jest.fn()}
        applyRangeFacet={jest.fn()}
        resetFacet={jest.fn()}
      />,
    );

    const tree = screen.getByTestId('plp-category-tree');
    const facetPanel = screen.getByTestId('plp-facet-panel');

    expect(tree.compareDocumentPosition(facetPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
