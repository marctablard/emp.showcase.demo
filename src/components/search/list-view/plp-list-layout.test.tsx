/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { Category } from '@/platform/services/model/category';
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

jest.mock('@/components/search/search-product-tile-grid', () => ({
  SearchProductTileGrid: () => <div data-testid="search-product-tile-grid" />,
}));

describe('PlpListLayout', () => {
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
      />,
    );

    const summary = screen.getByTestId('plp-category-summary');

    expect(summary).toHaveTextContent('allProducts');
    expect(summary).toHaveTextContent('productCount:42');
    expect(summary).not.toHaveTextContent('Current category description');
  });
});
