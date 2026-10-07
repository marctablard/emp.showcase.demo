/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { type ProductsModeContextValue, ProductsModeProvider } from '@/components/navigation/products-mode-context';
import type { PlpCategoryContext } from '@/lib/category/plp-category-context';
import type { Category } from '@/platform/services/model/category';
import { BATTERY_INCLUDED_BREADCRUMB_FILTER } from '@/platform/services/model/category/batteryincluded-category';
import type { BatteryIncludedFacet } from '@/platform/services/model/common';
import { PlpListLayout } from './plp-list-layout';

const mockChangeSort = jest.fn();
const mockRequestCounts = jest.fn();

let lastPlpCategoryTreeProps:
  | {
      plpCategoryContext: PlpCategoryContext;
      categoryCountsById: Record<string, number>;
    }
  | undefined;
let lastSearchProductTileGridProps:
  | {
      gridClassName?: string;
      headerContent?: React.ReactNode;
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

jest.mock('@/components/search/search-sort', () => ({
  SearchSort: () => <div data-testid="search-sort" />,
}));

jest.mock('@/components/search/search-product-tile-grid', () => ({
  SearchProductTileGrid: (props: { gridClassName?: string; headerContent?: React.ReactNode }) => {
    lastSearchProductTileGridProps = props;

    return (
      <div data-testid="search-product-tile-grid" className={props.gridClassName}>
        {props.headerContent}
      </div>
    );
  },
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
  productsMode?: ProductsModeContextValue;
}) => {
  const layout = (
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
      changeSort={mockChangeSort}
      batteryIncludedFacets={options?.facets ?? batteryIncludedFacets}
      activeFilters={{}}
      applyFacet={jest.fn()}
      applyRangeFacet={jest.fn()}
      resetFacet={jest.fn()}
      searchQuery={options?.searchQuery}
    />
  );

  render(
    options?.productsMode ? <ProductsModeProvider value={options.productsMode}>{layout}</ProductsModeProvider> : layout,
  );
};

describe('PlpListLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastPlpCategoryTreeProps = undefined;
    lastSearchProductTileGridProps = undefined;
  });

  it('uses the live facet-driven category tree and counts when the selected category is present', () => {
    renderLayout({ selectedCategoryId: 'electronics', facets: liveTreeFacets, roots: [liveParent] });

    const summary = screen.getByTestId('plp-category-summary');

    expect(summary).toHaveTextContent('Electronics');
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
    expect(summary).toHaveTextContent('Current category description');
    expect(mockRequestCounts).toHaveBeenCalledWith(['child-1']);
    expect(lastPlpCategoryTreeProps?.plpCategoryContext.currentCategory?.id).toBe('child-1');
    expect(lastPlpCategoryTreeProps?.categoryCountsById['child-1']).toBe(7);
  });

  describe('category counts in assigned mode (COP-4822)', () => {
    const assignedMode: ProductsModeContextValue = { mode: 'assigned', isSegmented: true, canToggleAllProducts: false };

    it('never requests the unscoped per-category counts and renders no count before the facets arrive', () => {
      renderLayout({ selectedCategoryId: 'child-1', facets: unrelatedTreeFacets, productsMode: assignedMode });

      expect(mockRequestCounts).not.toHaveBeenCalled();
      expect(lastPlpCategoryTreeProps?.plpCategoryContext.currentCategory?.id).toBe('child-1');
      // `useCategoryProductCounts` already knows `child-1: 7` (unscoped) — it must not leak into the tree.
      expect(lastPlpCategoryTreeProps?.categoryCountsById).toEqual({});
    });

    it('renders only the segment-scoped facet counts once the live tree facet is present', () => {
      renderLayout({
        selectedCategoryId: 'electronics',
        facets: liveTreeFacets,
        roots: [liveParent],
        productsMode: assignedMode,
      });

      expect(mockRequestCounts).not.toHaveBeenCalled();
      expect(lastPlpCategoryTreeProps?.categoryCountsById).toMatchObject({ electronics: 5, phones: 3, tablets: 2 });
    });

    it('keeps requesting the unscoped counts in ALL mode', () => {
      renderLayout({
        selectedCategoryId: 'child-1',
        facets: unrelatedTreeFacets,
        productsMode: { mode: 'all', isSegmented: true, canToggleAllProducts: true },
      });

      expect(mockRequestCounts).toHaveBeenCalledWith(['child-1']);
      expect(lastPlpCategoryTreeProps?.categoryCountsById['child-1']).toBe(7);
    });
  });

  it('falls back to the all products summary at the root level', () => {
    renderLayout();

    const summary = screen.getByTestId('plp-category-summary');

    expect(summary).toHaveTextContent('allProducts');
    expect(summary).not.toHaveTextContent('Current category description');
  });

  it('titles the root summary "Assigned Products" in assigned mode without a category or query', () => {
    renderLayout({ productsMode: { mode: 'assigned', isSegmented: true, canToggleAllProducts: false } });

    const summary = screen.getByTestId('plp-category-summary');

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('assignedProducts');
    expect(summary).toHaveAttribute('aria-label', 'assignedProducts');
    expect(summary).not.toHaveTextContent('allProducts');
    // Sidebar landmark name must match the visible root copy in assigned mode.
    expect(screen.getByRole('complementary', { name: 'assignedProducts' })).toContainElement(
      screen.getByTestId('plp-category-tree'),
    );
  });

  it('keeps the "All Products" root summary in ALL mode', () => {
    renderLayout({ productsMode: { mode: 'all', isSegmented: true, canToggleAllProducts: true } });

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('allProducts');
    expect(screen.getByTestId('plp-category-summary')).not.toHaveTextContent('assignedProducts');
  });

  it('does not render a products mode control above the grid (COP-4822 CR-1: it lives in the category tree header)', () => {
    renderLayout({ productsMode: { mode: 'assigned', isSegmented: true, canToggleAllProducts: true } });

    expect(screen.queryByTestId('plp-showAllProductsCheckbox')).not.toBeInTheDocument();
    expect(screen.queryByTestId('plp-productsModeSwitch')).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'assignedProducts' })).toContainElement(
      screen.getByTestId('plp-category-tree'),
    );
  });

  it('shows Search Results when a search query is present', () => {
    renderLayout({ selectedCategoryId: 'child-1', facets: unrelatedTreeFacets, searchQuery: 'tubes' });

    const summary = screen.getByTestId('plp-category-summary');

    expect(summary).toHaveTextContent('searchResults');
    expect(summary).not.toHaveTextContent('allProducts');
    expect(summary).not.toHaveTextContent('Current category description');
  });

  it('renders the desktop sort control above the product grid instead of in the sidebar', () => {
    renderLayout({ selectedCategoryId: 'child-1' });

    const aside = screen.getByLabelText('allProducts');
    const tree = screen.getByTestId('plp-category-tree');
    const facetPanel = screen.getByTestId('plp-facet-panel');
    const summary = screen.getByTestId('plp-category-summary');
    const sort = screen.getByTestId('search-sort');

    expect(aside).toContainElement(tree);
    expect(aside).toContainElement(facetPanel);
    expect(aside).not.toContainElement(sort);
    expect(summary).not.toContainElement(sort);
    expect(aside).toHaveClass('hidden', 'min-[1024px]:block');
    expect(screen.getByTestId('search-product-tile-grid')).toHaveClass(
      'grid-cols-1',
      'sm:grid-cols-2',
      'lg:grid-cols-3',
      'items-start',
    );
    expect(lastSearchProductTileGridProps?.gridClassName).toContain('sm:grid-cols-2');
    expect(lastSearchProductTileGridProps?.gridClassName).not.toContain('min-[770px]:grid-cols-2');
    expect(lastSearchProductTileGridProps?.gridClassName).toContain('lg:grid-cols-3');
    expect(lastSearchProductTileGridProps?.gridClassName).not.toContain('min-[1440px]:grid-cols-3');
    expect(lastSearchProductTileGridProps?.gridClassName).toContain('items-start');
    expect(lastSearchProductTileGridProps?.gridClassName).not.toContain('auto-rows-fr');
    expect(sort.parentElement).toHaveClass(
      'hidden',
      'min-[1024px]:flex',
      'min-[1024px]:w-[261px]',
      'min-[1024px]:shrink-0',
    );
    expect(screen.getByTestId('search-product-tile-grid')).toContainElement(sort);
    expect(lastSearchProductTileGridProps?.gridClassName).toContain('sm:grid-cols-2');
    expect(screen.getByTestId('plp-category-tree').parentElement).toHaveClass('hidden', 'min-[1024px]:block');
    expect(screen.getByTestId('plp-category-tree').parentElement?.parentElement).toHaveClass(
      'grid',
      'grid-cols-1',
      'min-[1024px]:grid-cols-[minmax(0,274px)_minmax(0,1fr)]',
      'min-[1440px]:grid-cols-[minmax(0,444px)_minmax(0,1fr)]',
    );
  });
});
