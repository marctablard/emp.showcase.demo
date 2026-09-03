import { evaluateQuoteCartTotalChange, quoteCartTotalsDiffer, snapshotQuoteCartTotal } from './quote-cart-total';

describe('quote cart total snapshot', () => {
  it('reads a finite cart total', () => {
    expect(snapshotQuoteCartTotal({ totalPrice: { amount: 82.3, currency: 'EUR' } })).toEqual({
      amount: 82.3,
      currency: 'EUR',
    });
  });

  it('ignores a cart that is still syncing', () => {
    expect(snapshotQuoteCartTotal(null)).toBeNull();
    expect(snapshotQuoteCartTotal({ totalPrice: { amount: 10, currency: '  ' } })).toBeNull();
  });

  it('treats DE vs CH totals as a change when amount or currency differs', () => {
    expect(quoteCartTotalsDiffer({ amount: 82.3, currency: 'EUR' }, { amount: 119.05, currency: 'CHF' })).toBe(true);
    expect(quoteCartTotalsDiffer({ amount: 82.3, currency: 'EUR' }, { amount: 82.3, currency: 'EUR' })).toBe(false);
  });

  it('waits while country sync is in flight or the cart instance is unchanged', () => {
    const deCart = { totalPrice: { amount: 82.3, currency: 'EUR' } };
    const pending = { total: { amount: 82.3, currency: 'EUR' }, cart: deCart };
    expect(evaluateQuoteCartTotalChange(pending, { totalPrice: { amount: 119.05, currency: 'CHF' } }, false)).toEqual({
      status: 'wait',
    });
    expect(evaluateQuoteCartTotalChange(pending, deCart, true)).toEqual({ status: 'wait' });
  });

  it('reports a DE to CH total change once the replacement cart is ready', () => {
    const deCart = { totalPrice: { amount: 82.3, currency: 'EUR' } };
    const chCart = { totalPrice: { amount: 119.05, currency: 'CHF' } };
    expect(
      evaluateQuoteCartTotalChange({ total: { amount: 82.3, currency: 'EUR' }, cart: deCart }, chCart, true),
    ).toEqual({
      status: 'done',
      nextTotal: { amount: 119.05, currency: 'CHF' },
    });
  });
});
