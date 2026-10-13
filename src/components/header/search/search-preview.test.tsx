/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { SearchPreview } from '@/components/header/search/search-preview';
import { useHistory } from '@/hooks/history/useHistory';
import { useSearchPreview } from '@/hooks/search/useSearchPreview';
import type { Product } from '@/platform/services/model/product';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/components/product/product-tile-fly-out', () => ({
  ProductTileFlyOut: ({ product }: { product: Product }) => <div data-testid={`tile-${product.id}`} />,
}));

jest.mock('@/hooks/history/useHistory', () => ({
  __esModule: true,
  default: jest.fn(),
  useHistory: jest.fn(),
}));

jest.mock('@/hooks/search/useSearchPreview', () => ({
  useSearchPreview: jest.fn(),
}));

const mockUseHistory = jest.requireMock('@/hooks/history/useHistory').default as jest.Mock;
const mockUseSearchPreview = useSearchPreview as jest.MockedFunction<typeof useSearchPreview>;
const clearSearchHistory = jest.fn();

function setHistory(searchHistory: string[]) {
  const value = {
    lastSeenProducts: [],
    searchHistory,
    addLastSeenProduct: jest.fn(),
    addSearchQuery: jest.fn(),
    clearLastSeenProducts: jest.fn(),
    clearSearchHistory,
  };
  mockUseHistory.mockReturnValue(value);
  (useHistory as jest.Mock).mockReturnValue(value);
}

const product = (id: string) => ({ id }) as unknown as Product;

describe('SearchPreview', () => {
  const onQuerySelect = jest.fn();
  const onSearchSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderPreview = () =>
    render(<SearchPreview onQuerySelect={onQuerySelect} onSearchSubmit={onSearchSubmit} onProductClick={jest.fn()} />);

  it('shows recent searches newest first, suggested searches and products for past searches', () => {
    setHistory(['older', 'newest']);
    mockUseSearchPreview.mockReturnValue({
      loading: false,
      preview: { source: 'history', products: [product('p1'), product('p2')], queryCompletions: ['fluids'] },
    });

    renderPreview();

    expect(screen.getByTestId('headerSearch-recentQuery-0')).toHaveTextContent('newest');
    expect(screen.getByTestId('headerSearch-recentQuery-1')).toHaveTextContent('older');
    expect(screen.getByTestId('headerSearch-suggestedQuery-0')).toHaveTextContent('fluids');
    expect(screen.getByText('recommendedForYou')).toBeInTheDocument();
    expect(screen.getByTestId('tile-p1')).toBeInTheDocument();
    expect(screen.getByTestId('tile-p2')).toBeInTheDocument();
  });

  it('routes keyword chips to live suggestions and natural-language examples to the full search', () => {
    setHistory(['coolant']);
    mockUseSearchPreview.mockReturnValue({
      loading: false,
      preview: { source: 'history', products: [], queryCompletions: ['coolants'] },
    });

    renderPreview();
    fireEvent.click(screen.getByTestId('headerSearch-recentQuery-0'));
    fireEvent.click(screen.getByTestId('headerSearch-suggestedQuery-0'));
    fireEvent.click(screen.getByTestId('headerSearch-exampleQuery-0'));
    fireEvent.click(screen.getByTestId('headerSearch-clearHistory'));

    expect(onQuerySelect).toHaveBeenNthCalledWith(1, 'coolant');
    expect(onQuerySelect).toHaveBeenNthCalledWith(2, 'coolants');
    expect(onSearchSubmit).toHaveBeenCalledWith('examples.example1');
    expect(clearSearchHistory).toHaveBeenCalled();
  });

  it('shows popular products and no history block for a first-time shopper', () => {
    setHistory([]);
    mockUseSearchPreview.mockReturnValue({
      loading: false,
      preview: { source: 'popular', products: [product('p1')], queryCompletions: [] },
    });

    renderPreview();

    expect(screen.queryByTestId('headerSearch-recentQuery-0')).not.toBeInTheDocument();
    expect(screen.queryByTestId('headerSearch-clearHistory')).not.toBeInTheDocument();
    expect(screen.getByText('popularProducts')).toBeInTheDocument();
    expect(screen.getByTestId('headerSearch-exampleQuery-2')).toBeInTheDocument();
  });
});
