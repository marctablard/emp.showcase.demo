/**
 * Service layer model definitions for checkout
 */
import { Address, AddressType } from '@/platform/services/model/common';
import { PaymentMode } from '@/platform/services/model/payment';

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
}

/**
 * Checkout response model
 */
export interface CheckoutResponse {
  orderId: string;
  paymentDetails?: any;
}

/**
 * Quote checkout request model
 */
export interface QuoteCheckoutRequest extends BaseCheckoutRequest {
  quoteId: string;
}
