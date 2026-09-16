/**
 * @jest-environment jsdom
 */
import React from 'react';
import { NextIntlClientProvider } from 'next-intl';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { SearchSort } from './search-sort';

jest.mock('@/components/ui/select', () => jest.requireActual('../../../jest/mocks/ui-select'));

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

  it('renders sort options correctly', () => {
    renderComponent();
    expect(screen.getByTestId('search-sort-option-name-asc')).toHaveTextContent('Product name Ascending');
    expect(screen.getByTestId('search-sort-option-popularity-desc')).toHaveTextContent('Popularity (BI) Descending');
  });

  it('calls changeSort with correct value', () => {
    renderComponent();
    fireEvent.click(screen.getByTestId('search-sort-option-name-asc'));
    expect(mockChangeSort).toHaveBeenCalledWith('name:asc');
  });

  it('does not render a clear item', () => {
    renderComponent();
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
