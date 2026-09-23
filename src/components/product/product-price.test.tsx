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
    if (key === 'plusTax' && values?.taxRate != null) {
      return `plus ${values.taxRate}% VAT`;
    }
    if (key === 'includingTax' && values?.taxRate != null) {
      return `incl. ${values.taxRate}% VAT`;
    }
    if (key === 'excludingTax' && values?.taxRate != null) {
      return `excl. ${values.taxRate}% VAT`;
    }
    if (key === 'yourPriceItemsRange' && values?.min != null && values?.max != null) {
      return `Your price (items ${values.min} - ${values.max})`;
    }
    if (key === 'yourPriceItemsFrom' && values?.min != null) {
      return `Your price (items ${values.min}+)`;
    }
    if (key === 'amountForItemsRange' && values?.amount != null && values.min != null && values.max != null) {
      return `${values.amount} for items ${values.min} - ${values.max}`;
    }
    if (key === 'amountForItemsFrom' && values?.amount != null && values.min != null) {
      return `${values.amount} for items ${values.min}+`;
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
  return normalizeWhitespace(node?.textContent ?? '');
}

/** Collapse NBSP / narrow spaces from `formatCurrency` so CI locales match DOM textContent. */
function normalizeWhitespace(value: string): string {
  return value.replaceAll(/\s+/g, ' ').trim();
}

function expectLargeFigure(amount: number): void {
  const integerPart = String(Math.floor(amount));
  const priceNode = document.getElementById('price');
  expect(priceNode).not.toBeNull();
  expect(normalizedText(priceNode)).toContain(integerPart);
}

describe('ProductPriceComponent net-first hierarchy', () => {
  it('with includesTax:false shows net as large figure and plusTax + gross as small print', () => {
    const price = buildPrice({ includesTax: false });
    render(<ProductPriceComponent price={price} />);

    const root = screen.getByTestId('product-price');
    const text = normalizedText(root);

    expectLargeFigure(price.tax!.netValue);
    expect(text).toContain(`plus ${price.tax!.taxRate}% VAT`);
    expect(text).toContain(normalizeWhitespace(formatCurrency(price.tax!.grossValue, price.currency)));
    expect(text).toContain('gross');
    expect(text).not.toMatch(/\bnet\b/);
    expect(text).not.toContain('incl.');
    expect(text).not.toContain('excl.');
    expect(text).not.toContain('includingTax');
    expect(text).not.toContain('excludingTax');
  });

  it('with includesTax:true still shows net as large figure and gross in small print', () => {
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

    expectLargeFigure(price.tax!.netValue);
    expect(text).toContain(`plus ${price.tax!.taxRate}% VAT`);
    expect(text).toContain(normalizeWhitespace(formatCurrency(price.tax!.grossValue, price.currency)));
    expect(text).toContain('gross');
    expect(text).not.toMatch(/\bnet\b/);
  });

  it('isAddToCartBar uses the same net-large / gross-small hierarchy for includesTax:false', () => {
    const price = buildPrice({ includesTax: false });
    render(<ProductPriceComponent price={price} isAddToCartBar />);

    const root = screen.getByTestId('product-price');
    const text = normalizedText(root);

    expectLargeFigure(price.tax!.netValue);
    expect(text).toContain(`plus ${price.tax!.taxRate}% VAT`);
    expect(text).toContain(normalizeWhitespace(formatCurrency(price.tax!.grossValue, price.currency)));
    expect(text).toContain('gross');
    expect(text).not.toMatch(/\bnet\b/);
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
    const listPriceText = normalizeWhitespace(formatCurrency(price.originalAmount!, price.currency));
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

  it('keeps plusTax small print beside net price in column 1 when isAddToCartBar', () => {
    const price = buildPrice({ includesTax: false, discountPercentage: 3, originalAmount: 459.99 });
    render(<ProductPriceComponent price={price} isAddToCartBar />);

    const root = screen.getByTestId('product-price');
    const currentColumn = screen.getByTestId('product-price-current-column');
    const listColumn = screen.getByTestId('product-price-list-column');
    const tax = screen.getByTestId('product-price-tax');

    // Figma `2504:75401` two-column gap-4; no `@container` (collapses to 0 width in the sticky bar).
    expect(root).toHaveClass('w-max', 'shrink-0', 'gap-4');
    expect(root).not.toHaveClass('max-w-full', '@container/atc-price', '@[260px]/atc-price:gap-4');
    expect(currentColumn).toHaveClass('shrink-0');
    expect(currentColumn).toContainElement(document.getElementById('price'));
    expect(currentColumn).toContainElement(tax);
    expect(tax).toHaveClass('text-sm', 'shrink-0', 'whitespace-nowrap');
    expect(normalizedText(tax)).toContain(`plus ${price.tax!.taxRate}% VAT`);
    expect(listColumn).toContainElement(root.querySelector('.line-through'));
    expect(document.getElementById('price')).toHaveClass('text-3xl');
    expect(document.getElementById('currency')).toHaveClass('text-2xl');
    expect(listColumn.querySelector('.line-through')).toHaveClass('text-base');
  });

  it('keeps thousand grouping intact for net amounts ≥ 1000 (900 stays 900; gross 1071 in small print)', () => {
    const price = buildPrice({
      includesTax: false,
      amount: 900,
      originalAmount: 1000,
      discountPercentage: 10,
      tax: {
        taxCode: 'STANDARD',
        taxRate: 19,
        netValue: 900,
        grossValue: 1071,
        amount: 171,
        currency: 'EUR',
      },
    });
    render(<ProductPriceComponent price={price} />);

    const priceNode = document.getElementById('price');
    expect(priceNode).not.toBeNull();
    const largeDigits = normalizedText(priceNode).replaceAll(/\D/g, '');
    expect(largeDigits.startsWith('900')).toBe(true);
    expect(largeDigits.startsWith('1071')).toBe(false);
    expect(largeDigits.startsWith('171')).toBe(false);

    const text = normalizedText(screen.getByTestId('product-price'));
    expect(text).toContain(normalizeWhitespace(formatCurrency(1071, 'EUR')));
    expect(text).toContain('gross');
  });

  it('falls back to amount when tax.netValue is a bogus 0', () => {
    const price = buildPrice({
      amount: 372.59,
      tax: {
        taxCode: 'STANDARD',
        taxRate: 19,
        netValue: 0,
        grossValue: 0,
        amount: 0,
        currency: 'EUR',
      },
    });
    render(<ProductPriceComponent price={price} />);

    expectLargeFigure(372.59);
    expect(normalizedText(screen.getByTestId('product-price'))).not.toContain('gross');
  });

  it('shows unavailable instead of a large 0 when no positive amount exists', () => {
    render(
      <ProductPriceComponent
        price={buildPrice({
          amount: 0,
          originalAmount: 0,
          tax: {
            taxCode: 'STANDARD',
            taxRate: 19,
            netValue: 0,
            grossValue: 0,
            amount: 0,
            currency: 'EUR',
          },
        })}
      />,
    );

    expect(screen.getByTestId('product-price')).toHaveAttribute('data-product-price-state', 'unavailable');
    expect(document.getElementById('price')).toBeNull();
  });

  it('shows a zero net amount when the list price is still present (100% discount)', () => {
    render(
      <ProductPriceComponent
        price={buildPrice({
          amount: 0,
          originalAmount: 459.99,
          discountPercentage: 100,
          tax: {
            taxCode: 'STANDARD',
            taxRate: 19,
            netValue: 0,
            grossValue: 0,
            amount: 0,
            currency: 'EUR',
          },
        })}
      />,
    );

    expect(screen.getByTestId('product-price')).not.toHaveAttribute('data-product-price-state', 'unavailable');
    expectLargeFigure(0);
    expect(normalizedText(screen.getByTestId('product-price'))).toContain(
      normalizeWhitespace(formatCurrency(459.99, 'EUR')),
    );
  });
});

describe('ProductPriceComponent qty-aware Your Price label', () => {
  const volumeTiers = [
    { id: 't1', minQuantity: 1, price: 150 },
    { id: 't2', minQuantity: 10, price: 100 },
    { id: 't3', minQuantity: 30, price: 98 },
  ];

  it('exposes qty-aware your-price keys in en and de', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const en = require('@/i18n/translations/en/product/index.json') as {
      price: {
        yourPriceItemsRange: string;
        yourPriceItemsFrom: string;
        amountForItemsRange: string;
        amountForItemsFrom: string;
      };
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const de = require('@/i18n/translations/de/product/index.json') as {
      price: {
        yourPriceItemsRange: string;
        yourPriceItemsFrom: string;
        amountForItemsRange: string;
        amountForItemsFrom: string;
      };
    };
    expect(en.price.yourPriceItemsRange).toBe('Your price (items {min} - {max})');
    expect(en.price.yourPriceItemsFrom).toBe('Your price (items {min}+)');
    expect(en.price.amountForItemsFrom).toBe('{amount} for items {min}+');
    expect(de.price.yourPriceItemsRange).toBe('Ihr Preis (Artikel {min} - {max})');
    expect(de.price.yourPriceItemsFrom).toBe('Ihr Preis (Artikel {min}+)');
    expect(de.price.amountForItemsFrom).toBe('{amount} für Artikel {min}+');
  });

  it('labels the current closed tier as Your price (items min - max) and keeps net-first amount', () => {
    const price = buildPrice({
      amount: 150,
      originalAmount: 150,
      discountPercentage: 0,
      quantity: { quantity: 5 },
      tax: {
        taxCode: 'STANDARD',
        taxRate: 19,
        netValue: 150,
        grossValue: 178.5,
        amount: 28.5,
        currency: 'EUR',
      },
      tierValues: volumeTiers,
    });
    render(<ProductPriceComponent price={price} quantity={5} />);

    const labels = normalizedText(screen.getByTestId('product-price-labels'));
    expect(labels).toContain('Your price (items 1 - 9)');
    expectLargeFigure(150);
    expect(normalizedText(screen.getByTestId('product-price-tier-caption'))).toContain('for items 1 - 9');
  });

  it('labels the last tier as Your price (items min+) and captions the fetched net amount', () => {
    const price = buildPrice({
      amount: 88.2,
      originalAmount: 98,
      discountPercentage: 10,
      quantity: { quantity: 30 },
      tax: {
        taxCode: 'STANDARD',
        taxRate: 19,
        netValue: 88.2,
        grossValue: 105,
        amount: 16.8,
        currency: 'EUR',
      },
      tierValues: volumeTiers,
    });
    render(<ProductPriceComponent price={price} quantity={30} />);

    expect(normalizedText(screen.getByTestId('product-price-labels'))).toContain('Your price (items 30+)');
    expectLargeFigure(88.2);
    expect(screen.getByText('-10%')).toBeInTheDocument();
    expect(normalizedText(screen.getByTestId('product-price-tier-caption'))).toContain('for items 30+');
  });

  it('uses discountPercentage from match-prices and does not strike through Your Price net/gross', () => {
    const price = buildPrice({
      amount: 88.2,
      originalAmount: 88.2,
      discountPercentage: 10,
      quantity: { quantity: 30 },
      tax: {
        taxCode: 'STANDARD',
        taxRate: 19,
        netValue: 88.2,
        grossValue: 105,
        amount: 16.8,
        currency: 'EUR',
      },
      tierValues: volumeTiers,
    });
    render(<ProductPriceComponent price={price} quantity={30} />);

    const root = screen.getByTestId('product-price');
    expect(screen.getByText('-10%')).toBeInTheDocument();
    expect(root.querySelector('.line-through')).toBeNull();
    expectLargeFigure(88.2);
    expect(normalizedText(root)).toContain(normalizeWhitespace(formatCurrency(105, 'EUR')));
    expect(normalizedText(root)).toContain('gross');
  });

  it('keeps the plain yourPrice label when match-prices returns no tier rows', () => {
    render(<ProductPriceComponent price={buildPrice({ tierValues: [], discountPercentage: 0 })} />);

    expect(normalizedText(screen.getByTestId('product-price-labels'))).toContain('yourPrice');
    expect(screen.queryByTestId('product-price-tier-caption')).not.toBeInTheDocument();
  });

  it('keeps the plain yourPrice label when there is only a single tier', () => {
    render(
      <ProductPriceComponent
        price={buildPrice({
          tierValues: [{ id: 't1', minQuantity: 1, price: 289.71 }],
          discountPercentage: 0,
          quantity: { quantity: 1 },
        })}
        quantity={1}
      />,
    );

    expect(normalizedText(screen.getByTestId('product-price-labels'))).toContain('yourPrice');
    expect(normalizedText(screen.getByTestId('product-price-labels'))).not.toContain('items 1+');
    expect(screen.queryByTestId('product-price-tier-caption')).not.toBeInTheDocument();
  });
});
