'use server';

import { cache } from 'react';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Return, ReturnItem } from '@/platform/services/model/return';
import type { OrderService } from '@/platform/services/order/OrderService';
import type { ReturnService } from '@/platform/services/return/ReturnService';
import ssr from '@/platform/ssr';

/**
 * Get the return service instance from the platform container
 */
const getReturnService = () => ssr.get<ReturnService>('ReturnService');
const getLogger = () => ssr.get<LoggerService>('LoggerService');

/**
 * Enriches return items with product metadata from original order data.
 */
async function enrichReturnWithOrderData(returnData: Return): Promise<Return> {
  const orderIds = returnData.orders.map((o) => o.id);
  if (orderIds.length === 0) return returnData;

  try {
    const orderService = ssr.get<OrderService>('OrderService');
    const orders = await Promise.all(orderIds.map((id) => orderService.getCustomerOrderById(id)));

    const orderItemMap = new Map<
      string,
      {
        productId: string;
        images?: string[];
        sku?: string;
        netUnitValue?: number;
        originalNetUnitValue?: number;
        grossValue?: number;
        currency?: string;
        vendorName?: string;
      }
    >();
    for (const order of orders) {
      if (!order) continue;
      for (const item of order.items) {
        orderItemMap.set(`${order.id}:${item.id}`, {
          productId: item.productId,
          images: item.images,
          sku: item.sku,
          netUnitValue: item.price?.netValue ?? item.price?.value,
          originalNetUnitValue: item.price?.originalValue,
          grossValue: item.price?.grossValue,
          currency: item.price?.currency,
          vendorName: item.vendorName,
        });
      }
    }

    const enrichedOrders = returnData.orders.map((returnOrder) => ({
      ...returnOrder,
      items: returnOrder.items.map((item): ReturnItem => {
        const orderItem = orderItemMap.get(`${returnOrder.id}:${item.id}`);
        if (!orderItem) return item;
        return {
          ...item,
          productId: item.productId ?? orderItem.productId,
          images: item.images ?? orderItem.images,
          itemNumber: item.itemNumber ?? orderItem.sku,
          brand: item.brand ?? orderItem.vendorName,
          vendorName: orderItem.vendorName,
          calculatedUnitPrice:
            item.calculatedUnitPrice && !item.calculatedUnitPrice.currency && orderItem.currency
              ? { ...item.calculatedUnitPrice, currency: orderItem.currency }
              : item.calculatedUnitPrice,
          calculatedPrice:
            item.calculatedPrice && !item.calculatedPrice.finalPrice.currency && orderItem.currency
              ? {
                  ...item.calculatedPrice,
                  finalPrice: { ...item.calculatedPrice.finalPrice, currency: orderItem.currency },
                }
              : item.calculatedPrice,
          grossUnitPrice:
            item.grossUnitPrice ??
            (orderItem.grossValue !== undefined && orderItem.currency
              ? { value: orderItem.grossValue, currency: orderItem.currency }
              : undefined),
          netPrice:
            item.netPrice ??
            (orderItem.netUnitValue !== undefined && orderItem.currency
              ? { value: orderItem.netUnitValue, currency: orderItem.currency }
              : orderItem.originalNetUnitValue !== undefined && orderItem.currency
                ? { value: orderItem.originalNetUnitValue, currency: orderItem.currency }
                : undefined),
        };
      }),
    }));

    return { ...returnData, orders: enrichedOrders };
  } catch {
    return returnData;
  }
}

/**
 * Get a specific return by ID
 * This function is cached to prevent multiple return fetches in a single request
 */
export const getReturnById = cache(async (returnId: string): Promise<Return | null | undefined> => {
  try {
    const returnService = getReturnService();
    const returnItem = await returnService.getReturn(returnId);
    if (!returnItem) return null;
    return await enrichReturnWithOrderData(returnItem);
  } catch (error) {
    getLogger().error(
      { error: error instanceof Error ? error.message : String(error), returnId },
      'SSR getReturnById failed',
    );
    return undefined;
  }
});

/**
 * Get all returns for the current customer with optional pagination
 * This function is cached to prevent multiple return fetches in a single request
 */
export const getReturns = cache(async (pageNumber?: number, pageSize?: number): Promise<Return[] | undefined> => {
  try {
    const returnService = getReturnService();
    const returns = await returnService.getReturns(pageNumber, pageSize);
    return returns;
  } catch (error) {
    getLogger().error(
      { error: error instanceof Error ? error.message : String(error), pageNumber, pageSize },
      'SSR getReturns failed',
    );
    return undefined;
  }
});
