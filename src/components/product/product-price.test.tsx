/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { formatCurrency } from '@/lib/utils';
import type { ProductPrice } from '@/platform/services/model/price';
import { ProductPriceComponent } from './product-price';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    if (key === 'includingTax' && values?.taxRate != null) {
      return `incl. ${values.taxRate}% VAT`;
    }
    if (key === 'excludingTax' && values?.taxRate != null) {
      return `excl. ${values.taxRate}% VAT`;
    }
    return key;
  },
}));

jest.mock('@/hooks/common/useGlobalSyncReady', () => ({
  useGlobalSyncReady: () => ({ ready: true, reason: null }),
}));

function buildPrice(overrides: Partial<ProductPrice> = {}): ProductPrice {
  return {
    id: 'price-1',
    productId: 'product-1',
    currency: 'EUR',
    amount: 372.59,
    originalAmount: 459.99,
    discountValue: 87.4,
    discountPercentage: 0,
    totalValue: 372.59,
    quantity: { quantity: 1 },
    includesTax: false,
    tax: {
      taxCode: 'STANDARD',
      taxRate: 19,
      netValue: 372.59,
      grossValue: 443.38,
      amount: 70.79,
      currency: 'EUR',
    },
    tierValues: [],
    ...overrides,
  };
}

function normalizedText(node: Element | null): string {
  return (node?.textContent ?? '').replaceAll(/\s+/g, ' ').trim();
}

function expectLargeFigure(amount: number): void {
  const integerPart = String(Math.floor(amount));
  const priceNode = document.getElementById('price');
  expect(priceNode).not.toBeNull();
  expect(normalizedText(priceNode)).toContain(integerPart);
}

describe('ProductPriceComponent gross-first hierarchy', () => {
  it('with includesTax:false shows gross as large figure and includingTax + net as small print', () => {
    const price = buildPrice({ includesTax: false });
    render(<ProductPriceComponent price={price} />);

    const root = screen.getByTestId('product-price');
    const text = normalizedText(root);

    expectLargeFigure(price.tax!.grossValue);
    expect(text).toContain(`incl. ${price.tax!.taxRate}% VAT`);
    expect(text).toContain(formatCurrency(price.tax!.netValue, price.currency));
    expect(text).toContain('net');
    expect(text).not.toContain('excl.');
    expect(text).not.toContain('excludingTax');
  });

  it('with includesTax:true shows tax-inclusive amount as large figure and includingTax + net as small print', () => {
    const price = buildPrice({
      includesTax: true,
      amount: 443.38,
      tax: {
        taxCode: 'STANDARD',
        taxRate: 19,
        netValue: 372.59,
        grossValue: 443.38,
        amount: 70.79,
        currency: 'EUR',
      },
    });
    render(<ProductPriceComponent price={price} />);

    const root = screen.getByTestId('product-price');
    const text = normalizedText(root);

    expectLargeFigure(price.amount);
    expect(text).toContain(`incl. ${price.tax!.taxRate}% VAT`);
    expect(text).toContain(formatCurrency(price.tax!.netValue, price.currency));
    expect(text).toContain('net');
    expect(text).not.toContain('excl.');
  });

  it('isAddToCartBar uses the same includingTax + net small print for includesTax:false', () => {
    const price = buildPrice({ includesTax: false });
    render(<ProductPriceComponent price={price} isAddToCartBar />);

    const root = screen.getByTestId('product-price');
    const text = normalizedText(root);

    expectLargeFigure(price.tax!.grossValue);
    expect(text).toContain(`incl. ${price.tax!.taxRate}% VAT`);
    expect(text).toContain(formatCurrency(price.tax!.netValue, price.currency));
    expect(text).toContain('net');
    expect(text).not.toContain('excl.');
  });
});

describe('ProductPriceComponent discountPercentage rounding', () => {
  it('rounds discountPercentage 3 to badge -3%', () => {
    render(<ProductPriceComponent price={buildPrice({ discountPercentage: 3 })} />);
    expect(screen.getByText('-3%')).toBeInTheDocument();
  });

  it('rounds discountPercentage 25 to badge -25%', () => {
    render(<ProductPriceComponent price={buildPrice({ discountPercentage: 25 })} />);
    expect(screen.getByText('-25%')).toBeInTheDocument();
  });

  it('rounds fractional discountPercentage 2.6 to badge -3%', () => {
    render(<ProductPriceComponent price={buildPrice({ discountPercentage: 2.6 })} />);
    expect(screen.getByText('-3%')).toBeInTheDocument();
  });

  it('rounds fractional discountPercentage 24.4 to badge -24%', () => {
    render(<ProductPriceComponent price={buildPrice({ discountPercentage: 24.4 })} />);
    expect(screen.getByText('-24%')).toBeInTheDocument();
  });
});

describe('ProductPriceComponent discount wording and list price', () => {
  it('exposes price.discount as Discount (en) and Rabatt (de)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const en = require('@/i18n/translations/en/product/index.json') as {
      price: { discount: string };
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const de = require('@/i18n/translations/de/product/index.json') as {
      price: { discount: string };
    };
    expect(en.price.discount).toBe('Discount');
    expect(de.price.discount).toBe('Rabatt');
  });

  it('renders discount row order: yourPrice, including, badge, discount, listPrice', () => {
    const price = buildPrice({ discountPercentage: 25, originalAmount: 459.99, amount: 372.59 });
    render(<ProductPriceComponent price={price} />);

    const labelRow = screen.getByTestId('product-price-labels');
    expect(normalizedText(labelRow)).toMatch(/yourPrice.*including.*-25%.*discount.*listPrice/i);
    expect(screen.getByText('discount')).toBeInTheDocument();
  });

  it('aligns list price under a ~200px left column with body/l strikethrough and Ubuntu h4 gross', () => {
    const price = buildPrice({ discountPercentage: 25, originalAmount: 459.99, amount: 372.59 });
    render(<ProductPriceComponent price={price} />);

    const labels = screen.getByTestId('product-price-labels');
    const amounts = screen.getByTestId('product-price-amounts');
    expect(labels.firstElementChild).toHaveClass('w-[200px]');
    expect(amounts.firstElementChild).toHaveClass('w-[200px]', 'font-headlines');
    expect(document.getElementById('price')).toHaveClass('font-headlines', 'text-4xl');
    expect(amounts.querySelector('.line-through')).toHaveClass('text-lg');
  });

  it('uses 4px radius token and bold weight on the discount badge', () => {
    render(<ProductPriceComponent price={buildPrice({ discountPercentage: 25, originalAmount: 459.99 })} />);
    const badge = screen.getByText('-25%');
    expect(badge).toHaveClass('rounded-sm', 'font-bold');
    expect(badge).not.toHaveClass('rounded-pill');
    expect(badge).not.toHaveClass('font-medium');
  });

  it('does not render discount word when discountPercentage is 0', () => {
    render(<ProductPriceComponent price={buildPrice({ discountPercentage: 0 })} />);
    expect(screen.queryByText('discount')).not.toBeInTheDocument();
  });

  it('renders struck-through list price inline when originalAmount > amount', () => {
    const price = buildPrice({ originalAmount: 459.99, amount: 372.59 });
    render(<ProductPriceComponent price={price} />);

    const root = screen.getByTestId('product-price');
    const listPriceText = formatCurrency(price.originalAmount!, price.currency);
    expect(normalizedText(root)).toContain(listPriceText);
    const struck = root.querySelector('.line-through');
    expect(struck).not.toBeNull();
    expect(normalizedText(struck)).toContain(listPriceText);
  });

  it('does not render list price when originalAmount is not greater than amount', () => {
    render(<ProductPriceComponent price={buildPrice({ originalAmount: 100, amount: 100, discountPercentage: 0 })} />);
    expect(screen.queryByText('listPrice')).not.toBeInTheDocument();
    expect(document.querySelector('.line-through')).toBeNull();
  });

  it('uses h6 token (text-2xl) for the price fraction', () => {
    render(<ProductPriceComponent price={buildPrice({ includesTax: false })} />);
    const fraction = screen.getByTestId('product-price').querySelector('.text-2xl.align-top');
    expect(fraction).not.toBeNull();
  });

  it('keeps includingTax small print beside price when isAddToCartBar', () => {
    const price = buildPrice({ includesTax: false, discountPercentage: 3, originalAmount: 459.99 });
    render(<ProductPriceComponent price={price} isAddToCartBar />);

    const root = screen.getByTestId('product-price');
    const text = normalizedText(root);
    expect(text).toContain('discount');
    expect(text).toContain(`incl. ${price.tax!.taxRate}% VAT`);
    expect(root.querySelector('.line-through')).not.toBeNull();
  });
});
