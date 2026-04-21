import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import { createFetchMetricsParams } from '@/platform/integrations/emporix/metrics-utils';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import type {
  EmporixCreateOrderFromQuoteRequest,
  EmporixCreateOrderRequest,
  EmporixOrder,
  EmporixOrderCreationResponse,
  EmporixUpdateOrderRequest,
} from '../../model/order';
import type { EmporixOrderApi as IEmporixOrderApi } from '../EmporixOrderApi';

const createOrderMetrics = (route: string) => createFetchMetricsParams('order', route);

// Customer-managed endpoints use '/orders' while tenant-managed endpoints use '/salesorders'

@injectable('EmporixOrderApi', 'Singleton')
class EmporixOrderApi implements IEmporixOrderApi {
  constructor(
    @inject('EmporixApiInvoker') protected apiClient: EmporixApiClient,
    @inject('EmporixConfig') protected config: EmporixConfig,
  ) {}

  // No helper methods needed - using direct endpoint URLs

  /**
   * Create a new order from a cart (tenant-managed endpoint)
   * @param createOrderRequest Order creation request
   * @returns Promise with the created order ID
   */
  async createOrder(
    createOrderRequest: EmporixCreateOrderRequest | EmporixCreateOrderFromQuoteRequest,
  ): Promise<EmporixOrderCreationResponse> {
    const response = await this.apiClient.authenticatedFetch(
      `/order-v2/${this.config.tenant}/salesorders`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(createOrderRequest),
      },
      'service',
      undefined,
      createOrderMetrics('/order-v2/{tenant}/salesorders'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to create order: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }

  /**
   * Create a new order from a cart (customer-managed endpoint)
   * @param createOrderRequest Order creation request
   * @returns Promise with the created order ID
   */
  async createCustomerOrder(createOrderRequest: EmporixCreateOrderRequest): Promise<EmporixOrderCreationResponse> {
    const response = await this.apiClient.authenticatedFetch(
      `/order-v2/${this.config.tenant}/orders`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(createOrderRequest),
      },
      'customer-saas',
      undefined,
      createOrderMetrics('/order-v2/{tenant}/orders'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to create customer order: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }

  /**
   * Get order by ID (tenant-managed endpoint)
   * @param orderId Order ID
   * @returns Promise with the order details
   */
  async getOrder(orderId: string): Promise<EmporixOrder | null> {
    const response = await this.apiClient.authenticatedFetch(
      `/order-v2/${this.config.tenant}/salesorders/${orderId}`,
      { method: 'GET' },
      'service',
      undefined,
      createOrderMetrics('/order-v2/{tenant}/salesorders/{id}'),
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const errorDetails = await response.text();
      throw new Error(`Failed to get order: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }

  /**
   * Get customer order by ID (customer-managed endpoint)
   * @param orderId Order ID
   * @returns Promise with the order details
   */
  async getCustomerOrder(orderId: string): Promise<EmporixOrder | null> {
    const response = await this.apiClient.authenticatedFetch(
      `/order-v2/${this.config.tenant}/orders/${orderId}`,
      { method: 'GET' },
      'session',
      undefined,
      createOrderMetrics('/order-v2/{tenant}/orders/{id}'),
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const errorDetails = await response.text();
      throw new Error(`Failed to get customer order: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }

  /**
   * Get orders with optional filtering (tenant-managed endpoint)
   * @param pageSize Optional page size
   * @param pageNumber Optional page number
   * @param sort Optional sort criteria
   * @param query Optional query filter
   * @returns Promise with array of orders
   */
  async getOrders(pageSize?: number, pageNumber?: number, sort?: string, query?: string): Promise<EmporixOrder[]> {
    const queryParams = new URLSearchParams();

    if (pageSize !== undefined) {
      queryParams.append('pageSize', pageSize.toString());
    }

    if (pageNumber !== undefined) {
      queryParams.append('pageNumber', pageNumber.toString());
    }

    if (sort) {
      queryParams.append('sort', sort);
    }

    if (query) {
      queryParams.append('q', query);
    }

    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

    const response = await this.apiClient.authenticatedFetch(
      `/order-v2/${this.config.tenant}/salesorders${queryString}`,
      { method: 'GET' },
      'service',
      undefined,
      createOrderMetrics('/order-v2/{tenant}/salesorders'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to get orders: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }

  /**
   * Get customer orders with optional filtering (customer-managed endpoint)
   * @param pageSize Optional page size
   * @param pageNumber Optional page number
   * @param sort Optional sort criteria
   * @param query Optional query filter
   * @returns Promise with array of orders
   */
  async getCustomerOrders(
    pageSize?: number,
    pageNumber?: number,
    sort?: string,
    query?: string,
  ): Promise<EmporixOrder[]> {
    const queryParams = new URLSearchParams();

    if (pageSize !== undefined) {
      queryParams.append('pageSize', pageSize.toString());
    }

    if (pageNumber !== undefined) {
      queryParams.append('pageNumber', pageNumber.toString());
    }

    if (sort) {
      queryParams.append('sort', sort);
    }

    if (query) {
      queryParams.append('q', query);
    }

    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

    const response = await this.apiClient.authenticatedFetch(
      `/order-v2/${this.config.tenant}/orders${queryString}`,
      { method: 'GET' },
      'session',
      undefined,
      createOrderMetrics('/order-v2/{tenant}/orders'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to get customer orders: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }

  /**
   * Update an order (tenant-managed endpoint)
   * @param orderId Order ID
   * @param updateRequest Update request with order information
   * @returns Promise resolving when update is complete
   */
  async updateOrder(orderId: string, updateRequest: EmporixUpdateOrderRequest): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `/order-v2/${this.config.tenant}/salesorders/${orderId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(updateRequest),
      },
      'service',
      undefined,
      createOrderMetrics('/order-v2/{tenant}/salesorders/{id}'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to update order: ${response.statusText} ${errorDetails}`);
    }
  }

  /**
   * Update a customer order (customer-managed endpoint)
   * @param orderId Order ID
   * @param updateRequest Update request with order information
   * @returns Promise resolving when update is complete
   */
  async updateCustomerOrder(orderId: string, updateRequest: EmporixUpdateOrderRequest): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `/order-v2/${this.config.tenant}/orders/${orderId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(updateRequest),
      },
      'session',
      undefined,
      createOrderMetrics('/order-v2/{tenant}/orders/{id}'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to update customer order: ${response.statusText} ${errorDetails}`);
    }
  }

  /**
   * Delete an order (tenant-managed endpoint)
   * @param orderId Order ID
   * @returns Promise resolving when deletion is complete
   */
  async deleteOrder(orderId: string): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `/order-v2/${this.config.tenant}/salesorders/${orderId}`,
      { method: 'DELETE' },
      'service',
      undefined,
      createOrderMetrics('/order-v2/{tenant}/salesorders/{id}'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to delete order: ${response.statusText} ${errorDetails}`);
    }
  }

  /**
   * Get order status transitions (tenant-managed endpoint)
   * @param orderId Order ID
   * @returns Promise with available status transitions
   */
  async getOrderStatusTransitions(orderId: string): Promise<string[]> {
    const response = await this.apiClient.authenticatedFetch(
      `/order-v2/${this.config.tenant}/salesorders/${orderId}/transitions`,
      { method: 'GET' },
      'service',
      undefined,
      createOrderMetrics('/order-v2/{tenant}/salesorders/{id}/transitions'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to get order status transitions: ${response.statusText} ${errorDetails}`);
    }

    const transitions = await response.json();
    return transitions;
  }

  /**
   * Get customer order status transitions (customer-managed endpoint)
   * @param orderId Order ID
   * @returns Promise with available status transitions
   */
  async getCustomerOrderStatusTransitions(orderId: string): Promise<string[]> {
    const response = await this.apiClient.authenticatedFetch(
      `/order-v2/${this.config.tenant}/orders/${orderId}/transitions`,
      { method: 'GET' },
      'session',
      undefined,
      createOrderMetrics('/order-v2/{tenant}/orders/{id}/transitions'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to get customer order status transitions: ${response.statusText} ${errorDetails}`);
    }

    const transitions = await response.json();
    return transitions;
  }
}

export default EmporixOrderApi;
