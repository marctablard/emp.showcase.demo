export type QuoteCartTotalSnapshot = {
  amount: number;
  currency: string;
};

type CartTotalSource = {
  totalPrice?: { amount?: number; currency?: string } | null;
} | null;

export type PendingQuoteCartTotal = {
  total: QuoteCartTotalSnapshot;
  cart: unknown;
};

export type QuoteCartTotalChange = { status: 'wait' } | { status: 'done'; nextTotal: QuoteCartTotalSnapshot | null };

export function snapshotQuoteCartTotal(cart: CartTotalSource | undefined): QuoteCartTotalSnapshot | null {
  const amount = cart?.totalPrice?.amount;
  const currency = cart?.totalPrice?.currency?.trim();
  if (typeof amount !== 'number' || !Number.isFinite(amount) || !currency) {
    return null;
  }
  return { amount, currency };
}

export function quoteCartTotalsDiffer(previous: QuoteCartTotalSnapshot, next: QuoteCartTotalSnapshot): boolean {
  return previous.amount !== next.amount || previous.currency !== next.currency;
}

export function evaluateQuoteCartTotalChange(
  pending: PendingQuoteCartTotal | null,
  checkoutCart: CartTotalSource | undefined,
  syncReady: boolean,
): QuoteCartTotalChange {
  if (!pending || !syncReady || !checkoutCart || checkoutCart === pending.cart) {
    return { status: 'wait' };
  }
  const nextTotal = snapshotQuoteCartTotal(checkoutCart);
  if (!nextTotal) {
    return { status: 'wait' };
  }
  if (!quoteCartTotalsDiffer(pending.total, nextTotal)) {
    return { status: 'done', nextTotal: null };
  }
  return { status: 'done', nextTotal };
}
