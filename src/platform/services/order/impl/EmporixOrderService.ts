import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixOrder } from '@/platform/integrations/emporix/model/order';
import type { EmporixOrderApi } from '@/platform/integrations/emporix/order/EmporixOrderApi';
import type { Order } from '@/platform/services/model/order/order';
import type { OrderPageResponse, OrderService } from '@/platform/services/order/OrderService';
import type { SessionService } from '@/platform/services/session/SessionService';
import type { OrderMapper } from '../../model/order/OrderMapper';

function wrapOrderError(message: string, error: Error): Error & { upstreamStatus?: number } {
  const wrappedError = new Error(message) as Error & { upstreamStatus?: number };
  const upstreamStatus = (error as Error & { upstreamStatus?: number }).upstreamStatus;

  if (typeof upstreamStatus === 'number') {
    wrappedError.upstreamStatus = upstreamStatus;
  }

  return wrappedError;
}

/**
 * Implementation of OrderService for Emporix order data.
 * Maps between Emporix API order format and internal Order model.
 */
@injectable('OrderService', 'Singleton')
class EmporixOrderService implements OrderService {
  private readonly orderApi: EmporixOrderApi;
  private readonly mapper: OrderMapper<EmporixOrder>;
  private readonly sessionService: SessionService;

  constructor(
    @inject('EmporixOrderApi') orderApi: EmporixOrderApi,
    @inject('EmporixOrderMapper') mapper: OrderMapper<EmporixOrder>,
    @inject('SessionService') sessionService: SessionService,
  ) {
    this.orderApi = orderApi;
    this.mapper = mapper;
    this.sessionService = sessionService;
  }

  async createOrder(cartId: string, customerEmail?: string, customerNote?: string): Promise<string> {
    const session = await this.sessionService.getCurrent();
    if (!session) {
      throw new Error('Failed to get session context');
    }

    const createOrderRequest = {
      cartId,
      customerEmail,
      customerNote,
    };

    try {
      const response = await this.orderApi.createOrder(createOrderRequest);
      return response.orderId;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create order: ${error.message}`);
      }
      throw error;
    }
  }

  async getCustomerOrderById(orderId: string): Promise<Order | null> {
    try {
      const order = await this.orderApi.getCustomerOrder(orderId);
      return order ? this.mapper.mapToService(order) : null;
    } catch (error) {
      if (error instanceof Error) {
        throw wrapOrderError(`Failed to get order: ${error.message}`, error);
      }
      throw error;
    }
  }

  async getOrderById(orderId: string): Promise<Order | null> {
    try {
      const order = await this.orderApi.getOrder(orderId);
      return order ? this.mapper.mapToService(order) : null;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get order: ${error.message}`);
      }
      throw error;
    }
  }

  async getCustomerOrders(pageSize?: number, pageNumber?: number, sort?: string, query?: string): Promise<Order[]> {
    const page = await this.getCustomerOrdersPage(pageSize, pageNumber, sort, query);
    return page.items;
  }

  async getCustomerOrdersPage(
    pageSize?: number,
    pageNumber?: number,
    sort?: string,
    query?: string,
  ): Promise<OrderPageResponse> {
    try {
      const response = await this.orderApi.getCustomerOrdersPage(pageSize, pageNumber, sort, query);
      return {
        items: response.items.map((order) => this.mapper.mapToService(order)),
        totalCount: response.totalCount,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get orders: ${error.message}`);
      }
      throw error;
    }
  }

  async getOrders(pageSize?: number, pageNumber?: number): Promise<Order[]> {
    try {
      const orders = await this.orderApi.getOrders(pageSize, pageNumber);
      return orders.map((order) => this.mapper.mapToService(order));
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get orders: ${error.message}`);
      }
      throw error;
    }
  }

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    try {
      await this.orderApi.updateOrder(orderId, { status: status as any });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update order status: ${error.message}`);
      }
      throw error;
    }
  }

  async getCustomerOrderStatusTransitions(orderId: string): Promise<string[]> {
    try {
      return await this.orderApi.getCustomerOrderStatusTransitions(orderId);
    } catch (error) {
      if (error instanceof Error) {
        throw wrapOrderError(`Failed to get order status transitions: ${error.message}`, error);
      }
      throw error;
    }
  }

  async applyCustomerOrderTransition(orderId: string, status: string): Promise<void> {
    if (status !== 'DECLINED') {
      throw new Error(`Unsupported customer order transition: status=${String(status)}`);
    }
    try {
      await this.orderApi.postCustomerOrderTransition(orderId, { status });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to apply customer order transition: ${error.message}`);
      }
      throw error;
    }
  }

  async getOrderStatusTransitions(orderId: string): Promise<string[]> {
    try {
      return await this.orderApi.getOrderStatusTransitions(orderId);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get order status transitions: ${error.message}`);
      }
      throw error;
    }
  }

  async createOrderFromQuote(quoteId: string, customerNote?: string): Promise<string> {
    const session = await this.sessionService.getCurrent();
    if (!session) {
      throw new Error('Failed to get session context');
    }

    const createOrderRequest = {
      quoteId,
      customerNote,
    };

    try {
      const response = await this.orderApi.createOrder(createOrderRequest);
      return response.orderId;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create order from quote: ${error.message}`);
      }
      throw error;
    }
  }
}

export default EmporixOrderService;
