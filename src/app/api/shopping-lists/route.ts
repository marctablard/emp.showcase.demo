import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { ShoppingListService } from '@/platform/services/shopping-list/ShoppingListService';

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? undefined;
    const shoppingListService = server.get<ShoppingListService>('ShoppingListService');
    const lists = await shoppingListService.getShoppingLists(projectId);
    return NextResponse.json(lists);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error fetching shopping lists');
    return NextResponse.json({ error: 'Failed to fetch shopping lists' }, { status: 500 });
  }
}
