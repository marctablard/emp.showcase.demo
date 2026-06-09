import type { Order } from '@/platform/services/model/order/order';

/**
 * Fetch all orders for the current customer with optional pagination
 * @param {number} [pageSize] - Optional page size for pagination
 * @param {number} [pageNumber] - Optional page number for pagination
 * @param {string} [query] - Optional query filter (e.g. 'id:~(partial)')
 * @returns {Promise<Order[]>} Array of orders
 */
export async function fetchOrders(pageSize?: number, pageNumber?: number, query?: string): Promise<Order[]> {
  const queryParams = new URLSearchParams();
  if (pageSize) queryParams.append('pageSize', pageSize.toString());
  if (pageNumber) queryParams.append('pageNumber', pageNumber.toString());
  if (query) queryParams.append('query', query);

  const queryString = queryParams.toString();
  const url = `/api/orders${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch orders: ${response.statusText}`);
  }

  const orders = await response.json();
  return orders;
}

/**
 * Fetch a specific order by ID
 * @param {string} orderId - The ID of the order to fetch
 * @returns {Promise<Order>} The order
 */
export async function fetchOrderById(orderId: string): Promise<Order> {
  const response = await fetch(`/api/orders/${orderId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch order: ${response.statusText}`);
  }

  const order = await response.json();
  return order;
}

/**
 * Fetch available status transitions for an order
 * @param {string} orderId - The ID of the order
 * @returns {Promise<string[]>} Array of available status transitions
 */
export async function fetchOrderStatusTransitions(orderId: string): Promise<string[]> {
  const response = await fetch(`/api/orders/${orderId}/status-transitions`);

  if (!response.ok) {
    throw new Error(`Failed to fetch status transitions: ${response.statusText}`);
  }

  const statusTransitions = await response.json();
  return statusTransitions;
}

const CUSTOMER_ORDER_DECLINE_STATUS = 'DECLINED' as const;

/**
 * POST customer order decline (Emporix: CREATED → DECLINED).
 * @returns void on 204
 */
export async function postCustomerOrderDecline(orderId: string): Promise<void> {
  const response = await fetch(`/api/orders/${orderId}/transition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: CUSTOMER_ORDER_DECLINE_STATUS }),
  });

  const text = await response.text();

  if (response.status === 204 || response.ok) {
    return;
  }

  let errorMessage = text || response.statusText;
  try {
    const data = JSON.parse(text) as { error?: string };
    if (typeof data?.error === 'string' && data.error.length > 0) {
      errorMessage = data.error;
    }
  } catch {
    // keep text or statusText
  }

  throw new Error(errorMessage);
}
