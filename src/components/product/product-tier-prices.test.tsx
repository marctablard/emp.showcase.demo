/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { formatCurrency } from '@/lib/utils';
import type { ProductPrice } from '@/platform/services/model/price';
import { ProductTierPrices } from './product-tier-prices';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    if (key === 'includingTax' && values?.taxRate != null) {
      return `incl. ${values.taxRate}% VAT`;
    }
    if (key === 'tiers.buyRange') {
      return `Buy ${values?.min}-${values?.max}`;
    }
    if (key === 'tiers.buyFrom') {
      return `Buy ${values?.min}+`;
    }
    if (key === 'tiers.saveWhenOrdering') {
      return `Save ${values?.percent}% when you order ${values?.min}+`;
    }
    if (key === 'tiers.quantity') {
      return 'Quantity';
    }
    if (key === 'tiers.pricePerUnit') {
      return 'Price per unit';
    }
    if (key === 'gross') {
      return 'gross';
    }
    return key;
  },
}));

function buildPrice(overrides: Partial<ProductPrice> = {}): ProductPrice {
  return {
    id: 'price-1',
    productId: 'product-1',
    currency: 'EUR',
    originalAmount: 1000,
    amount: 900,
    discountValue: 100,
    discountPercentage: 10,
    totalValue: 900,
    quantity: { quantity: 1, unitCode: 'pc' },
    includesTax: false,
    tax: {
      taxCode: 'STANDARD',
      taxRate: 19,
      netValue: 900,
      grossValue: 1071,
      amount: 171,
      currency: 'EUR',
    },
    tierValues: [
      { id: 't1', minQuantity: 0, unit: 'pc', price: 1000 },
      { id: 't2', minQuantity: 10, unit: 'pc', price: 950 },
      { id: 't3', minQuantity: 30, unit: 'pc', price: 900 },
    ],
    ...overrides,
  };
}

function normalizeWhitespace(value: string): string {
  return value.replaceAll(/\s+/g, ' ').trim();
}

describe('ProductTierPrices', () => {
  it('returns null when tierValues is empty', () => {
    const { container } = render(<ProductTierPrices price={buildPrice({ tierValues: [] })} quantity={1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a two-column header and quantity ranges from tierValues', () => {
    render(<ProductTierPrices price={buildPrice()} quantity={1} />);

    expect(screen.getByText('Quantity')).toBeInTheDocument();
    expect(screen.getByText('Price per unit')).toBeInTheDocument();
    expect(screen.getByText('Buy 1-9')).toBeInTheDocument();
    expect(screen.getByText('Buy 10-29')).toBeInTheDocument();
    expect(screen.getByText('Buy 30+')).toBeInTheDocument();
  });

  it('shows net as the primary unit price and gross in the VAT small print (net-first)', () => {
    render(<ProductTierPrices price={buildPrice()} quantity={1} />);

    const firstRow = screen.getAllByTestId('product-tier-prices-row')[0];
    const text = normalizeWhitespace(firstRow.textContent ?? '');
    expect(text).toContain(normalizeWhitespace(formatCurrency(1000, 'EUR')));
    expect(text).toContain('incl. 19% VAT');
    expect(text).toContain(normalizeWhitespace(formatCurrency(1190, 'EUR')));
    expect(text).toContain('gross');
  });

  it('marks the tier matching the current quantity as active', () => {
    render(<ProductTierPrices price={buildPrice()} quantity={12} />);

    const rows = screen.getAllByTestId('product-tier-prices-row');
    expect(rows[0]).toHaveAttribute('data-tier-active', 'false');
    expect(rows[1]).toHaveAttribute('data-tier-active', 'true');
    expect(rows[2]).toHaveAttribute('data-tier-active', 'false');
    expect(rows[1]).toHaveClass('bg-surface-information');
  });

  it('shows a save line for discounted tiers', () => {
    render(<ProductTierPrices price={buildPrice()} quantity={1} />);
    expect(screen.getByText('Save 5% when you order 10+')).toBeInTheDocument();
    expect(screen.getByText('Save 10% when you order 30+')).toBeInTheDocument();
  });
});
