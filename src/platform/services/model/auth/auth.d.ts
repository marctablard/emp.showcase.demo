import { Address } from '../common/';
import { Customer, CustomerAddress } from '../customer/customer';

export type TokenType = 'public' | 'session' | 'customer-saas' | 'ai' | 'service';

/**
 * Authentication Credentials
 */
export interface Credentials {
  username: string;
  password?: string;
}

/**
 * Tokens passed from Management Dashboard assisted buying via storefront URL query params.
 * @see https://developer.emporix.io/ce/core-commerce/customer-management/assisted-buying
 */
export interface AssistedBuyingTokens {
  accessToken: string;
  expiresIn: number;
  saasToken: string;
}

/**
 * Registration data
 */
export interface Registration {
  credentials: Credentials;
  customer?: Omit<Customer, 'id'>;
  address?: CustomerAddress;
}

/**
 * Represents a user's session
 */
export interface Session {
  sessionId: string;
  customerId?: string;
  siteCode?: string;
  currency?: string;
  cartId?: string;
  country?: string;
  customer?: Customer;
  cartMergeStatus?: 'MERGED' | 'FALLBACK' | 'NOT_APPLICABLE';
  cartMergeReason?:
    | 'ANONYMOUS_CART_NOT_ELIGIBLE'
    | 'TARGET_CART_UNAVAILABLE'
    | 'UNSUPPORTED_CURRENCY'
    | 'CURRENCY_ALIGNMENT_FAILED'
    | 'MERGE_FAILED'
    | 'TRANSITION_FAILED';
}
