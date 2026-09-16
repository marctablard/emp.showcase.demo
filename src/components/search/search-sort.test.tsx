/**
 * @jest-environment jsdom
 */
import React from 'react';
import { NextIntlClientProvider } from 'next-intl';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { SearchSort } from './search-sort';

window.HTMLElement.prototype.scrollIntoView = jest.fn();
window.HTMLElement.prototype.releasePointerCapture = jest.fn();
window.HTMLElement.prototype.hasPointerCapture = () => false;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

class ResizeObserverMock {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}
Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ResizeObserverMock });

const mockChangeSort = jest.fn();

const availableSorts = [
  { id: 'price', labelKey: 'price', directions: ['asc', 'desc'] as any, defaultDirection: 'asc' as any },
  { id: 'popularity', label: 'Popularity (BI)', directions: ['desc'] as any, defaultDirection: 'desc' as any },
  { id: 'name', label: 'Product name', directions: ['asc', 'desc'] as any, defaultDirection: 'asc' as any },
];

describe('SearchSort', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <NextIntlClientProvider
        locale="en"
        messages={{
          search: {
            sort: {
              placeholder: 'Sort by',
              price: 'Price',
              direction: { asc: 'Ascending', desc: 'Descending' },
            },
          },
        }}
      >
        <SearchSort availableSorts={availableSorts} changeSort={mockChangeSort} currentSort="price:asc" {...props} />
      </NextIntlClientProvider>,
    );
  };

  it('renders sort options correctly', async () => {
    renderComponent();
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    expect(await screen.findByText('Product name Ascending')).toBeInTheDocument();
    expect(await screen.findByText('Popularity (BI) Descending')).toBeInTheDocument();
  }, 15_000);

  it('calls changeSort with correct value', async () => {
    renderComponent();
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    const option = await screen.findByText('Product name Ascending');
    fireEvent.click(option);
    expect(mockChangeSort).toHaveBeenCalledWith('name:asc');
  });

  it('does not render a clear item', async () => {
    renderComponent();

    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.queryByText('Clear sort')).not.toBeInTheDocument();
  });

  it('uses the search.sort namespace keys for placeholder', () => {
    renderComponent({ currentSort: undefined });

    expect(screen.getByText('Sort by')).toBeInTheDocument();
  });

  it('resets the select display when the current sort is no longer valid', () => {
    const { rerender } = renderComponent();

    expect(screen.getByRole('combobox')).toHaveTextContent('Price Ascending');

    rerender(
      <NextIntlClientProvider
        locale="en"
        messages={{
          search: {
            sort: {
              placeholder: 'Sort by',
              price: 'Price',
              direction: { asc: 'Ascending', desc: 'Descending' },
            },
          },
        }}
      >
        <SearchSort availableSorts={availableSorts} changeSort={mockChangeSort} currentSort="price" />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole('combobox')).toHaveTextContent('Sort by');
    expect(screen.getByRole('combobox')).not.toHaveTextContent('Price Ascending');
  });
});
