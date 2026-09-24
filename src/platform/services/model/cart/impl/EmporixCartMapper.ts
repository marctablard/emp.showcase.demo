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
import type {
  Cart,
  CartAppliedDiscount,
  CartAppliedDiscountType,
  Cart as ServiceCart,
  CartItem as ServiceCartItem,
} from '../cart';

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

function isDisplayableProductCoupon(
  discount: EmporixCalculatedAppliedDiscount,
): discount is EmporixCalculatedAppliedDiscount & { id: string } {
  return (
    discount.discountType !== 'FREE_SHIPPING' &&
    discount.origin !== 'EXTERNAL' &&
    typeof discount.id === 'string' &&
    discount.id.length > 0 &&
    discount.value > 0.005
  );
}

function externalDiscountIds(item: EmporixCartItem): ReadonlySet<string> {
  const ids = new Set<string>();
  const lists = [
    item.calculatedPrice?.discountedPrice?.appliedDiscounts,
    item.calculatedPrice?.price?.appliedDiscounts,
    item.calculatedPrice?.finalPrice?.appliedDiscounts,
    item.calculatedPrice?.totalDiscount?.appliedDiscounts,
    item.calculatedPrice?.totalFee?.appliedDiscounts,
  ];
  for (const list of lists) {
    for (const discount of list ?? []) {
      if (discount.origin === 'EXTERNAL' && typeof discount.id === 'string' && discount.id.length > 0) {
        ids.add(discount.id);
      }
    }
  }
  return ids;
}

function feeDiscountIds(item: EmporixCartItem): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const discount of item.calculatedPrice?.totalFee?.appliedDiscounts ?? []) {
    if (typeof discount.id === 'string' && discount.id.length > 0) {
      ids.add(discount.id);
    }
  }
  return ids;
}

function isGoodsCoupon(
  discount: EmporixCalculatedAppliedDiscount,
  excludedIds: ReadonlySet<string>,
): discount is EmporixCalculatedAppliedDiscount & { id: string } {
  return isDisplayableProductCoupon(discount) && !excludedIds.has(discount.id);
}

function lineTaxRate(item: EmporixCartItem): number | undefined {
  return (
    item.calculatedPrice?.discountedPrice?.taxRate ??
    item.calculatedPrice?.price?.taxRate ??
    item.calculatedPrice?.finalPrice?.taxRate
  );
}

/** After-tax `appliedDiscounts.value` is gross. The product row shows the net saving. */
function netCouponAmount(value: number, item: EmporixCartItem): number {
  const taxRate = lineTaxRate(item);
  if (item.calculatedPrice?.totalDiscount?.calculationType !== 'ApplyDiscountAfterTax') {
    return value;
  }
  if (typeof taxRate !== 'number' || taxRate <= 0) {
    return value;
  }
  return value / (1 + taxRate / 100);
}

function displayableCoupons(
  list: EmporixCalculatedAppliedDiscount[] | undefined,
  excludedIds: ReadonlySet<string>,
): Array<EmporixCalculatedAppliedDiscount & { id: string }> {
  return (list ?? []).filter((discount) => isGoodsCoupon(discount, excludedIds));
}

/**
 * Goods coupons on one line. Prefer `discountedPrice`, then `price`, then `finalPrice`.
 * `totalDiscount` is only a fallback and is fee-inclusive, so rows that also appear on
 * `totalFee` stay off the product price. External price adjustments are not coupons.
 * The first list that still has a product coupon wins so overlapping rows are not added
 * twice. Free-shipping and zero-value rows stay off the product price.
 */
function mapLineCouponDiscounts(
  item: EmporixCartItem,
  currency: string,
): NonNullable<ServiceCartItem['couponDiscounts']> {
  const externalIds = externalDiscountIds(item);
  const goodsSources = [
    item.calculatedPrice?.discountedPrice?.appliedDiscounts,
    item.calculatedPrice?.price?.appliedDiscounts,
    item.calculatedPrice?.finalPrice?.appliedDiscounts,
  ];
  const goodsCoupons = goodsSources
    .map((list) => displayableCoupons(list, externalIds))
    .find((list) => list.length > 0);
  const fallbackIds = new Set<string>(externalIds);
  for (const id of feeDiscountIds(item)) {
    fallbackIds.add(id);
  }
  const productCoupons =
    goodsCoupons ?? displayableCoupons(item.calculatedPrice?.totalDiscount?.appliedDiscounts, fallbackIds);
  return productCoupons.map((discount) => ({
    code: discount.id,
    amount: netCouponAmount(discount.value, item),
    currency,
    type: discount.discountType,
  }));
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

/** Cart-level goods/fee rows — used only when `totalDiscount.appliedDiscounts` does not match. */
function cartGoodsAndFeeAppliedDiscounts(
  calculatedPrice: EmporixCart['calculatedPrice'],
): EmporixCalculatedAppliedDiscount[] {
  return [
    ...(calculatedPrice?.discountedPrice?.appliedDiscounts ?? []),
    ...(calculatedPrice?.totalFee?.appliedDiscounts ?? []),
  ];
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

function collapseAppliedMatches(
  matches: EmporixCalculatedAppliedDiscount[],
): EmporixCalculatedAppliedDiscount | undefined {
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

function matchAppliedDiscount(
  appliedDiscounts: EmporixCalculatedAppliedDiscount[],
  discount: EmporixCartDiscount,
  inferSoleIdLess: boolean,
): EmporixCalculatedAppliedDiscount | undefined {
  const matches = appliedDiscounts.filter(
    (applied) => typeof applied.id === 'string' && (applied.id === discount.code || applied.id === discount.id),
  );
  if (matches.length > 0) {
    return collapseAppliedMatches(matches);
  }
  if (!inferSoleIdLess) {
    return undefined;
  }
  return collapseAppliedMatches(
    appliedDiscounts.filter((applied) => applied.id === undefined && isInternalOrUnoriginated(applied)),
  );
}

/**
 * Prefer the cart aggregate row, then shipping-only lists, then line sums for category coupons.
 * Each list is matched on its own so overlapping aggregate/component rows are not added twice.
 */
function resolveAppliedDiscount(
  cartLevel: EmporixCalculatedAppliedDiscount[],
  goodsFeeLevel: EmporixCalculatedAppliedDiscount[],
  shippingLevel: EmporixCalculatedAppliedDiscount[],
  lineLevel: EmporixCalculatedAppliedDiscount[],
  discount: EmporixCartDiscount,
  inferSoleIdLess: boolean,
): EmporixCalculatedAppliedDiscount | undefined {
  return (
    matchAppliedDiscount(cartLevel, discount, inferSoleIdLess) ??
    matchAppliedDiscount(goodsFeeLevel, discount, inferSoleIdLess) ??
    matchAppliedDiscount(shippingLevel, discount, inferSoleIdLess) ??
    matchAppliedDiscount(lineLevel, discount, inferSoleIdLess)
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
    if (row.discountType === 'FREE_SHIPPING' && isInternalOrUnoriginated(row)) {
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

function isShopperSourceDiscount(discount: EmporixCartDiscount): boolean {
  if (discount.code === 'TOTAL') {
    return false;
  }
  return discount.valid === true || discount.valid === undefined;
}

function asCartDiscountType(value: string | undefined): CartAppliedDiscountType | undefined {
  if (value === 'PERCENT' || value === 'ABSOLUTE' || value === 'FREE_SHIPPING') {
    return value;
  }
  return undefined;
}

function resolvedDiscountAmount(
  applied: EmporixCalculatedAppliedDiscount | undefined,
  discount: EmporixCartDiscount,
): number {
  return applied?.value ?? discount.amount ?? 0;
}

/** Sole shopper coupon + one internal typed FREE_SHIPPING identity (id-less rows counted once). */
function soleInternalFreeShippingIdentity(
  sourceDiscounts: EmporixCartDiscount[],
  calculatedPrice: EmporixCart['calculatedPrice'],
): string | undefined {
  const shopper = sourceDiscounts.filter(isShopperSourceDiscount);
  if (shopper.length !== 1) {
    return undefined;
  }
  const identities = uniqueInternalFreeShippingIdentities(calculatedPrice);
  return identities.length === 1 ? identities[0] : undefined;
}

function discountMatchesFreeShippingIdentity(discount: EmporixCartDiscount, identity: string | undefined): boolean {
  if (identity === undefined || discount.code === 'TOTAL') {
    return false;
  }
  if (identity === 'idless') {
    return true;
  }
  return identity === discount.code || identity === discount.id;
}

function shouldInferZeroedFreeShipping(
  discount: EmporixCartDiscount,
  applied: EmporixCalculatedAppliedDiscount | undefined,
  shippingLevel: EmporixCalculatedAppliedDiscount[],
  shopperDiscounts: EmporixCartDiscount[],
  inferZeroedShipping: boolean,
  inferSoleIdLess: boolean,
): boolean {
  if (!inferZeroedShipping || discount.code === 'TOTAL') {
    return false;
  }
  if (matchAppliedDiscount(shippingLevel, discount, inferSoleIdLess)) {
    return true;
  }
  if (resolvedDiscountAmount(applied, discount) === 0) {
    if (shopperDiscounts.length === 1) {
      return true;
    }
    return shopperDiscounts.filter((row) => (row.amount ?? 0) === 0).length === 1;
  }
  return false;
}

function resolveMappedDiscountType(
  discount: EmporixCartDiscount,
  applied: EmporixCalculatedAppliedDiscount | undefined,
  shippingLevel: EmporixCalculatedAppliedDiscount[],
  shopperDiscounts: EmporixCartDiscount[],
  inferZeroedShipping: boolean,
  soleFreeShippingIdentity: string | undefined,
  inferSoleIdLess: boolean,
): CartAppliedDiscountType | undefined {
  const fromApplied = asCartDiscountType(applied?.discountType);
  if (fromApplied) {
    return fromApplied;
  }
  if (
    shouldInferZeroedFreeShipping(
      discount,
      applied,
      shippingLevel,
      shopperDiscounts,
      inferZeroedShipping,
      inferSoleIdLess,
    ) ||
    discountMatchesFreeShippingIdentity(discount, soleFreeShippingIdentity)
  ) {
    return 'FREE_SHIPPING';
  }
  return undefined;
}

type CartAppliedDiscountLayers = {
  aggregate: EmporixCalculatedAppliedDiscount[];
  goodsFee: EmporixCalculatedAppliedDiscount[];
  shipping: EmporixCalculatedAppliedDiscount[];
  line: EmporixCalculatedAppliedDiscount[];
};

function mapCartDiscounts(
  sourceDiscounts: EmporixCartDiscount[] | undefined,
  layers: CartAppliedDiscountLayers,
  currency: string,
  inferZeroedShipping: boolean,
  soleFreeShippingIdentity: string | undefined,
): CartAppliedDiscount[] | undefined {
  if (!sourceDiscounts || sourceDiscounts.length === 0) {
    return undefined;
  }
  const shopperDiscounts = sourceDiscounts.filter(isShopperSourceDiscount);
  const inferSoleIdLess = shopperDiscounts.length === 1;
  const mapped = sourceDiscounts.map((discount, arrayIndex) => {
    if (discount.valid === false) {
      return {
        code: discount.code,
        name: discount.name,
        discountIndex: discount.discountIndex ?? arrayIndex,
        amount: discount.amount ?? 0,
        currency: discount.currency ?? currency,
        valid: false,
      };
    }
    const applied = resolveAppliedDiscount(
      layers.aggregate,
      layers.goodsFee,
      layers.shipping,
      layers.line,
      discount,
      inferSoleIdLess,
    );
    const type = resolveMappedDiscountType(
      discount,
      applied,
      layers.shipping,
      shopperDiscounts,
      inferZeroedShipping,
      soleFreeShippingIdentity,
      inferSoleIdLess,
    );
    return {
      code: discount.code,
      name: discount.name,
      discountIndex: discount.discountIndex ?? arrayIndex,
      amount: resolvedDiscountAmount(applied, discount),
      currency: discount.currency ?? currency,
      ...(type ? { type } : {}),
    };
  });
  return mapped.length > 0 ? mapped : undefined;
}

function isInternalOrUnoriginated(row: { origin?: string }): boolean {
  return row.origin === 'INTERNAL' || row.origin === undefined;
}

function hasFreeShippingDiscount(applied: EmporixCalculatedAppliedDiscount[] | undefined): boolean {
  return (applied ?? []).some(
    (discount) => discount.discountType === 'FREE_SHIPPING' && isInternalOrUnoriginated(discount),
  );
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
      {
        aggregate: cartAggregateAppliedDiscounts(emporixCart.calculatedPrice),
        goodsFee: cartGoodsAndFeeAppliedDiscounts(emporixCart.calculatedPrice),
        shipping: shippingAppliedDiscounts(emporixCart.calculatedPrice),
        line: lineLevelAppliedDiscounts(emporixCart.items),
      },
      currency,
      isZeroedShippingWaiver(emporixCart.calculatedPrice),
      soleInternalFreeShippingIdentity(emporixCart.discounts ?? [], emporixCart.calculatedPrice),
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
    const lineCoupons = mapLineCouponDiscounts(emporixCartItem, emporixCart.currency);
    const listNet = emporixCartItem.calculatedPrice?.price?.netValue;
    const discountedNet = emporixCartItem.calculatedPrice?.discountedPrice?.netValue;
    const comparedNet =
      typeof discountedNet === 'number' ? discountedNet : emporixCartItem.calculatedPrice?.finalPrice?.netValue;
    const goodsDiscounted =
      typeof listNet === 'number' && typeof comparedNet === 'number' && listNet - comparedNet >= 0.005;
    return {
      id: emporixCartItem.id,
      quantity: emporixCartItem.quantity,
      price: {
        amount: emporixCartItem.calculatedPrice?.finalPrice.grossValue || 0,
        currency: emporixCart.currency,
      },
      ...(goodsDiscounted ? { originalNet: listNet } : {}),
      ...(lineCoupons.length > 0 ? { couponDiscounts: lineCoupons } : {}),
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
