import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CartService } from '@/platform/services/cart';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

/**
 * PATCH /api/carts/[id]/items/[itemId]
 * Update the quantity of an item in the cart
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const cartService = server.get<CartService>('CartService');
    const resolvedParams = await params;
    const { id: cartId, itemId } = resolvedParams;

    // Get request body
    const body = await request.json();
    const { quantity } = body;

    if (typeof quantity !== 'number' || quantity < 0) {
      return NextResponse.json({ error: 'Valid quantity is required' }, { status: 400 });
    }

    // Update item quantity
    await cartService.updateCartItemQuantity(cartId, itemId, quantity);

    // Get updated cart
    const updatedCart = await cartService.getCartById(cartId);

    return NextResponse.json(updatedCart);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    const errorParams = await params.catch(() => ({ id: 'unknown', itemId: 'unknown' }));
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/cart/${errorParams.id}/items/${errorParams.itemId}`,
        method: 'PATCH',
        cartId: errorParams.id,
        itemId: errorParams.itemId,
      },
      `Error updating item ${errorParams.itemId} in cart ${errorParams.id}`,
    );
    return NextResponse.json({ error: 'Failed to update cart item' }, { status: 500 });
  }
}

/**
 * DELETE /api/carts/[id]/items/[itemId]
 * Remove an item from the cart
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const cartService = server.get<CartService>('CartService');
    const resolvedParams = await params;
    const { id: cartId, itemId } = resolvedParams;

    // Remove item from cart
    await cartService.removeCartItem(cartId, itemId);

    // Get updated cart
    const updatedCart = await cartService.getCartById(cartId);

    return NextResponse.json(updatedCart);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    const errorParams = await params.catch(() => ({ id: 'unknown', itemId: 'unknown' }));
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/cart/${errorParams.id}/items/${errorParams.itemId}`,
        method: 'DELETE',
        cartId: errorParams.id,
        itemId: errorParams.itemId,
      },
      `Error removing item ${errorParams.itemId} from cart ${errorParams.id}`,
    );
    return NextResponse.json({ error: 'Failed to remove cart item' }, { status: 500 });
  }
}
