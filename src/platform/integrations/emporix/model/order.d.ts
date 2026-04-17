import { EmporixCheckoutAddress } from './checkout';
import { EmporixAddress, EmporixMixins } from './common';

/**
 * Order status types
 */
export type EmporixOrderStatus =
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
 * Order entry representing an item in the order
 */
export interface EmporixOrderEntry {
  id: string;
  itemYrn: string;
  amount: number;
  orderedAmount?: number;
  effectiveQuantity?: number;
  product?: {
    id: string;
    name: string;
    description?: string;
    sku?: string;
    vendor?: {
      id?: string;
      name?: string;
    };
    images?: Array<{
      id: string;
      url: string;
    }>;
  };
  price?: {
    priceId?: string;
    effectiveAmount: number;
    originalAmount?: number;
    currency: string;
  };
  calculatedPrice?: {
    price: {
      netValue: number;
      grossValue: number;
      taxValue: number;
    };
    finalPrice: {
      netValue: number;
      grossValue: number;
      taxValue: number;
    };
  };
}

/**
 * Payment information for an order
 */
export interface EmporixPayment {
  status: string;
  method: string;
  paymentResponse?: string;
  paidAmount?: number;
  currency?: string;
  transactionId?: string;
  transactionDate?: string;
}

/**
 * Shipping information for an order
 */
export interface EmporixShipping {
  total: {
    amount: number;
    currency: string;
  };
  lines?: Array<{
    id: string;
    name?: string;
    description?: string;
    amount: number;
    currency: string;
  }>;
}

/**
 * Discount information for an order
 */
export interface EmporixDiscount {
  code: string;
  amount: number;
  currency: string;
  sequenceId?: number;
  description?: string;
}

/**
 * Calculated price information for an order
 */
export interface EmporixOrderCalculatedPrice {
  price: {
    netValue: number;
    grossValue: number;
    taxValue: number;
  };
  finalPrice: {
    netValue: number;
    grossValue: number;
    taxValue: number;
  };
}

/**
 * Customer information for an order
 */
export interface EmporixOrderCustomer {
  id: string;
  name?: string;
  title?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  mixins?: Record<string, any>;
  metadata?: DefaultDtoMetadata;
}

/**
 * Emporix Order model
 */
export interface EmporixOrder {
  id: string;
  created?: string;
  status: EmporixOrderStatus;
  lastStatusChange?: string;
  creationDate?: string;
  entries: EmporixOrderEntry[];
  customer: EmporixOrderCustomer;
  billingAddress?: EmporixAddress;
  shippingAddress?: EmporixAddress;
  payments?: EmporixPayment[];
  discounts?: EmporixDiscount[];
  calculatedPrice?: EmporixOrderCalculatedPrice;
  totalAuthorizedAmount?: number;
  siteCode?: string;
  currency?: string;
  sessionId?: string;
  customerId?: string;
  customerEmail?: string;
  customerNote?: string;
  shipping?: EmporixShipping;
}

/**
 * Request to create a new order from a cart
 */
export interface EmporixCreateOrderRequest {
  cartId: string;
  billingAddress?: EmporixCheckoutAddress;
  shippingAddress?: EmporixCheckoutAddress;
  customerEmail?: string;
  customerNote?: string;
  payments?: EmporixPayment[];
}

/**
 * Request to create a new order from a quote
 */
export interface EmporixCreateOrderFromQuoteRequest {
  quoteId: string;
  customerNote?: string;
}

/**
 * Response from creating an order
 */
export interface EmporixOrderCreationResponse {
  orderId: string;
  resourceLocation: string;
}

/**
 * Request to update an order
 */
export interface EmporixUpdateOrderRequest {
  status?: EmporixOrderStatus;
  billingAddress?: EmporixCheckoutAddress;
  shippingAddress?: EmporixCheckoutAddress;
  customerEmail?: string;
  customerNote?: string;
  payments?: EmporixPayment[];
}

/**
 * Order status transition
 */
export interface EmporixOrderStatusTransition {
  status: EmporixOrderStatus;
  availableTransitions: EmporixOrderStatus[];
}
