/**
 * Service layer model definitions for checkout
 */
import { Address, AddressType } from '@/platform/services/model/common';
import { PaymentMode } from '@/platform/services/model/payment';
import type { SubscriptionInterval } from '@/platform/services/subscription/subscription-rules';

/** Shopper choice on the order review. The server re-reads the order and may lock the cadence. */
export interface CheckoutRenewal {
  every: number;
  unit: SubscriptionInterval;
}

/**
 * Common properties for all checkout requests
 */
export interface BaseCheckoutRequest {
  customer: ContactData;
  paymentMethod: CheckoutPaymentMethod;
  currency?: string;
}

export interface ContactData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
}

export interface CheckoutAddress extends Omit<Address, 'types'> {
  type: AddressType; // Required for Checkout
  sameAs?: AddressType;
}

/**
 * Customer information for checkout
 */
export interface ContactData {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  emailConfirmation: string;
  phone?: string;
  company?: string;
}

/**
 * Payment method for checkout
 */
export interface CheckoutPaymentMethod extends PaymentMode {
  provider: string;
  amount?: number;
  customAttributes?: Record<string, any>;
}

/**
 * Shipping information for checkout
 */
export interface OrderShipping {
  methodId: string;
  zoneId: string;
  methodName: string;
  amount: number;
  taxCode?: string;
  /**
   * Quote `shipping.grossValue`. Approval GET has net `amount` only;
   * QUOTE approvals overlay this from Quote Service (shipping tax = gross − amount).
   */
  grossAmount?: number;
  /** Shipping VAT % from quote `shipping.taxRate` or checkout shipping when present. */
  taxRate?: number;
}

/**
 * Checkout request model for cart checkout
 */
export interface CheckoutRequest extends BaseCheckoutRequest {
  cartId: string;
  shipping: OrderShipping;
  addresses: CheckoutAddress[];
  customer: ContactData | null;
  paymentMethod: CheckoutPaymentMethod;
  summary: {
    termsAndConditions: boolean;
  };
  /** Present when the shopper chose "Renew this order". Customer and company come from the order. */
  renewal?: CheckoutRenewal;
}

/**
 * Checkout response model
 */
export interface CheckoutResponse {
  orderId: string;
  paymentDetails?: any;
  subscriptionId?: string;
  /** Set when the order was placed but the subscription was refused or could not be saved. */
  subscriptionIssue?: 'empty' | 'missing-cadence' | 'conflicting-cadence' | 'invalid-every' | 'cancelled' | 'failed';
}

/**
 * Quote checkout request model
 */
export interface QuoteCheckoutRequest extends BaseCheckoutRequest {
  quoteId: string;
}
