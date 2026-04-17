import type { OrderStatus } from './order';

/**
 * Runtime const object derived from the OrderStatus union type.
 * The mapped type `{ [K in OrderStatus]: K }` guarantees a 1-to-1 match:
 * adding or removing a member from OrderStatus will cause a compile error here.
 */
export const ORDER_STATUS: { [K in OrderStatus]: K } = {
  IN_CHECKOUT: 'IN_CHECKOUT',
  CREATED: 'CREATED',
  CONFIRMED: 'CONFIRMED',
  PROCESSING: 'PROCESSING',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  READY_FOR_SHIPPING: 'READY_FOR_SHIPPING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  DECLINED: 'DECLINED',
};
