/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QuickOrderSearch } from './quick-order-search';

const getSuggestions = jest.fn();
const fetchProductPrice = jest.fn();
const fetchProductAvailability = jest.fn();
const toast = jest.fn();
const error = jest.fn();

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/hooks/search/useSearch', () => ({
  useSearch: () => ({
    suggestions: {
      products: [
        {
          id: '<mark>product-1</mark>',
          sku: '<mark>sku-1</mark>',
          name: '<mark>Solar</mark> Panel',
          images: [],
          brand: { name: '<mark>Brand</mark>' },
          price: undefined,
        },
      ],
    },
    loading: false,
    getSuggestions,
  }),
}));

jest.mock('@/hooks/ui/useToast', () => ({
  useToast: () => ({ toast }),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    error,
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('@/lib/client/prices', () => ({
  fetchProductPrice: (...args: unknown[]) => fetchProductPrice(...args),
}));

jest.mock('@/lib/client/availability', () => ({
  fetchProductAvailability: (...args: unknown[]) => fetchProductAvailability(...args),
}));

jest.mock('@/providers/StoreProvider', () => ({
  useSessionStore: () => ({ session: { currency: 'EUR' } }),
}));

jest.mock('./quick-order-search-dropdown', () => ({
  QuickOrderSearchDropdown: () => <div data-testid="mock-dropdown" />,
}));

jest.mock('./quick-order-text-paste', () => ({
  QuickOrderTextPaste: () => <div data-testid="mock-text-paste" />,
}));

describe('QuickOrderSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    getSuggestions.mockReset();
    fetchProductPrice.mockReset();
    fetchProductAvailability.mockReset();
    toast.mockReset();
    error.mockReset();
    fetchProductPrice.mockResolvedValue({ amount: 100, currency: 'EUR' });
    fetchProductAvailability.mockResolvedValue({ isAvailable: true, availableQuantity: 5 });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('sanitizes the highlighted product when selecting with Enter', async () => {
    const onAddProducts = jest.fn();

    render(<QuickOrderSearch onAddProducts={onAddProducts} />);

    fireEvent.change(screen.getByTestId('quick-order-search-input'), { target: { value: 'so' } });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    fireEvent.keyDown(screen.getByTestId('quick-order-search-input'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByTestId('quick-order-search-input'), { key: 'Enter' });

    await waitFor(() => {
      expect(fetchProductPrice).toHaveBeenCalledWith('product-1', undefined, undefined, 'EUR');
      expect(fetchProductAvailability).toHaveBeenCalledWith('product-1');
      expect(onAddProducts).toHaveBeenCalledWith([
        expect.objectContaining({
          quantity: 1,
          product: expect.objectContaining({
            id: 'product-1',
            sku: 'sku-1',
          }),
        }),
      ]);
    });
  });
});
