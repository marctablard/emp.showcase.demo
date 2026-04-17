import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { normalizeReasonCode, normalizeReasonDetails } from '@/lib/common/returns/reason-normalization';
import { computeOrderReturnability } from '@/lib/common/returns/returnability';
import type { EmporixReturnApi } from '@/platform/integrations/emporix/return/EmporixReturnApi';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { EmporixReturnMapper } from '@/platform/services/model/return/impl/EmporixReturnMapper';
import type { OrderService } from '@/platform/services/order/OrderService';
import type { ReturnService } from '@/platform/services/return/ReturnService';

export const revalidate = 0;

const RETURN_REASON_CODES = new Set([
  'DEFECTIVE',
  'WRONG_ITEM',
  'NOT_AS_DESCRIBED',
  'CHANGED_MIND',
  'SIZE_FIT',
  'OTHER',
]);

/**
 * GET /api/returns
 * Get all returns for the current customer with optional pagination, sorting, and filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageNumber = searchParams.get('pageNumber') ? parseInt(searchParams.get('pageNumber')!) : 1;
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 60;
    const sort = searchParams.get('sort') || undefined;
    const query = searchParams.get('query') || undefined;

    const returnApi = server.get<EmporixReturnApi>('EmporixReturnApi');
    const returnMapper = server.get<EmporixReturnMapper>('EmporixReturnMapper');
    const { items, totalCount } = await returnApi.getReturns(pageNumber, pageSize, sort, query);
    const returns = items.map((returnItem) => returnMapper.mapToService(returnItem));

    return NextResponse.json(returns, {
      headers: totalCount !== undefined ? { 'x-total-count': String(totalCount) } : undefined,
    });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/returns',
        method: 'GET',
      },
      'Error fetching returns',
    );
    return NextResponse.json({ error: 'Failed to fetch returns' }, { status: 500 });
  }
}

/**
 * POST /api/returns
 * Create a new return for an order
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, items, reasonCode, reasonDetails } = body;
    const normalizedReasonCode = normalizeReasonCode(reasonCode);
    const normalizedReasonDetails = normalizeReasonDetails(reasonDetails);

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'orderId is required and must be a string' }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items array is required and cannot be empty' }, { status: 400 });
    }

    if (!normalizedReasonCode) {
      return NextResponse.json({ error: 'reasonCode is required and must be a string' }, { status: 400 });
    }
    if (!RETURN_REASON_CODES.has(normalizedReasonCode)) {
      return NextResponse.json({ error: 'reasonCode is invalid' }, { status: 400 });
    }
    if (reasonDetails !== undefined && typeof reasonDetails !== 'string') {
      return NextResponse.json({ error: 'reasonDetails must be a string if provided' }, { status: 400 });
    }

    for (const item of items) {
      if (!item.id || typeof item.id !== 'string') {
        return NextResponse.json({ error: 'Each item must have a valid id' }, { status: 400 });
      }
      if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        return NextResponse.json({ error: 'Each item must have a positive integer quantity' }, { status: 400 });
      }
      if (item.reasonCode !== undefined && typeof item.reasonCode !== 'string') {
        return NextResponse.json({ error: 'item.reasonCode must be a string if provided' }, { status: 400 });
      }
      const normalizedItemReasonCode = normalizeReasonCode(item.reasonCode);
      if (normalizedItemReasonCode && !RETURN_REASON_CODES.has(normalizedItemReasonCode)) {
        return NextResponse.json({ error: `item.reasonCode is invalid for item ${item.id}` }, { status: 400 });
      }
      if (item.reasonDetails !== undefined && typeof item.reasonDetails !== 'string') {
        return NextResponse.json({ error: 'item.reasonDetails must be a string if provided' }, { status: 400 });
      }
    }

    const returnService = server.get<ReturnService>('ReturnService');

    try {
      const orderService = server.get<OrderService>('OrderService');
      const [order, orderReturns] = await Promise.all([
        orderService.getCustomerOrderById(orderId),
        returnService.getReturns(undefined, undefined, undefined, `orders._id:${orderId}`),
      ]);

      if (order) {
        const returnability = computeOrderReturnability(orderId, order.items, orderReturns);

        const remainingMap = new Map(returnability.orderItemSummaries.map((s) => [s.itemId, s.remaining]));

        for (const item of items) {
          const remaining = remainingMap.get(item.id);
          if (remaining === undefined) {
            return NextResponse.json({ error: `Item ${item.id} does not belong to order ${orderId}` }, { status: 422 });
          }
          if (item.quantity > remaining) {
            const logger = server.get<LoggerService>('LoggerService');
            logger.warn(
              { orderId, itemId: item.id, requested: item.quantity, remaining },
              'Over-return attempt blocked',
            );
            return NextResponse.json(
              {
                error: `Item ${item.id} exceeds returnable quantity (requested: ${item.quantity}, remaining: ${remaining})`,
              },
              { status: 422 },
            );
          }
        }
      }
    } catch (validationError) {
      const logger = server.get<LoggerService>('LoggerService');
      logger.error(
        { error: validationError instanceof Error ? validationError.message : String(validationError), orderId },
        'Returnability validation failed',
      );
      return NextResponse.json({ error: 'Failed to validate return request' }, { status: 503 });
    }

    const normalizedItems = items.map((item) => {
      const normalizedItemReasonCode = normalizeReasonCode(item.reasonCode);
      const normalizedItemReasonDetails = normalizeReasonDetails(item.reasonDetails);

      return {
        id: item.id,
        quantity: item.quantity,
        reason: normalizedItemReasonCode
          ? {
              code: normalizedItemReasonCode,
              details: normalizedItemReasonDetails,
            }
          : undefined,
      };
    });

    const returnId = await returnService.createReturn(
      orderId,
      normalizedItems,
      normalizedReasonCode,
      normalizedReasonDetails,
    );

    return NextResponse.json({ id: returnId }, { status: 201 });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/returns',
        method: 'POST',
      },
      'Error creating return',
    );
    return NextResponse.json({ error: 'Failed to create return' }, { status: 500 });
  }
}
