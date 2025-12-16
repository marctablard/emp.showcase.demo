import { Address } from '../common/';
import { Customer, CustomerAddress } from '../customer/customer';

/**
 * Authentication Credentials
 */
export interface Credentials {
  username: string;
  password?: string;
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
}
