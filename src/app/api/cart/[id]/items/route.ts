import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { CartService } from '@/platform/services/cart';

/**
 * GET /api/carts/[id]/items
 * Get all items in a cart
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const cartId = resolvedParams.id;

  try {
    const cartService = server.get<CartService>('CartService');
    const cart = await cartService.getCartById(cartId);

    if (!cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }

    return NextResponse.json(cart.items);
  } catch (error) {
    console.error(`Error fetching cart items for ${cartId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch cart items' }, { status: 500 });
  }
}

/**
 * POST /api/carts/[id]/items
 * Add an item to the cart
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const cartId = resolvedParams.id;
  try {
    const cartService = server.get<CartService>('CartService');

    // Get request body
    const body = await request.json();
    const { productId, quantity } = body;

    if (!productId || !quantity) {
      return NextResponse.json({ error: 'Product ID and quantity are required' }, { status: 400 });
    }

    // Add item to cart
    const result = await cartService.addItemToCart(cartId, productId, quantity);

    // Get updated cart
    const updatedCart = await cartService.getCartById(cartId);

    return NextResponse.json({
      ...result,
      cart: updatedCart,
    });
  } catch (error) {
    console.error(`Error adding item to cart ${cartId}:`, error);
    return NextResponse.json({ error: 'Failed to add item to cart' }, { status: 500 });
  }
}
