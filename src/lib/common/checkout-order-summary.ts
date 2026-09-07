import { shouldDisplayTaxLine } from '@/components/account/shared/detail-tax-line';
import type { Cart } from '@/platform/services/model/cart';

export type CheckoutOrderSummaryBreakdown = {
  goodsNet: number;
  goodsVat: number;
  shippingFee: number | undefined;
  shippingVat: number;
  showShippingVat: boolean;
  shippingVatLookupFailed: boolean;
  feesTotal: number;
  total: number;
  currency: string;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildCheckoutOrderSummaryBreakdown(input: {
  goodsNet: number;
  goodsVat: number;
  shippingFee?: number;
  shippingVatRate?: number;
  shippingTaxCodePresent?: boolean;
  feesTotal?: number;
  currency: string;
}): CheckoutOrderSummaryBreakdown {
  const { goodsNet, goodsVat, shippingFee, shippingVatRate, currency } = input;
  const shippingTaxCodePresent = input.shippingTaxCodePresent === true;
  const feesTotal = input.feesTotal ?? 0;
  const shippingVatLookupFailed = shippingTaxCodePresent && shippingVatRate === undefined;

  let shippingVat = 0;
  if (!shippingVatLookupFailed && typeof shippingVatRate === 'number' && shippingFee !== undefined) {
    shippingVat = round2((shippingFee * shippingVatRate) / 100);
  }

  const showShippingVat = shippingVatLookupFailed
    ? false
    : shouldDisplayTaxLine({ taxRate: shippingVatRate, taxAmount: shippingVat });

  return {
    goodsNet,
    goodsVat,
    shippingFee,
    shippingVat,
    showShippingVat,
    shippingVatLookupFailed,
    feesTotal,
    total: round2(goodsNet + goodsVat + (shippingFee ?? 0) + shippingVat + feesTotal),
    currency,
  };
}

/** Checkout-store shipping fee used only for display when it differs from the cart snapshot. */
export type SelectedShippingOverlay = {
  amount: number;
};

function amountsEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.005;
}

function mappedCartShippingGross(cart: Cart): number {
  return cart.shippingCosts?.tax?.grossValue ?? cart.shippingCosts?.amount ?? 0;
}

/**
 * Checkout / cart / mini-cart summary from mapped Emporix `calculatedPrice`.
 * When a checkout shipping method is picked and its fee differs from the cart
 * snapshot, overlay that fee on the total — no fee × rate VAT math (avoids flicker).
 */
export function buildCheckoutOrderSummaryFromCart(
  cart: Cart | null | undefined,
  selectedShipping?: SelectedShippingOverlay | null,
): CheckoutOrderSummaryBreakdown {
  const shippingVat = cart?.shippingCosts?.tax?.amount ?? 0;
  const fromCart: CheckoutOrderSummaryBreakdown = {
    goodsNet: cart?.tax?.netValue ?? 0,
    goodsVat: cart?.tax?.amount ?? 0,
    shippingFee: cart?.shippingCosts?.amount,
    shippingVat,
    showShippingVat: shouldDisplayTaxLine({
      taxRate: cart?.shippingCosts?.tax?.taxRate,
      taxAmount: shippingVat,
    }),
    shippingVatLookupFailed: false,
    feesTotal: cart?.fees?.amount ?? 0,
    total: cart?.totalPrice?.amount ?? 0,
    currency: cart?.tax?.currency ?? cart?.currency ?? '',
  };

  if (!cart) {
    return fromCart;
  }

  // Emporix cart shipping is a minimum estimate until the shopper picks a findSite method.
  // Do not treat that quote as a chosen fee on checkout / cart / mini-cart.
  if (selectedShipping == null || !Number.isFinite(selectedShipping.amount)) {
    const cartShippingGross = mappedCartShippingGross(cart);
    return {
      ...fromCart,
      shippingFee: undefined,
      shippingVat: 0,
      showShippingVat: false,
      total: round2((cart.totalPrice?.amount ?? 0) - cartShippingGross),
    };
  }

  const cartShippingFee = cart.shippingCosts?.amount ?? 0;
  if (amountsEqual(selectedShipping.amount, cartShippingFee)) {
    return fromCart;
  }

  const shippingFee = selectedShipping.amount;
  return {
    ...fromCart,
    shippingFee,
    shippingVat: 0,
    showShippingVat: false,
    shippingVatLookupFailed: false,
    total: round2((cart.totalPrice?.amount ?? 0) - mappedCartShippingGross(cart) + shippingFee),
  };
}
