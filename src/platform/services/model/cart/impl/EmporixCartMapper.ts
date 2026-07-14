import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCart, EmporixCartItem } from '@/platform/integrations/emporix/model/cart';
import type { Tax } from '../../common';
import type { CartMapper } from '../CartMapper';
import type { Cart, Cart as ServiceCart, CartItem as ServiceCartItem } from '../cart';

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
    let totalPrice;
    if (emporixCart.calculatedPrice?.finalPrice) {
      totalPrice = {
        amount: emporixCart.calculatedPrice.finalPrice.grossValue,
        currency: emporixCart.currency,
      };
    } else {
      totalPrice = {
        amount: 0,
        currency: emporixCart.currency,
      };
    }
    let subTotalPrice;
    if (emporixCart.calculatedPrice?.price) {
      subTotalPrice = {
        amount: emporixCart.calculatedPrice.price.grossValue,
        currency: emporixCart.currency,
      };
    } else {
      subTotalPrice = {
        amount: 0,
        currency: emporixCart.currency,
      };
    }
    let tax;
    const hasDiscount = (emporixCart.calculatedPrice?.totalDiscount?.value ?? 0) > 0;
    const taxPriceSource =
      hasDiscount && emporixCart.calculatedPrice?.discountedPrice
        ? emporixCart.calculatedPrice.discountedPrice
        : emporixCart.calculatedPrice?.price;
    if (taxPriceSource) {
      tax = {
        amount: taxPriceSource.taxValue,
        currency: emporixCart.currency,
        netValue: taxPriceSource.netValue,
        grossValue: taxPriceSource.grossValue,
      };
    } else {
      tax = {
        amount: 0,
        currency: emporixCart.currency,
        netValue: 0,
        grossValue: 0,
      };
    }

    let shippingCosts;
    if (emporixCart.calculatedPrice?.totalShipping) {
      shippingCosts = {
        amount: emporixCart.calculatedPrice.totalShipping.grossValue,
        currency: emporixCart.currency,
      };
    } else {
      shippingCosts = undefined;
    }
    let fees;
    if (emporixCart.calculatedPrice?.totalFee) {
      fees = {
        amount: emporixCart.calculatedPrice.totalFee.grossValue,
        currency: emporixCart.currency,
      };
    } else {
      fees = undefined;
    }

    let totalDiscount;
    if (emporixCart.calculatedPrice?.totalDiscount?.value) {
      totalDiscount = {
        amount: emporixCart.calculatedPrice.totalDiscount.value,
        currency: emporixCart.currency,
      };
    } else {
      totalDiscount = undefined;
    }

    const appliedDiscountValues = new Map(
      emporixCart.calculatedPrice?.totalDiscount?.appliedDiscounts?.map((discount) => [discount.id, discount.value]) ??
        [],
    );

    const discounts =
      emporixCart.discounts?.map((discount) => ({
        code: discount.code,
        name: discount.name,
        value:
          discount.amount ??
          appliedDiscountValues.get(discount.code) ??
          appliedDiscountValues.get(discount.id ?? '') ??
          0,
        currency: discount.currency ?? emporixCart.currency,
        discountType: discount.discountType,
        discountRate: discount.discountRate,
      })) ?? undefined;

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
      totalDiscount: totalDiscount,
      discounts: discounts,
      totalPrice: totalPrice,
      subTotalPrice: subTotalPrice,
      tax: tax,
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
