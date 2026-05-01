import type { EmporixAddress, EmporixMetadata, EmporixMixins } from './common';

/**
 * Customer domain model
 */
export interface EmporixCustomer {
  id: string;
  customerNumber: string;
  title?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  contactEmail?: string;
  contactPhone?: string;
  company?: string;
  preferredLanguage?: string;
  preferredCurrency?: string;
  preferredSite?: string;
  accounts?: EmporixAccountId[];
  addresses?: EmporixAddress[];
  defaultAddress?: EmporixAddress;
  businessModel?: 'B2B' | 'B2C';
  b2b?: EmporixB2Binfo;
  mixins?: EmporixMixins;
  metadata?: EmporixMetadata;
  lastLogin?: string;
}

export interface EmporixSignupRequest {
  email: string;
  password: string;
  customerDetails?: Omit<EmporixCustomer, 'id' | 'customerNumber'>;
  customerAddress?: EmporixAddress;
}

export interface EmporixPasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Address DTO for retrieving an address
 */
export interface EmporixCustomerAddress extends EmporixAddress {
  id: string;
  /** Marks the customer's primary personal address (B2C). Not returned for legal-entity locations. */
  isDefault?: boolean;
}

export interface EmporixB2Binfo {
  companyRegistrationId?: string;
  legalEntities?: EmporixLegalEntity[];
}

export interface EmporixLegalEntity {
  id: string;
  name: string;
  contactAssignmentId: string;
}

export interface EmporixAccountId {
  id: string;
  providerId?: string;
}

export interface EmporixCustomerSignupDto {
  email: string;
  password: string;
  title?: string;
  firstName?: string;
  lastName?: string;
  contactPhone?: string;
  company?: string;
  preferredLanguage?: string;
  preferredCurrency?: string;
  preferredSite?: string;
  businessModel?: 'B2B' | 'B2C';
  b2b?: Omit<EmporixB2Binfo, 'legalEntities'>;
}

export interface EmporixLegalEntity {
  id?: string;
  name: string;
  type: 'COMPANY' | 'SUBSIDIARY';
  parentId?: string;
  accountLimit?: EmporixAccountLimit;
  legalInfo?: EmporixLegalInfo;
  customerGroups?: EmporixCustomerGroup[];
  entitiesAddresses?: EmporixResourceId[];
  approvalGroup?: EmporixResourceId[];
  metadata?: EmporixMetadata;
  mixins?: EmporixMixins;
}

export interface EmporixContactAssignment {
  id?: string;
  legalEntity: EmporixResourceId;
  customer: EmporixResourceId;
  type: 'PRIMARY' | 'BILLING' | 'LOGISTICS';
  primary?: boolean;
  metadata?: EmporixMetadata;
  mixins?: EmporixMixins;
}

export interface EmporixLocation {
  id?: string;
  name: string;
  type: 'HEADQUARTER' | 'WAREHOUSE' | 'OFFICE';
  contactDetails: EmporixContactDetails;
  metadata?: EmporixMetadata;
  mixins?: EmporixMixins;
}

export interface EmporixAccountLimit {
  currency: string;
  value: number;
}

export interface EmporixLegalInfo {
  legalName: string;
  registrationDate: string;
  taxRegistrationNumber: string;
  registrationAgency: string;
  countryOfRegistration: string;
  registrationId: string;
}

export interface EmporixCustomerGroup {
  id: string;
  name: EmporixLocalizedString;
}

export interface EmporixResourceId {
  id: string;
}

export interface EmporixContactDetails {
  emails?: string[];
  phones?: string[];
  /** Structured address fields when returned by the API (preferred over legacy lines). */
  street?: string;
  streetNumber?: string;
  streetAppendix?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  countryCode?: string;
  tags?: string[];
}
