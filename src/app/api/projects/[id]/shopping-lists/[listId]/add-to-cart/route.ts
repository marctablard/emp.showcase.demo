import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CartService } from '@/platform/services/cart/CartService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { ShoppingListService } from '@/platform/services/shopping-list/ShoppingListService';

/**
 * POST /api/projects/[id]/shopping-lists/[listId]/add-to-cart
 * Body: { cartId: string, itemId?: string }
 * If itemId is provided → add only that item. Otherwise → add all items.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; listId: string }> }) {
  try {
    const { listId } = await params;
    const body = await request.json();
    const { cartId, itemId } = body;

    if (!cartId) {
      return NextResponse.json({ error: 'cartId is required' }, { status: 400 });
    }

    const shoppingListService = server.get<ShoppingListService>('ShoppingListService');
    const cartService = server.get<CartService>('CartService');

    const list = await shoppingListService.getShoppingList(listId);
    if (!list) return NextResponse.json({ error: 'Shopping list not found' }, { status: 404 });

    const itemsToAdd = itemId ? list.items.filter((i) => i.id === itemId) : list.items;

    const results = await Promise.allSettled(
      itemsToAdd.map((item) => cartService.addItemToCart(cartId, item.productId, item.quantity)),
    );

    const failures = results.map((r, idx) => ({ r, item: itemsToAdd[idx] })).filter(({ r }) => r.status === 'rejected');

    if (failures.length > 0) {
      const logger = server.get<LoggerService>('LoggerService');
      failures.forEach(({ r, item }) => {
        logger.warn({ item, reason: (r as PromiseRejectedResult).reason }, 'Failed to add item to cart');
      });
    }

    return NextResponse.json({ added: itemsToAdd.length - failures.length, failed: failures.length });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Error adding shopping list to cart',
    );
    return NextResponse.json({ error: 'Failed to add items to cart' }, { status: 500 });
  }
}
