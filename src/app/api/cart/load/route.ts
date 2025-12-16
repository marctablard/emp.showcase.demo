import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { CartService } from '@/platform/services/cart/CartService';

export const revalidate = 0;

/**
 * POST /api/cart/load
 * Load a saved cart
 */
export async function POST(request: NextRequest) {
  try {
    const cartService = server.get<CartService>('CartService');

    // Get request body with the cart ID to load
    const body = await request.json();
    const { cartId, type } = body;

    if (!cartId) {
      return NextResponse.json({ error: 'Cart ID is required' }, { status: 400 });
    }

    // Load the saved cart
    await cartService.loadCart(cartId, type);

    // Get the current cart after loading
    const cart = await cartService.getCart();

    if (!cart) {
      return NextResponse.json({ error: 'Failed to load cart' }, { status: 500 });
    }

    return NextResponse.json(cart);
  } catch (error) {
    console.error('Error loading saved cart:', error);
    return NextResponse.json({ error: 'Failed to load saved cart' }, { status: 500 });
  }
}
