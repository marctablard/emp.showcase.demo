import { Order } from '@/platform/services/model/order/order';

/**
 * Service interface for order management operations.
 * Provides methods to create, retrieve, and update orders.
 */
export interface OrderService {
  /**
   * Creates a new order from a cart.
   *
   * @param cartId - The ID of the cart to create an order from
   * @param customerEmail - Optional customer email for guest checkout
   * @param customerNote - Optional customer note to include with the order
   * @returns A promise that resolves to the ID of the newly created order
   */
  createOrder(cartId: string, customerEmail?: string, customerNote?: string): Promise<string>;

  /**
   * Retrieves an order by its ID.
   *
   * @param orderId - The ID of the order to retrieve
   * @returns A promise that resolves to the order if found, or null if not found
   */
  getOrderById(orderId: string): Promise<Order | null>;

  /**
   * Retrieves an order by its ID. (Customer Managed)
   *
   * @param orderId - The ID of the order to retrieve
   * @returns A promise that resolves to the order if found, or null if not found
   */
  getCustomerOrderById(orderId: string): Promise<Order | null>;

  /**
   * Retrieves a list of orders with optional pagination.
   *
   * @param pageSize - Optional number of orders to retrieve per page
   * @param pageNumber - Optional page number to retrieve
   * @returns A promise that resolves to an array of orders
   */
  getOrders(pageSize?: number, pageNumber?: number): Promise<Order[]>;

  /**
   * Retrieves a list of orders with optional pagination. (Customer Managed)
   *
   * @param pageSize - Optional number of orders to retrieve per page
   * @param pageNumber - Optional page number to retrieve
   * @param sort - Optional sort criteria (e.g. 'created:DESC')
   * @param query - Optional query filter (e.g. 'id:~(partial)')
   * @returns A promise that resolves to an array of orders
   */
  getCustomerOrders(pageSize?: number, pageNumber?: number, sort?: string, query?: string): Promise<Order[]>;

  /**
   * Updates the status of an order.
   *
   * @param orderId - The ID of the order to update
   * @param status - The new status to set
   * @returns A promise that resolves when the status is updated
   */
  updateOrderStatus(orderId: string, status: string): Promise<void>;

  /**
   * Retrieves the available status transitions for an order.
   *
   * @param orderId - The ID of the order to get status transitions for
   * @returns A promise that resolves to an array of available status transitions
   */
  getOrderStatusTransitions(orderId: string): Promise<string[]>;

  /**
   * Retrieves the available status transitions for an order. (Customer Managed)
   *
   * @param orderId - The ID of the order to get status transitions for
   * @returns A promise that resolves to an array of available status transitions
   */
  getCustomerOrderStatusTransitions(orderId: string): Promise<string[]>;

  /**
   * Applies a customer-managed order transition (e.g. decline: status `DECLINED`).
   */
  applyCustomerOrderTransition(orderId: string, status: string): Promise<void>;

  /**
   * Creates a new order from a quote.
   *
   * @param quoteId - The ID of the quote to create an order from
   * @param customerNote - Optional customer note to include with the order
   * @returns A promise that resolves to the ID of the newly created order
   */
  createOrderFromQuote(quoteId: string, customerNote?: string): Promise<string>;
}
