import { ModifyCartItemResult } from '@/platform/services/cart/CartService';
import { Cart } from '@/platform/services/model/cart/cart';

/**
 * Fetch the current cart
 * If no cart ID is found in cookies, a new cart will be created
 * @param {boolean} [createIfNotExist=false] - Whether to create a new cart if one doesn't exist
 * @returns {Promise<Cart|null>} The cart or null if no cart exists and createIfNotExist is false
 */
export async function fetchCurrentCart(createIfNotExist: boolean = false): Promise<Cart | null | undefined> {
  const response = await fetch(`/api/cart?create=${createIfNotExist}`);

  // If we get a 204, it means no cart exists yet
  if (response.status === 204) {
    return null;
  }

  // For other error codes, throw an error
  if (!response.ok) {
    throw new Error(`Failed to fetch cart: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Fetch a cart by ID
 */
export async function fetchCartById(cartId: string): Promise<Cart> {
  const response = await fetch(`/api/cart/${cartId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch cart: ${response.statusText}`);
  }

  const cart = await response.json();
  return cart;
}

/**
 * Create a new cart
 */
export async function createCart(): Promise<Cart> {
  const response = await fetch('/api/cart', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to create cart: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Add an item to the cart
 */
export async function addItemToCart(
  cartId: string,
  productId: string,
  quantity: number,
): Promise<ModifyCartItemResult & { cart: Cart }> {
  const response = await fetch(`/api/cart/${cartId}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      productId,
      quantity,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to add item to cart: ${response.statusText}`);
  }

  const data = await response.json();
  return data as ModifyCartItemResult & { cart: Cart };
}

/**
 * Update cart item quantity
 */
export async function updateCartItemQuantity(cartId: string, itemId: string, quantity: number): Promise<void> {
  const response = await fetch(`/api/cart/${cartId}/items/${itemId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      quantity,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update cart item: ${response.statusText}`);
  }
}

/**
 * Remove an item from the cart
 */
export async function removeCartItem(cartId: string, itemId: string): Promise<void> {
  const response = await fetch(`/api/cart/${cartId}/items/${itemId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Failed to remove cart item: ${response.statusText}`);
  }
}

/**
 * Delete a cart
 */
export async function deleteCart(cartId: string): Promise<void> {
  const response = await fetch(`/api/cart/${cartId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete cart: ${response.statusText}`);
  }
}

/**
 * Update Shipping Info
 */
export async function updateShippingInfo(cartId: string, countryCode?: string, zipCode?: string): Promise<void> {
  const response = await fetch(`/api/cart/${cartId}/shipping`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      countryCode,
      zipCode,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update shipping info: ${response.statusText}`);
  }
}

/**
 * Load a saved cart
 * @param {string} cartId - The ID of the saved cart to load
 * @param {string} type - The type of the cart to load
 * @returns {Promise<Cart>} The loaded cart
 */
export async function loadSavedCart(cartId: string, type: string = 'shopping'): Promise<Cart> {
  const response = await fetch(`/api/cart/load`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cartId,
      type,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to load saved cart: ${response.statusText}`);
  }

  return await response.json();
}
