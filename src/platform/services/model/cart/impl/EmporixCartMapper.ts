import { injectable } from '@/platform/core/di/injectable';
import type {
  EmporixCalculatedAppliedDiscount,
  EmporixCart,
  EmporixCartDiscount,
  EmporixCartItem,
  EmporixCartPrice,
} from '@/platform/integrations/emporix/model/cart';
import type { Price, Tax } from '../../common';
import type { CartMapper } from '../CartMapper';
import type { Cart, CartAppliedDiscount, Cart as ServiceCart, CartItem as ServiceCartItem } from '../cart';

function mapCalculatedMoney(price: EmporixCartPrice, currency: string, amount: 'net' | 'gross'): Price {
  return {
    amount: amount === 'net' ? price.netValue : price.grossValue,
    currency,
    tax: {
      amount: price.taxValue,
      currency,
      netValue: price.netValue,
      grossValue: price.grossValue,
      taxCode: price.taxCode,
      taxRate: price.taxRate,
    },
  };
}

/**
 * Prefer the first non-empty list. Cart/line `totalDiscount.appliedDiscounts` already
 * aggregate overlapping component rows (shipping / discountedPrice); concatenating them
 * would double-count the same coupon (COP-4815 Copilot).
 */
function firstAppliedDiscountList(
  ...lists: Array<EmporixCalculatedAppliedDiscount[] | undefined>
): EmporixCalculatedAppliedDiscount[] {
  for (const list of lists) {
    if (list && list.length > 0) {
      return list;
    }
  }
  return [];
}

function cartAggregateAppliedDiscounts(
  calculatedPrice: EmporixCart['calculatedPrice'],
): EmporixCalculatedAppliedDiscount[] {
  return calculatedPrice?.totalDiscount?.appliedDiscounts ?? [];
}

function shippingAppliedDiscounts(calculatedPrice: EmporixCart['calculatedPrice']): EmporixCalculatedAppliedDiscount[] {
  return firstAppliedDiscountList(
    calculatedPrice?.totalShipping?.appliedDiscounts,
    calculatedPrice?.shipping?.appliedDiscounts,
  );
}

/** Line-level lists — category/product coupons often appear only here, not on cart `totalDiscount`. */
function lineLevelAppliedDiscounts(items: EmporixCart['items']): EmporixCalculatedAppliedDiscount[] {
  return (items ?? []).flatMap((item) =>
    firstAppliedDiscountList(
      item.calculatedPrice?.totalDiscount?.appliedDiscounts,
      item.calculatedPrice?.discountedPrice?.appliedDiscounts,
      item.calculatedPrice?.price?.appliedDiscounts,
      item.calculatedPrice?.finalPrice?.appliedDiscounts,
    ),
  );
}

function matchAppliedDiscount(
  appliedDiscounts: EmporixCalculatedAppliedDiscount[],
  discount: EmporixCartDiscount,
): EmporixCalculatedAppliedDiscount | undefined {
  const matches = appliedDiscounts.filter(
    (applied) => applied.id !== undefined && (applied.id === discount.code || applied.id === discount.id),
  );
  if (matches.length === 0) {
    return undefined;
  }
  if (matches.length === 1) {
    return matches[0];
  }
  return {
    ...matches[0],
    value: matches.reduce((sum, match) => sum + match.value, 0),
  };
}

/**
 * Prefer the cart aggregate row, then shipping-only lists, then line sums for category coupons.
 * Each list is matched on its own so overlapping aggregate/component rows are not added twice.
 */
function resolveAppliedDiscount(
  cartLevel: EmporixCalculatedAppliedDiscount[],
  shippingLevel: EmporixCalculatedAppliedDiscount[],
  lineLevel: EmporixCalculatedAppliedDiscount[],
  discount: EmporixCartDiscount,
): EmporixCalculatedAppliedDiscount | undefined {
  return (
    matchAppliedDiscount(cartLevel, discount) ??
    matchAppliedDiscount(shippingLevel, discount) ??
    matchAppliedDiscount(lineLevel, discount)
  );
}

function uniqueInternalFreeShippingIdentities(calculatedPrice: EmporixCart['calculatedPrice']): string[] {
  const ids = new Set<string>();
  let sawIdLess = false;
  for (const row of [
    ...(calculatedPrice?.totalDiscount?.appliedDiscounts ?? []),
    ...(calculatedPrice?.shipping?.appliedDiscounts ?? []),
    ...(calculatedPrice?.totalShipping?.appliedDiscounts ?? []),
  ]) {
    const isInternalOrigin = row.origin === 'INTERNAL' || row.origin === undefined;
    if (row.discountType === 'FREE_SHIPPING' && isInternalOrigin) {
      if (row.id === undefined) {
        sawIdLess = true;
      } else {
        ids.add(row.id);
      }
    }
  }
  if (ids.size > 0) {
    return [...ids];
  }
  return sawIdLess ? ['idless'] : [];
}

/** Sole shopper coupon + one internal typed FREE_SHIPPING identity (id-less rows counted once). */
function inferSoleTypedFreeShipping(
  sourceDiscounts: EmporixCartDiscount[],
  calculatedPrice: EmporixCart['calculatedPrice'],
): boolean {
  const soleNonTotal =
    sourceDiscounts.filter((discount) => discount.valid !== false && discount.code !== 'TOTAL').length === 1;
  return soleNonTotal && uniqueInternalFreeShippingIdentities(calculatedPrice).length === 1;
}

function mapCartDiscounts(
  sourceDiscounts: EmporixCartDiscount[] | undefined,
  cartLevel: EmporixCalculatedAppliedDiscount[],
  shippingLevel: EmporixCalculatedAppliedDiscount[],
  lineLevel: EmporixCalculatedAppliedDiscount[],
  currency: string,
  inferZeroedShipping: boolean,
  inferSoleTypedFreeShippingType: boolean,
): CartAppliedDiscount[] | undefined {
  if (!sourceDiscounts || sourceDiscounts.length === 0) {
    return undefined;
  }
  const soleNonTotal =
    sourceDiscounts.filter((discount) => discount.valid !== false && discount.code !== 'TOTAL').length === 1;
  const mapped = sourceDiscounts.flatMap((discount, arrayIndex) => {
    if (discount.valid === false) {
      return [];
    }
    const applied = resolveAppliedDiscount(cartLevel, shippingLevel, lineLevel, discount);
    let type = applied?.discountType;
    if (!type && inferZeroedShipping && discount.code !== 'TOTAL') {
      const shippingMatch = matchAppliedDiscount(shippingLevel, discount);
      const noGoodsAmount = (applied?.value ?? discount.amount ?? 0) === 0;
      if (shippingMatch || (soleNonTotal && noGoodsAmount)) {
        type = 'FREE_SHIPPING';
      }
    }
    if (!type && inferSoleTypedFreeShippingType && discount.code !== 'TOTAL') {
      type = 'FREE_SHIPPING';
    }
    return [
      {
        code: discount.code,
        name: discount.name,
        discountIndex: discount.discountIndex ?? arrayIndex,
        amount: applied?.value ?? discount.amount ?? 0,
        currency: discount.currency ?? currency,
        ...(type ? { type } : {}),
      },
    ];
  });
  return mapped.length > 0 ? mapped : undefined;
}

function hasFreeShippingDiscount(applied: EmporixCalculatedAppliedDiscount[] | undefined): boolean {
  return (applied ?? []).some((discount) => discount.discountType === 'FREE_SHIPPING');
}

function hasTypedFreeShipping(calculatedPrice: EmporixCart['calculatedPrice']): boolean {
  return (
    hasFreeShippingDiscount(calculatedPrice?.totalDiscount?.appliedDiscounts) ||
    hasFreeShippingDiscount(calculatedPrice?.shipping?.appliedDiscounts) ||
    hasFreeShippingDiscount(calculatedPrice?.totalShipping?.appliedDiscounts)
  );
}

/**
 * True when a coupon waives shipping: a `FREE_SHIPPING` applied discount anywhere on the
 * calculated price, or `totalShipping` zeroed while the pre-discount `shipping` is non-zero.
 */
function isShippingWaived(calculatedPrice: EmporixCart['calculatedPrice']): boolean {
  return hasTypedFreeShipping(calculatedPrice) || isZeroedShippingWaiver(calculatedPrice);
}

/** Shipping was waived without a typed `FREE_SHIPPING` applied row. */
function isZeroedShippingWaiver(calculatedPrice: EmporixCart['calculatedPrice']): boolean {
  if (!calculatedPrice || hasTypedFreeShipping(calculatedPrice)) {
    return false;
  }
  return calculatedPrice.totalShipping?.grossValue === 0 && (calculatedPrice.shipping?.grossValue ?? 0) > 0;
}

/**
 * Maps between Emporix Cart model and Service Cart model
 */
@injectable('EmporixCartMapper', 'Singleton')
export class EmporixCartMapper implements CartMapper<EmporixCart, EmporixCartItem> {
  /**
   * Maps an Emporix Cart to a Service Cart
   * @param emporixCart The Emporix Cart to map
   * @returns A Service Cart
   */
  mapToService(emporixCart: EmporixCart): ServiceCart {
    const currency = emporixCart.currency;
    const finalPrice = emporixCart.calculatedPrice?.finalPrice;
    const goodsPrice = emporixCart.calculatedPrice?.price;
    const shippingPrice = emporixCart.calculatedPrice?.totalShipping ?? emporixCart.calculatedPrice?.shipping;

    const totalPrice = finalPrice ? mapCalculatedMoney(finalPrice, currency, 'gross') : { amount: 0, currency };
    const subTotalPrice = goodsPrice
      ? {
          amount: goodsPrice.grossValue,
          currency,
        }
      : {
          amount: 0,
          currency,
        };
    const tax = goodsPrice
      ? {
          amount: goodsPrice.taxValue,
          currency,
          netValue: goodsPrice.netValue,
          grossValue: goodsPrice.grossValue,
        }
      : {
          amount: 0,
          currency,
          netValue: 0,
          grossValue: 0,
        };

    const shippingCosts = shippingPrice ? mapCalculatedMoney(shippingPrice, currency, 'net') : undefined;
    let fees;
    if (emporixCart.calculatedPrice?.totalFee) {
      fees = {
        amount: emporixCart.calculatedPrice.totalFee.grossValue,
        currency: emporixCart.currency,
      };
    } else {
      fees = undefined;
    }
    const totalDiscount = emporixCart.calculatedPrice?.totalDiscount;
    const discountedPrice = emporixCart.calculatedPrice?.discountedPrice;
    const discounts = mapCartDiscounts(
      emporixCart.discounts,
      cartAggregateAppliedDiscounts(emporixCart.calculatedPrice),
      shippingAppliedDiscounts(emporixCart.calculatedPrice),
      lineLevelAppliedDiscounts(emporixCart.items),
      currency,
      isZeroedShippingWaiver(emporixCart.calculatedPrice),
      inferSoleTypedFreeShipping(emporixCart.discounts ?? [], emporixCart.calculatedPrice),
    );
    return {
      id: emporixCart.id,
      customerId: emporixCart.customerId,
      sessionId: emporixCart.sessionId,
      currency: emporixCart.currency,
      site: emporixCart.siteCode,
      legalEntity: emporixCart.legalEntityId,
      channel: emporixCart.channel?.name,
      items: emporixCart.items?.map((item) => this.mapCartItemToService(emporixCart, item)) || [],
      shippingCosts: shippingCosts,
      fees: fees,
      totalPrice: totalPrice,
      subTotalPrice: subTotalPrice,
      tax: tax,
      ...(discounts ? { discounts } : {}),
      ...(totalDiscount ? { savingsTotal: totalDiscount.value } : {}),
      ...(totalDiscount?.calculationType
        ? {
            totalDiscountCalculationType: totalDiscount.calculationType,
            includesTax: totalDiscount.calculationType === 'ApplyDiscountAfterTax',
          }
        : {}),
      ...(discountedPrice
        ? {
            goodsDiscountedNet: discountedPrice.netValue,
            goodsDiscountedVat: discountedPrice.taxValue,
            goodsDiscountedGross: discountedPrice.grossValue,
          }
        : {}),
      ...(isShippingWaived(emporixCart.calculatedPrice) ? { freeShipping: true } : {}),
    };
  }

  /**
   * Maps an Emporix CartItem to a Service CartItem
   * @param emporixCartItem The Emporix CartItem to map
   * @returns A Service CartItem
   */
  mapCartItemToService(emporixCart: EmporixCart, emporixCartItem: EmporixCartItem): ServiceCartItem {
    let tax: Tax | undefined;
    if (emporixCartItem.calculatedPrice?.finalPrice) {
      const amount = emporixCartItem.calculatedPrice.finalPrice.taxValue;
      tax = {
        amount: amount,
        currency: emporixCart.currency,
        netValue: emporixCartItem.calculatedPrice.finalPrice.netValue,
        grossValue: emporixCartItem.calculatedPrice.finalPrice.grossValue,
      };
    } else {
      tax = undefined;
    }
    return {
      id: emporixCartItem.id,
      quantity: emporixCartItem.quantity,
      price: {
        amount: emporixCartItem.calculatedPrice?.finalPrice.grossValue || 0,
        currency: emporixCart.currency,
      },
      product: emporixCartItem.product
        ? {
            id: emporixCartItem.product.id,
            // Prefer the full localized map so the UI can resolve the current UI locale
            // on every render via `useL10n()`; fall back to the single-language string
            // only when Emporix responded without a localized map (e.g. legacy cart lines).
            name: emporixCartItem.product.localizedName ?? emporixCartItem.product.name,
            description: emporixCartItem.product.description,
            images: emporixCartItem.product.images?.map((img) => {
              const altSource = emporixCartItem.product?.localizedName ?? emporixCartItem.product?.name;
              return { altText: altSource ?? 'Product', url: img.url };
            }),
          }
        : undefined,
      tax: tax,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mapToSource(cart: Cart): EmporixCart {
    throw new Error('Not implemented');
  }
}

export default EmporixCartMapper;
