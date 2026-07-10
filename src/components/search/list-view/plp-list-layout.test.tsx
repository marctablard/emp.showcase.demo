/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { PlpCategoryContext } from '@/lib/category/plp-category-context';
import type { Category } from '@/platform/services/model/category';
import { BATTERY_INCLUDED_BREADCRUMB_FILTER } from '@/platform/services/model/category/batteryincluded-category';
import type { BatteryIncludedFacet, SearchSortOption } from '@/platform/services/model/common';
import { PlpListLayout } from './plp-list-layout';

const mockChangeSort = jest.fn();
const mockRequestCounts = jest.fn();

let lastPlpCategoryTreeProps:
  | {
      plpCategoryContext: PlpCategoryContext;
      categoryCountsById: Record<string, number>;
    }
  | undefined;

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
    requestCounts: mockRequestCounts,
  }),
}));

jest.mock('@/components/search/list-view/plp-category-breadcrumbs', () => ({
  PlpCategoryBreadcrumbs: () => <div data-testid="plp-category-breadcrumbs" />,
}));

jest.mock('@/components/search/list-view/plp-category-tree', () => ({
  PlpCategoryTree: (props: { plpCategoryContext: PlpCategoryContext; categoryCountsById: Record<string, number> }) => {
    lastPlpCategoryTreeProps = props;
    return <div data-testid="plp-category-tree" />;
  },
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

const liveTreeFacets: BatteryIncludedFacet[] = [
  {
    id: BATTERY_INCLUDED_BREADCRUMB_FILTER,
    label: 'Categories',
    kind: 'tree',
    options: [
      {
        id: 'phones',
        label: 'Phones',
        count: 3,
        active: false,
        idPath: ['electronics', 'phones'],
        labelPath: ['Electronics', 'Phones'],
      },
      {
        id: 'tablets',
        label: 'Tablets',
        count: 2,
        active: false,
        idPath: ['electronics', 'tablets'],
        labelPath: ['Electronics', 'Tablets'],
      },
      {
        id: 'electronics',
        label: 'Electronics',
        count: 5,
        active: false,
        idPath: ['electronics'],
        labelPath: ['Electronics'],
      },
    ],
  },
];

const unrelatedTreeFacets: BatteryIncludedFacet[] = [
  {
    id: BATTERY_INCLUDED_BREADCRUMB_FILTER,
    label: 'Categories',
    kind: 'tree',
    options: [
      {
        id: 'appliances',
        label: 'Appliances',
        count: 4,
        active: false,
        idPath: ['appliances'],
        labelPath: ['Appliances'],
      },
    ],
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

const liveParent: Category = {
  id: 'electronics',
  name: { en: 'Static Electronics' },
  customAttributes: {
    batteryIncludedCategory: {
      source: 'batteryincluded',
      displayPath: 'Static Electronics',
      facetValue: 'Static Electronics',
      labelPath: 'Static Electronics',
      leafLabel: 'Static Electronics',
      publicationAnchorId: 'electronics',
      count: 999,
      idPath: ['electronics'],
    },
  },
  children: [],
};

const renderLayout = (options?: {
  selectedCategoryId?: string;
  facets?: BatteryIncludedFacet[];
  roots?: Category[];
  searchQuery?: string;
}) => {
  render(
    <PlpListLayout
      products={[]}
      locale="en"
      pageSize={12}
      total={42}
      loading={false}
      navigationRoots={options?.roots ?? [parent]}
      selectedCategoryId={options?.selectedCategoryId}
      hasMore={false}
      loadingMore={false}
      loadMore={jest.fn()}
      availableSorts={availableSorts}
      batteryIncludedFacets={options?.facets ?? batteryIncludedFacets}
      activeFilters={{}}
      currentSort="name:asc"
      applyFacet={jest.fn()}
      applyRangeFacet={jest.fn()}
      changeSort={mockChangeSort}
      resetFacet={jest.fn()}
      searchQuery={options?.searchQuery}
    />,
  );
};

describe('PlpListLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastPlpCategoryTreeProps = undefined;
  });

  it('uses the live facet-driven category tree and counts when the selected category is present', () => {
    renderLayout({ selectedCategoryId: 'electronics', facets: liveTreeFacets, roots: [liveParent] });

    const summary = screen.getByTestId('plp-category-summary');

    expect(summary).toHaveTextContent('Electronics');
    expect(summary).toHaveTextContent('productCount:5'); // Count comes from categoryCountsById[child.id] -> no, wait this is the main list layout. In the new logic electronics has count 5 from the live facet tree
    expect(mockRequestCounts).not.toHaveBeenCalled();
    expect(lastPlpCategoryTreeProps?.plpCategoryContext.currentCategory?.id).toBe('electronics');
    expect(lastPlpCategoryTreeProps?.plpCategoryContext.currentChildren.map((category) => category.id)).toEqual([
      'phones',
      'tablets',
    ]);
    expect(lastPlpCategoryTreeProps?.categoryCountsById).toMatchObject({ electronics: 5, phones: 3, tablets: 2 });
  });

  it('falls back to the static navigation tree when the live facet tree does not include the selection', () => {
    renderLayout({ selectedCategoryId: 'child-1', facets: unrelatedTreeFacets });

    const summary = screen.getByTestId('plp-category-summary');

    expect(summary).toHaveTextContent('Current Category');
    expect(summary).toHaveTextContent('productCount:7');
    expect(summary).toHaveTextContent('Current category description');
    expect(mockRequestCounts).toHaveBeenCalledWith(['child-1']);
    expect(lastPlpCategoryTreeProps?.plpCategoryContext.currentCategory?.id).toBe('child-1');
    expect(lastPlpCategoryTreeProps?.categoryCountsById['child-1']).toBe(7);
  });

  it('falls back to the all products summary at the root level', () => {
    renderLayout();

    const summary = screen.getByTestId('plp-category-summary');

    expect(summary).toHaveTextContent('allProducts');
    expect(summary).toHaveTextContent('productCount:42');
    expect(summary).not.toHaveTextContent('Current category description');
  });

  it('shows Search Results when a search query is present', () => {
    renderLayout({ searchQuery: 'tubes' });

    const summary = screen.getByTestId('plp-category-summary');

    expect(summary).toHaveTextContent('Search Results');
    expect(summary).toHaveTextContent('productCount:42');
    expect(summary).not.toHaveTextContent('allProducts');
  });

  it('renders the sort control between the desktop category tree and facet panel', () => {
    renderLayout({ selectedCategoryId: 'child-1' });

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
