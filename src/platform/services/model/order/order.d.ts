import { Address } from '../common';

/**
 * Order status types
 */
export type OrderStatus =
  | 'IN_CHECKOUT'
  | 'CREATED'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'READY_FOR_PICKUP'
  | 'READY_FOR_SHIPPING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DECLINED';

/**
 * Order item representing a product in the order
 */
export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  name?: string;
  description?: string;
  vendorName?: string;
  sku?: string;
  images?: string[];
  price?: {
    value: number;
    netValue?: number;
    originalValue?: number;
    grossValue?: number;
    currency: string;
  };
}

/**
 * Payment information for an order
 */
export interface OrderPayment {
  status: string;
  method: string;
  response?: string;
  amount?: number;
  currency?: string;
  transactionId?: string;
  transactionDate?: string;
}

/**
 * Shipping information for an order
 */
export interface OrderShipping {
  total: {
    value: number;
    currency: string;
  };
  methods?: Array<{
    id: string;
    name?: string;
    localizedName?: Record<string, string>;
    description?: string;
    price: number;
    currency: string;
  }>;
}

/**
 * Discount information for an order
 */
export interface OrderDiscount {
  code: string;
  value: number;
  currency: string;
  description?: string;
}

/**
 * Price information for an order
 */
export interface OrderPrice {
  subtotal: {
    net: number;
    gross: number;
    tax: number;
    currency: string;
  };
  total: {
    net: number;
    gross: number;
    tax: number;
    currency: string;
  };
}

/**
 * Order model
 */
export interface Order {
  id: string;
  status: OrderStatus;
  createdAt?: string;
  lastStatusChange?: string;
  items: OrderItem[];
  billingAddress?: Address;
  shippingAddress?: Address;
  payments?: OrderPayment[];
  shipping?: OrderShipping;
  discounts?: OrderDiscount[];
  price?: OrderPrice;
  currency?: string;
  customerEmail?: string;
  customerNote?: string;
  customer?: {
    id: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}
