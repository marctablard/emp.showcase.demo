'use server';

import { cache } from 'react';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Order } from '@/platform/services/model/order/order';
import type { OrderPageResponse, OrderService } from '@/platform/services/order/OrderService';
import ssr from '@/platform/ssr';

/**
 * Get the order service instance from the platform container
 */
const getOrderService = () => ssr.get<OrderService>('OrderService');
const getLogger = () => ssr.get<LoggerService>('LoggerService');

/**
 * Get a specific order by ID
 * This function is cached to prevent multiple order fetches in a single request
 */
export const getOrderById = cache(async (orderId: string): Promise<Order | null | undefined> => {
  try {
    const orderService = getOrderService();
    return await orderService.getCustomerOrderById(orderId);
  } catch (error) {
    getLogger().error(
      { error: error instanceof Error ? error.message : String(error), orderId },
      'SSR getOrderById failed',
    );
    return undefined;
  }
});

/**
 * Get all orders for the current customer with optional pagination
 * This function is cached to prevent multiple order fetches in a single request
 */
export const getOrders = cache(async (pageSize?: number, pageNumber?: number): Promise<Order[] | undefined> => {
  const page = await getOrdersPage(pageSize, pageNumber);
  return page?.items;
});

export const getOrdersPage = cache(
  async (
    pageSize?: number,
    pageNumber?: number,
    sort?: string,
    query?: string,
  ): Promise<OrderPageResponse | undefined> => {
    try {
      const orderService = getOrderService();
      const page = await orderService.getCustomerOrdersPage(pageSize, pageNumber, sort, query);
      return page;
    } catch (error) {
      getLogger().error(
        { error: error instanceof Error ? error.message : String(error), pageSize, pageNumber, sort, query },
        'SSR getOrdersPage failed',
      );
      return undefined;
    }
  },
);

/**
 * Get available status transitions for an order
 * This function is cached to prevent multiple API fetches in a single request
 */
export const getOrderStatusTransitions = cache(async (orderId: string): Promise<string[] | undefined> => {
  try {
    const orderService = getOrderService();
    const statusTransitions = await orderService.getOrderStatusTransitions(orderId);
    return statusTransitions;
  } catch (error) {
    getLogger().error(
      { error: error instanceof Error ? error.message : String(error), orderId },
      'SSR getOrderStatusTransitions failed',
    );
    return undefined;
  }
});
