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

export interface CustomerAddress extends Address {
  tags: string[];
}
