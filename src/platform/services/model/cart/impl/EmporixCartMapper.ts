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

/** Cart-level applied-discount lists; free-shipping coupons live on the shipping ones. */
function cartLevelAppliedDiscounts(
  calculatedPrice: EmporixCart['calculatedPrice'],
): EmporixCalculatedAppliedDiscount[] {
  return [
    ...(calculatedPrice?.totalDiscount?.appliedDiscounts ?? []),
    ...(calculatedPrice?.shipping?.appliedDiscounts ?? []),
    ...(calculatedPrice?.totalShipping?.appliedDiscounts ?? []),
  ];
}

/** Line-level lists — category/product coupons often appear only here, not on `totalDiscount`. */
function lineLevelAppliedDiscounts(items: EmporixCart['items']): EmporixCalculatedAppliedDiscount[] {
  return (items ?? []).flatMap((item) => [
    ...(item.calculatedPrice?.totalDiscount?.appliedDiscounts ?? []),
    ...(item.calculatedPrice?.price?.appliedDiscounts ?? []),
    ...(item.calculatedPrice?.discountedPrice?.appliedDiscounts ?? []),
    ...(item.calculatedPrice?.finalPrice?.appliedDiscounts ?? []),
  ]);
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
 * Prefer the cart-level applied row (already aggregated). If the code is only on lines
 * (COP-4815 QA: category coupons), sum those line values so the chip is not 0 / missing.
 */
function resolveAppliedDiscount(
  cartLevel: EmporixCalculatedAppliedDiscount[],
  lineLevel: EmporixCalculatedAppliedDiscount[],
  discount: EmporixCartDiscount,
): EmporixCalculatedAppliedDiscount | undefined {
  return matchAppliedDiscount(cartLevel, discount) ?? matchAppliedDiscount(lineLevel, discount);
}

function mapCartDiscounts(
  sourceDiscounts: EmporixCartDiscount[] | undefined,
  cartLevel: EmporixCalculatedAppliedDiscount[],
  lineLevel: EmporixCalculatedAppliedDiscount[],
  currency: string,
): CartAppliedDiscount[] | undefined {
  if (!sourceDiscounts || sourceDiscounts.length === 0) {
    return undefined;
  }
  const mapped = sourceDiscounts.flatMap((discount, arrayIndex) => {
    if (discount.valid === false) {
      return [];
    }
    const applied = resolveAppliedDiscount(cartLevel, lineLevel, discount);
    return [
      {
        code: discount.code,
        name: discount.name,
        discountIndex: discount.discountIndex ?? arrayIndex,
        amount: applied?.value ?? discount.amount ?? 0,
        currency: discount.currency ?? currency,
        ...(applied?.discountType ? { type: applied.discountType } : {}),
      },
    ];
  });
  return mapped.length > 0 ? mapped : undefined;
}

function hasFreeShippingDiscount(applied: EmporixCalculatedAppliedDiscount[] | undefined): boolean {
  return (applied ?? []).some((discount) => discount.discountType === 'FREE_SHIPPING');
}

/**
 * True when a coupon waives shipping: a `FREE_SHIPPING` applied discount anywhere on the
 * calculated price, or `totalShipping` zeroed while the pre-discount `shipping` is non-zero.
 */
function isShippingWaived(calculatedPrice: EmporixCart['calculatedPrice']): boolean {
  if (!calculatedPrice) {
    return false;
  }
  const { totalDiscount, shipping, totalShipping } = calculatedPrice;
  if (
    hasFreeShippingDiscount(totalDiscount?.appliedDiscounts) ||
    hasFreeShippingDiscount(shipping?.appliedDiscounts) ||
    hasFreeShippingDiscount(totalShipping?.appliedDiscounts)
  ) {
    return true;
  }
  return totalShipping?.grossValue === 0 && (shipping?.grossValue ?? 0) > 0;
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
      cartLevelAppliedDiscounts(emporixCart.calculatedPrice),
      lineLevelAppliedDiscounts(emporixCart.items),
      currency,
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
