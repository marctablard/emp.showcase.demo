import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { ShoppingListService } from '@/platform/services/shopping-list/ShoppingListService';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const shoppingListService = server.get<ShoppingListService>('ShoppingListService');
    const lists = await shoppingListService.getShoppingLists(projectId);
    return NextResponse.json(lists);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error fetching shopping lists');
    return NextResponse.json({ error: 'Failed to fetch shopping lists' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const shoppingListService = server.get<ShoppingListService>('ShoppingListService');
    const body = await request.json();
    const list = await shoppingListService.createShoppingList(body.name, projectId);
    return NextResponse.json(list, { status: 201 });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error creating shopping list');
    return NextResponse.json({ error: 'Failed to create shopping list' }, { status: 500 });
  }
}
