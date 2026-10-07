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

/**
 * Tenant-managed customer list/get DTO (Customer Service seller APIs).
 * `customerNumber` is the GET/PATCH/DELETE path identifier; `id` is ResourceLocation from create.
 */
export interface EmporixCustomerAdmin {
  id: string;
  customerNumber: string;
  title?: string;
  firstName?: string;
  lastName?: string;
  contactEmail?: string;
  contactPhone?: string;
  company?: string;
  preferredLanguage?: string;
  preferredCurrency?: string;
  preferredSite?: string;
  active?: boolean;
  metadataCreatedAt?: string;
  metadata?: EmporixMetadata;
  b2b?: EmporixB2Binfo;
  businessModel?: 'B2B' | 'B2C';
}

/**
 * Invite-create body for POST /customer/{tenant}/customers.
 * Password is omitted so the API sends a reset-notification email instead.
 * The acting customer token determines the automatically assigned legal entity.
 */
export interface EmporixCustomerAdminCreateRequest {
  title?: string;
  firstName?: string;
  lastName?: string;
  contactEmail: string;
  contactPhone?: string;
  company?: string;
  preferredLanguage?: string;
  preferredCurrency?: string;
  preferredSite?: string;
}

/**
 * PATCH body for /customer/{tenant}/customers/{customerNumber}.
 */
export interface EmporixCustomerAdminUpdateRequest {
  title?: string;
  firstName?: string;
  lastName?: string;
  contactEmail?: string;
  contactPhone?: string;
  preferredLanguage?: string;
  preferredCurrency?: string;
  preferredSite?: string;
  active?: boolean;
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

/**
 * Customer reference on a contact assignment. When listing/retrieving
 * assignments the customer object is expanded with profile fields; when
 * creating an assignment only the `id` is required.
 */
export interface EmporixContactAssignmentCustomer extends EmporixResourceId {
  name?: string;
  surname?: string;
  email?: string;
  phone?: string;
}

export interface EmporixContactAssignment {
  id?: string;
  legalEntity: EmporixResourceId & {
    customerGroups?: EmporixCustomerGroup[];
  };
  customer: EmporixContactAssignmentCustomer;
  type: 'PRIMARY' | 'BILLING' | 'LOGISTICS' | 'CONTACT';
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
  /** Customer group role, e.g. "Admin", "Buyer", "Requester", "Contact". */
  role?: string;
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
