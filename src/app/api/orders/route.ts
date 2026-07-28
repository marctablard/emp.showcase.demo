import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { OrderService } from '@/platform/services/order/OrderService';

const DEFAULT_PAGE_NUMBER = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 60;

class OrdersQueryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrdersQueryValidationError';
  }
}

function parseBoundedPositiveInt(value: string | null, name: string, min: number, max?: number): number | undefined {
  if (value === null) {
    return undefined;
  }

  if (!/^\d+$/.test(value)) {
    throw new OrdersQueryValidationError(`${name} must be a base-10 positive integer`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new OrdersQueryValidationError(`${name} must be a safe integer`);
  }
  if (parsed < min) {
    throw new OrdersQueryValidationError(`${name} must be >= ${min}`);
  }
  if (max !== undefined && parsed > max) {
    throw new OrdersQueryValidationError(`${name} must be <= ${max}`);
  }

  return parsed;
}

/**
 * GET /api/orders
 * Get all orders for the current customer
 */
export async function GET(request: NextRequest) {
  try {
    const orderService = server.get<OrderService>('OrderService');

    // Get query parameters for pagination, sorting, and search
    const searchParams = request.nextUrl.searchParams;
    const pageSize =
      parseBoundedPositiveInt(searchParams.get('pageSize'), 'pageSize', 1, MAX_PAGE_SIZE) ?? DEFAULT_PAGE_SIZE;
    const pageNumber = parseBoundedPositiveInt(searchParams.get('pageNumber'), 'pageNumber', 1) ?? DEFAULT_PAGE_NUMBER;
    const sort = searchParams.get('sort')?.trim() || undefined;
    const q = searchParams.get('q')?.trim() || searchParams.get('query')?.trim() || undefined;

    const { items: orders, totalCount } = await orderService.getCustomerOrdersPage(pageSize, pageNumber, sort, q);

    if (totalCount === undefined) {
      return NextResponse.json(orders);
    }

    return NextResponse.json(orders, {
      headers: { 'x-total-count': String(totalCount) },
    });
  } catch (error) {
    if (error instanceof OrdersQueryValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/orders',
        method: 'GET',
      },
      'Error fetching orders',
    );
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
