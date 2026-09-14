/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { formatCurrency } from '@/lib/utils';
import type { ProductPrice } from '@/platform/services/model/price';
import { PRICE_MODEL_TYPE } from '@/platform/services/model/price/price-model-type';
import { ProductTierPrices } from './product-tier-prices';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    if (key === 'plusTax' && values?.taxRate != null) {
      return `plus ${values.taxRate}% VAT`;
    }
    if (key === 'tiers.buyRange') {
      return `Buy ${values?.min}-${values?.max}`;
    }
    if (key === 'tiers.buyFrom') {
      return `Buy ${values?.min}+`;
    }
    if (key === 'tiers.forUnitsRange') {
      return `for units ${values?.min}-${values?.max}`;
    }
    if (key === 'tiers.forUnitsFrom') {
      return `for units ${values?.min}+`;
    }
    if (key === 'tiers.forEachUnit') {
      return 'for each unit';
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
    priceModelType: PRICE_MODEL_TYPE.VOLUME,
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

  it('returns null when there is only one tier', () => {
    const { container } = render(
      <ProductTierPrices
        price={buildPrice({
          tierValues: [{ id: 't1', minQuantity: 0, unit: 'pc', price: 1000 }],
        })}
        quantity={1}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when tier amounts do not match the price currency (unconverted tiers)', () => {
    // Session currency USD: the matched-price API converts base/original amounts
    // (1000 EUR → 886.90 USD) but leaves tierValues in the EUR price-list amounts.
    // Rendering would show the EUR figures with a $ symbol — hide the table instead.
    const { container } = render(
      <ProductTierPrices
        price={buildPrice({ currency: 'USD', originalAmount: 886.9, amount: 886.9, totalValue: 886.9 })}
        quantity={1}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('still renders when converted tier amounts match the base price within rounding tolerance', () => {
    const { container } = render(
      <ProductTierPrices
        price={buildPrice({
          currency: 'USD',
          originalAmount: 886.9,
          tierValues: [
            { id: 't1', minQuantity: 0, unit: 'pc', price: 886.902 },
            { id: 't2', minQuantity: 10, unit: 'pc', price: 842.55 },
          ],
        })}
        quantity={1}
      />,
    );
    expect(container).not.toBeEmptyDOMElement();
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
    expect(text).toContain('plus 19% VAT');
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

  it('VOLUME: appends for-each-unit copy and does not show save messaging', () => {
    render(<ProductTierPrices price={buildPrice({ priceModelType: PRICE_MODEL_TYPE.VOLUME })} quantity={1} />);

    const suffixes = screen.getAllByTestId('product-tier-prices-unit-suffix');
    expect(suffixes).toHaveLength(3);
    suffixes.forEach((suffix) => {
      expect(suffix).toHaveTextContent('for each unit');
    });
    expect(screen.queryByText(/Save \d+% when you order/)).not.toBeInTheDocument();

    const firstRow = screen.getAllByTestId('product-tier-prices-row')[0];
    expect(normalizeWhitespace(firstRow.textContent ?? '')).toContain('for each unit');
  });

  it('TIERED: appends unit-range copy (closed and open-ended last tier)', () => {
    render(<ProductTierPrices price={buildPrice({ priceModelType: PRICE_MODEL_TYPE.TIERED })} quantity={1} />);

    const suffixes = screen.getAllByTestId('product-tier-prices-unit-suffix');
    expect(suffixes[0]).toHaveTextContent('for units 1-9');
    expect(suffixes[1]).toHaveTextContent('for units 10-29');
    expect(suffixes[2]).toHaveTextContent('for units 30+');
    expect(screen.queryByText(/Save \d+% when you order/)).not.toBeInTheDocument();
  });
});
