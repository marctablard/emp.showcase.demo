import { cache } from 'react';
import { CartService } from '@/platform/services/cart';
import { Cart } from '@/platform/services/model/cart/cart';
import ssr from '@/platform/ssr';

/**
 * Get the cart service instance from the platform container
 */
const getCartService = () => ssr.get<CartService>('CartService');

const getCart = cache(async (): Promise<Cart | null | undefined> => {
  try {
    const cart = await getCartService().getCart();
    return cart;
  } catch (_error) {
    // on SSR we fail with undefined, so the Client can refetch if necessary
    return undefined;
  }
});

/**
 * Get the current cart
 * This should be used in server components to get the current cart
 */
export async function getCurrentCart(): Promise<Cart | null | undefined> {
  return getCart();
}
