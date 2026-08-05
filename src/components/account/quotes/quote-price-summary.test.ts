import type { Quote } from '@/platform/services/model/quote';
import {
  quoteHasItemDiscounts,
  resolveItemDiscountPercent,
  resolveQuoteBasePriceBreakdown,
  resolveQuoteQuotedPriceBreakdown,
  resolveQuoteTotalNetAmount,
  resolveQuotedGrossUnitPrice,
  resolveQuotedNetUnitPrice,
  sumQuotePriceCardLines,
} from './quote-price-summary';

const baseQuote: Quote = {
  id: 'Q-1000',
  status: 'OPEN',
  submittedDate: '2026-05-31T10:00:00.000Z',
  customerId: 'customer-1',
  currency: 'EUR',
  totalGross: 1445.89,
  totalNet: 1194.79,
  totalVat: 227.01,
  vatRate: 19,
  items: [
    {
      product: {
        id: 'p1',
        quantity: 1,
        itemPrice: {
          amount: 100.56,
          currency: 'EUR',
          unitPrice: 130,
          newUnitPrice: 84.5,
          discount: 35,
          taxRate: 19,
          netValue: 84.5,
          grossValue: 100.56,
          baseAmount: 84.5,
        },
      },
      quantity: { quantity: 1, unitCode: 'pc' },
    },
    {
      product: {
        id: 'p2',
        quantity: 1,
        itemPrice: {
          amount: 1321.25,
          currency: 'EUR',
          unitPrice: 1850.49,
          newUnitPrice: 1110.29,
          discount: 40,
          taxRate: 19,
          netValue: 1110.29,
          grossValue: 1321.25,
          baseAmount: 1110.29,
        },
      },
      quantity: { quantity: 1, unitCode: 'pc' },
    },
  ],
  shippingAddress: {
    type: 'SHIPPING',
    contactName: 'Ada',
    street: 'Main 1',
    zipCode: '10115',
    city: 'Berlin',
    country: 'Germany',
  },
  shippingCost: 11,
  shippingMethod: 'DHL',
};

describe('quote-price-summary', () => {
  it('resolves total net amount as goods net + shipping net', () => {
    expect(resolveQuoteTotalNetAmount(baseQuote)).toBeCloseTo(1205.79, 2);
  });

  it('builds Quoted Price from subtotalPrice + shipping (+ shipping tax) with totalPrice.grossValue', () => {
    // 756.9 + 143.82 + 11 + 0 = 911.72 === totalPrice.grossValue
    const quote: Quote = {
      ...baseQuote,
      currency: 'USD',
      totalNet: 767.9,
      totalVat: 143.82,
      totalGross: 911.72,
      subtotalNet: 756.9,
      subtotalVat: 143.82,
      shippingCost: 11,
      shippingGross: 11,
    };

    const quoted = resolveQuoteQuotedPriceBreakdown(quote);

    expect(quoted.netValueOfGoods).toBe(756.9);
    expect(quoted.tax).toBe(143.82);
    expect(quoted.shippingFee).toBe(11);
    expect(quoted.shippingTax).toBe(0);
    expect(quoted.showShippingTax).toBe(false);
    expect(quoted.total).toBe(911.72);
    expect(sumQuotePriceCardLines(quoted)).toBeCloseTo(911.72, 2);
    expect(sumQuotePriceCardLines(quoted)).toBeCloseTo(quoted.total, 2);
  });

  it('includes shipping tax when shipping.value > 0 and grossValue exceeds value', () => {
    // Lines: 756.9 + 143.82 + 11 + 2.1 = 913.82 === totalPrice.grossValue
    const quote: Quote = {
      ...baseQuote,
      totalGross: 913.82,
      subtotalNet: 756.9,
      subtotalVat: 143.82,
      shippingCost: 11,
      shippingGross: 13.1, // tax = 2.1
    };

    const quoted = resolveQuoteQuotedPriceBreakdown(quote);

    expect(quoted.shippingTax).toBeCloseTo(2.1, 5);
    expect(quoted.showShippingTax).toBe(true);
    expect(sumQuotePriceCardLines(quoted)).toBeCloseTo(756.9 + 143.82 + 11 + 2.1, 2);
    expect(quoted.total).toBe(913.82);
    expect(sumQuotePriceCardLines(quoted)).toBeCloseTo(quoted.total, 2);
  });

  it('hides shipping tax when shipping.value is 0 even if grossValue is present', () => {
    // Free shipping: lines = 756.9 + 143.82 = 900.72 === totalPrice.grossValue
    const quote: Quote = {
      ...baseQuote,
      totalGross: 900.72,
      subtotalNet: 756.9,
      subtotalVat: 143.82,
      shippingCost: 0,
      shippingGross: 0,
    };

    const quoted = resolveQuoteQuotedPriceBreakdown(quote);

    expect(quoted.shippingFee).toBe(0);
    expect(quoted.shippingTax).toBe(0);
    expect(quoted.showShippingTax).toBe(false);
    expect(sumQuotePriceCardLines(quoted)).toBeCloseTo(900.72, 2);
    expect(quoted.total).toBe(900.72);
    expect(sumQuotePriceCardLines(quoted)).toBeCloseTo(quoted.total, 2);
  });

  it('builds Base Price from Σ(unitPrice×qty), tax, shipping, shipping tax — total equals line sum', () => {
    // net 1980.49 + tax 376.2931 + shipping 11 + shipping tax 2.1 = 2369.8931
    const quote: Quote = {
      ...baseQuote,
      subtotalNet: 1194.79,
      shippingCost: 11,
      shippingGross: 13.1,
    };

    const base = resolveQuoteBasePriceBreakdown(quote);

    expect(base.netValueOfGoods).toBeCloseTo(1980.49, 2);
    expect(base.tax).toBeCloseTo(1980.49 * 0.19, 2);
    expect(base.shippingFee).toBe(11);
    expect(base.shippingTax).toBeCloseTo(2.1, 5);
    expect(base.showShippingTax).toBe(true);
    expect(base.discountAmount).toBeCloseTo(1980.49 - 1194.79, 2);
    expect(sumQuotePriceCardLines(base)).toBeCloseTo(1980.49 + 1980.49 * 0.19 + 11 + 2.1, 2);
    expect(base.total).toBeCloseTo(sumQuotePriceCardLines(base), 5);
  });

  it('hides Base Price shipping tax when shipping.value is 0 and total still equals line sum', () => {
    const quote: Quote = {
      ...baseQuote,
      shippingCost: 0,
      shippingGross: 0,
    };

    const base = resolveQuoteBasePriceBreakdown(quote);

    expect(base.shippingFee).toBe(0);
    expect(base.shippingTax).toBe(0);
    expect(base.showShippingTax).toBe(false);
    expect(base.total).toBeCloseTo(1980.49 + 1980.49 * 0.19, 2);
    expect(base.total).toBeCloseTo(sumQuotePriceCardLines(base), 5);
  });

  it('falls back Quoted Price to totalNet/totalVat when subtotalPrice is absent', () => {
    const quoted = resolveQuoteQuotedPriceBreakdown(baseQuote);
    expect(quoted.netValueOfGoods).toBe(1194.79);
    expect(quoted.tax).toBe(227.01);
    expect(quoted.shippingFee).toBe(11);
    expect(quoted.total).toBe(1445.89);
  });

  it('detects discounts and formats unit columns', () => {
    expect(quoteHasItemDiscounts(baseQuote)).toBe(true);
    expect(resolveItemDiscountPercent(baseQuote.items[0].product.itemPrice)).toBe(35);
    expect(resolveQuotedNetUnitPrice(baseQuote.items[0].product.itemPrice, 1)).toBe(84.5);
    expect(resolveQuotedGrossUnitPrice(baseQuote.items[0].product.itemPrice, 1)).toBe(100.56);
  });

  it('derives discount percent from unit prices when discount field is missing', () => {
    expect(resolveItemDiscountPercent({ unitPrice: 100, newUnitPrice: 65 })).toBe(35);
  });
});
