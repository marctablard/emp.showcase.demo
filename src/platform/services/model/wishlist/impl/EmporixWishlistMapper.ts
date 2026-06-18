import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCart, EmporixCartItem } from '@/platform/integrations/emporix/model/cart';
import { DEFAULT_WISHLIST_NAME, WISHLIST_CART_TYPE } from '@/platform/services/wishlist/constants';
import type { WishlistMapper } from '../WishlistMapper';
import type { Wishlist, WishlistItem } from '../wishlist';

/**
 * Maps between the Emporix Cart model (type = wishlist) and the service Wishlist model.
 */
@injectable('EmporixWishlistMapper', 'Singleton')
export class EmporixWishlistMapper implements WishlistMapper<EmporixCart, EmporixCartItem> {
  mapToService(cart: EmporixCart): Wishlist {
    const items = (cart.items ?? []).map((item) => this.mapWishlistItemToService(cart, item));
    const totalQuantity = cart.totalUnitsCount ?? items.reduce((sum, item) => sum + item.quantity, 0);

    const cartGross = cart.calculatedPrice?.finalPrice?.grossValue;
    const cartNet = cart.calculatedPrice?.finalPrice?.netValue;
    const totalKnownPrice =
      typeof cartGross === 'number' && typeof cartNet === 'number'
        ? {
            gross: { amount: cartGross, currency: cart.currency },
            net: { amount: cartNet, currency: cart.currency },
          }
        : undefined;

    return {
      id: cart.id,
      name: DEFAULT_WISHLIST_NAME,
      type: cart.type ?? WISHLIST_CART_TYPE,
      currency: cart.currency,
      siteCode: cart.siteCode,
      items,
      totalQuantity,
      totalKnownPrice,
    };
  }

  mapWishlistItemToService(cart: EmporixCart, item: EmporixCartItem): WishlistItem {
    const gross = item.calculatedPrice?.finalPrice?.grossValue;
    const net = item.calculatedPrice?.finalPrice?.netValue;
    const hasCurrentPrice = typeof gross === 'number' && typeof net === 'number';

    return {
      id: item.id,
      quantity: item.quantity,
      productId: item.product?.id ?? '',
      sku: item.product?.sku,
      name: item.product?.localizedName ?? item.product?.name,
      imageUrl: item.product?.images?.[0]?.url,
      price: hasCurrentPrice
        ? {
            gross: { amount: gross, currency: cart.currency },
            net: { amount: net, currency: cart.currency },
          }
        : undefined,
      isPurchasable: true,
      hasCurrentPrice,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mapToSource(wishlist: Wishlist): EmporixCart {
    throw new Error('Not implemented');
  }
}

export default EmporixWishlistMapper;
