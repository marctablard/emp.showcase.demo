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
   * Whether this is the default address.
   * - `source: 'customer'` — mirrors the `isDefault` flag on Emporix customer-profile addresses.
   * - `source: 'legalEntity'` — `true` when the location carries the `DEFAULT` tag in
   *   `contactDetails.tags`; `false` otherwise (never `undefined` for legal-entity addresses).
   */
  isDefault?: boolean;
}
