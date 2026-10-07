import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { normalizeReasonCode, normalizeReasonDetails } from '@/lib/common/returns/reason-normalization';
import { mapReturnCreateError, mapReturnValidationError } from '@/lib/common/returns/return-api-error-mapping';
import { RETURN_ERROR_CODE } from '@/lib/common/returns/return-error-codes';
import { computeOrderReturnability } from '@/lib/common/returns/returnability';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
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

    const returnService = server.get<ReturnService>('ReturnService');
    const { items: returns, totalCount } = await returnService.listReturns(pageNumber, pageSize, sort, query);

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
    return NextResponse.json(
      { error: 'Failed to fetch returns', code: RETURN_ERROR_CODE.RETURNS_FETCH_FAILED },
      { status: 500 },
    );
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
      return NextResponse.json(
        { error: 'orderId is required and must be a string', code: RETURN_ERROR_CODE.ORDER_ID_REQUIRED },
        { status: 400 },
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'items array is required and cannot be empty', code: RETURN_ERROR_CODE.ITEMS_REQUIRED },
        { status: 400 },
      );
    }

    if (!normalizedReasonCode) {
      return NextResponse.json(
        { error: 'reasonCode is required and must be a string', code: RETURN_ERROR_CODE.REASON_CODE_REQUIRED },
        { status: 400 },
      );
    }
    if (!RETURN_REASON_CODES.has(normalizedReasonCode)) {
      return NextResponse.json(
        { error: 'reasonCode is invalid', code: RETURN_ERROR_CODE.REASON_CODE_INVALID },
        { status: 400 },
      );
    }
    if (reasonDetails !== undefined && typeof reasonDetails !== 'string') {
      return NextResponse.json(
        { error: 'reasonDetails must be a string if provided', code: RETURN_ERROR_CODE.REASON_DETAILS_INVALID },
        { status: 400 },
      );
    }

    for (const item of items) {
      if (!item.id || typeof item.id !== 'string') {
        return NextResponse.json(
          { error: 'Each item must have a valid id', code: RETURN_ERROR_CODE.ITEM_ID_INVALID },
          { status: 400 },
        );
      }
      if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        return NextResponse.json(
          { error: 'Each item must have a positive integer quantity', code: RETURN_ERROR_CODE.ITEM_QUANTITY_INVALID },
          { status: 400 },
        );
      }
      if (item.reasonCode !== undefined && typeof item.reasonCode !== 'string') {
        return NextResponse.json(
          {
            error: 'item.reasonCode must be a string if provided',
            code: RETURN_ERROR_CODE.ITEM_REASON_CODE_TYPE_INVALID,
          },
          { status: 400 },
        );
      }
      const normalizedItemReasonCode = normalizeReasonCode(item.reasonCode);
      if (normalizedItemReasonCode && !RETURN_REASON_CODES.has(normalizedItemReasonCode)) {
        return NextResponse.json(
          {
            error: `item.reasonCode is invalid for item ${item.id}`,
            code: RETURN_ERROR_CODE.ITEM_REASON_CODE_INVALID,
          },
          { status: 400 },
        );
      }
      if (item.reasonDetails !== undefined && typeof item.reasonDetails !== 'string') {
        return NextResponse.json(
          {
            error: 'item.reasonDetails must be a string if provided',
            code: RETURN_ERROR_CODE.ITEM_REASON_DETAILS_INVALID,
          },
          { status: 400 },
        );
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
        // The shopper only ever sees the article number, never the order-entry id. Same chain as
        // the item selector; productId is mandatory, so this never falls through to the id.
        const skuByItemId = new Map(order.items.map((item) => [item.id, item.sku || item.productId]));

        for (const item of items) {
          const remaining = remainingMap.get(item.id);
          if (remaining === undefined) {
            return NextResponse.json(
              {
                error: `Item ${item.id} does not belong to order ${orderId}`,
                code: RETURN_ERROR_CODE.ITEM_NOT_IN_ORDER,
              },
              { status: 422 },
            );
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
                code: RETURN_ERROR_CODE.ITEM_EXCEEDS_RETURNABLE_QUANTITY,
                params: { sku: skuByItemId.get(item.id), requested: item.quantity, remaining },
              },
              { status: 422 },
            );
          }
        }
      }
    } catch (validationError) {
      const logger = server.get<LoggerService>('LoggerService');
      const mappedError = mapReturnValidationError(validationError);
      logger.error(
        {
          error: validationError instanceof Error ? validationError.message : String(validationError),
          orderId,
          ...mappedError.logContext,
        },
        'Returnability validation failed',
      );
      return NextResponse.json(mappedError.response, { status: mappedError.status });
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
    const mappedError = mapReturnCreateError(error);
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/returns',
        method: 'POST',
        ...mappedError.logContext,
      },
      'Error creating return',
    );
    return NextResponse.json(mappedError.response, { status: mappedError.status });
  }
}
