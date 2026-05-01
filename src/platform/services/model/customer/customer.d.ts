import { Address } from '../common';

/**
 * Customer domain model
 * Basic customer information
 */
export interface Customer {
  id: string;
  email: string;
  title?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  contactPhone?: string;
  language?: string;
  currency?: string;
  lastLogin?: Date;
  businessModel?: 'B2B' | 'B2C';
  legalEntityId?: string; // For B2B customers, the legal entity ID
  roles?: string[];
}

/**
 * Origin of a {@link CustomerAddress}.
 * - `customer`: a personal entry from the shopper's profile address book.
 * - `legalEntity`: a B2B company location (`EmporixLocation`) tied to the
 *   customer's legal entity; its `id` is the raw Emporix location id and is
 *   what the Emporix quote/checkout APIs expect for B2B billing/shipping
 *   address references.
 */
export type AddressSource = 'customer' | 'legalEntity';

export interface CustomerAddress extends Address {
  tags: string[];
  source: AddressSource;
  /**
   * Only meaningful for `source: 'customer'` addresses — mirrors the
   * `isDefault` flag Emporix returns on customer-profile addresses (B2C primary
   * shipping/billing). Legal-entity locations have no equivalent flag, so this
   * is always `undefined` for `source: 'legalEntity'`.
   */
  isDefault?: boolean;
}
