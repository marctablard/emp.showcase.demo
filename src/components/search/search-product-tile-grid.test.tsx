/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { Product } from '@/platform/services/model/product';
import { SearchProductTileGrid } from './search-product-tile-grid';

jest.mock('@/hooks/common/useGlobalCursor', () => ({
  useGlobalCursor: jest.fn(),
}));

jest.mock('@/components/product/product-tile', () => ({
  ProductTile: ({ product }: { product: Product }) => <div data-testid={`product-tile-${product.id}`} />,
}));

jest.mock('@/components/product/product-tile-skeleton', () => ({
  ProductTileSkeleton: () => <div data-testid="product-tile-skeleton" />,
}));

jest.mock('@/components/search/search-no-results', () => ({
  SearchNoResults: () => <div data-testid="search-no-results" />,
}));

const product: Product = {
  id: 'p-1',
  name: { en: 'Test product' },
  description: { en: 'Description' },
  purchasable: true,
};

describe('SearchProductTileGrid', () => {
  it('uses sm as the default 1→2 column step', () => {
    render(<SearchProductTileGrid products={[product]} locale="en" pageSize={12} total={1} loading={false} />);

    const grid = screen.getByTestId('product-tile-p-1').closest('.grid');

    expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3');
    expect(grid).not.toHaveClass('md:grid-cols-2');
    expect(grid).toHaveClass('md:gap-6');
  });
});
