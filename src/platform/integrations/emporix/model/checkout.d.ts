/**
 * Checkout model definitions for Emporix
 */
import { EmporixAddress } from './common';

/**
 * Common properties for all checkout requests
 */
export interface EmporixCheckoutRequest {
  paymentMethods: EmporixCheckoutPaymentMethod[];
  deliveryWindowId?: string;
  currency?: string;
}

/**
 * Address model for checkout
 * Extends the common BaseAddress with a required type field
 */
export interface EmporixCheckoutAddress extends Omit<EmporixAddress, 'tags'> {
  contactName: string; // Required for checkout
  type: 'BILLING' | 'SHIPPING'; // Required and restricted to these values for checkout
}

/**
 * Base customer model for checkout
 */
export interface EmporixCheckoutCustomer {
  id?: string;
  name?: string;
  title?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  contactPhone?: string;
  email: string;
  company?: string;
  guest?: boolean;
  metadata?: {
    mixins: Record<string, any>;
  };
  mixins?: Record<string, any>;
}

/**
 * Payment method model for checkout
 */
export interface EmporixCheckoutPaymentMethod {
  provider: string;
  customAttributes?: {
    token?: string;
    modeId?: string;
    paymentType?: string;
    [key: string]: any;
  };
  method: string;
  amount?: number;
}

/**
 * Shipping model for checkout
 */
export interface EmporixShipping {
  methodId: string;
  zoneId: string;
  methodName: string;
  amount: number;
  /** Official Approval/Checkout schema field. */
  shippingTaxCode?: string;
  /** Alias seen on some approval payloads. */
  taxCode?: string;
}

/**
 * Base cart checkout request properties
 */
export interface EmporixCartCheckoutRequest extends EmporixCheckoutRequest {
  customer: EmporixCheckoutCustomer;
  cartId: string;
  shipping: EmporixShipping;
  addresses: EmporixCheckoutAddress[];
}

/**
 * Request model for checkout from quote
 */
export interface EmporixQuoteCheckoutRequest extends EmporixCheckoutRequest {
  quoteId: string;
}

/**
 * Response model for checkout
 */
export interface EmporixCheckoutResponse {
  orderId: string;
  paymentDetails?: any;
  checkoutId?: string;
}

/**
 * Error message model
 */
export interface ErrorMessage {
  status: number;
  type: string;
  message: string;
  moreInfo?: string;
  details?: ErrorDetail[];
}

/**
 * Error detail model
 */
export interface ErrorDetail {
  field?: string;
  type: string;
  message?: string;
  moreInfo?: string;
}
