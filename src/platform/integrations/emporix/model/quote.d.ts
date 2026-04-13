import { LocalizedString } from '@/platform/services/model/common';
import type { EmporixCart, EmporixCartProduct } from './cart';
import { EmporixMetadata } from './common';

// Full manual quote creation request (with items)
export interface EmporixCreateQuoteManualRequest {
  customerId: CustomerId;
  employeeId?: string;
  billingAddressId?: string;
  shippingAddressId?: string;
  companyName?: string;
  siteCode?: SiteCode;
  status: {
    value: string;
  };
  businessModel?: string;
  currency: string;
  validTo?: string;
  shipping?: {
    value?: number;
    methodId?: string;
    zoneId?: string;
    shippingTaxCode?: string;
  };
  items: Array<{
    quantity: {
      quantity: number;
      unitCode?: string;
    };
    price?: {
      priceId: string;
      unitPrice: number;
      totalNetValue: number;
      tax: {
        taxClass: string;
        taxRate: number;
      };
    };
    product: {
      productId: EmporixCartProduct['id'];
    };
  }>;
  // Optional metadata
  reference?: string;
  userComment?: string;
}

// Create quote from an existing cart request
export interface EmporixCreateQuoteFromCartRequest {
  employeeId?: string;
  cartId: string;
  status: {
    value: string;
  };
  billingAddressId?: string;
  shippingAddressId?: string;
  shipping?: {
    value?: number;
    methodId?: string;
    zoneId?: string;
    shippingTaxCode?: string;
  };
}

/**
 * Price structure with currency information
 */
export interface EmporixPrice {
  currency: string;
  netValue: number;
  grossValue: number;
  taxValue: number;
}

/**
 * Address structure used in quotes
 */
export interface EmporixAddress {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  countryCode: string;
  postcode: string;
  state?: string;
}

/**
 * Product information in quote item
 */
export interface EmporixQuoteProduct {
  productId: string;
  name?: string | LocalizedString;
  media?: {
    contentType: string;
    url: string;
  };
  taxClasses?: Record<string, string>;
}

/**
 * Quantity information
 */
export interface EmporixQuantity {
  quantity: number;
  unitCode: string;
}

/**
 * Price information for quote items
 */
export interface EmporixItemPrice {
  priceId: string;
  unitPrice: number;
  newUnitPrice?: number;
  discount?: number;
  totalNetValue: number;
  tax?: {
    taxClass: string;
    taxRate: number;
    prices: {
      grossValue: number;
      netValue: number;
    };
  };
}

/**
 * Quote item structure
 */
export interface EmporixQuoteItem {
  id: string;
  quantity: EmporixQuantity;
  price?: EmporixItemPrice;
  product: EmporixQuoteProduct;
}

export interface EmporixQuoteShipping {
  value?: number;
  grossValue?: number;
  methodId?: string;
  zoneId?: string;
  methodName?: {
    [key: string]: string;
  };
  shippingTaxCode?: string;
}

/**
 * Quote response from Emporix API
 */
export interface EmporixQuote {
  id: string;
  businessModel?: string;
  cartId?: string;
  customer: {
    customerId: string;
    firstName?: string;
    lastName?: string;
    contactEmail?: string;
  };
  employee?: {
    employeeId: string;
    firstName?: string;
    lastName?: string;
  };
  siteCode?: string;
  currency: string;
  status: {
    value: string;
  };
  validTo?: string;
  totalPrice: EmporixPrice;
  subtotalPrice?: EmporixPrice;
  shipping?: EmporixQuoteShipping;
  taxAggregate?: {
    lines: Array<{
      name: string;
      amount: number;
      rate: number;
      taxable: number;
    }>;
  };
  comment?: {
    employeeComment?: string;
  };
  billingAddress?: EmporixAddress;
  shippingAddress?: EmporixAddress;
  items: EmporixQuoteItem[];
  metadata: {
    mixins?: Record<string, string>;
    version: number;
    createdAt: string;
    modifiedAt: string;
  };
  mixins: {
    additionalInfo?: {
      userComment?: string;
      reference?: string;
    };
  };
}

export type EmporixCreateQuoteRequest = EmporixCreateQuoteManualRequest | EmporixCreateQuoteFromCartRequest;

export interface EmporixQuoteCreationResponse {
  quoteId: string;
}

export interface EmporixQuoteReason {
  id: string;
  code: string;
  message: LocalizedString;
  type: string;
  metadata: EmporixMetadata;
}

export interface EmporixCreateQuoteReasonRequest {
  code: string;
  type: string;
  message: LocalizedString;
}

export interface EmporixQuoteReasonCreationResponse {
  id: string;
}

export interface EmporixQuoteUpdateValues {
  [key: string]: any;
}

export interface EmporixQuoteHistoryItem {
  id: string;
  op: EmporixQuoteUpdateOperation;
  path: EmporixQuoteUpdatePath;
  newValue?: EmporixQuoteUpdateValues;
  previousValue?: EmporixQuoteUpdateValues;
  userId?: string;
  userFirstName?: string;
  userLastName?: string;
  userType?: 'EMPLOYEE' | 'CUSTOMER' | 'SYSTEM';
  modifiedAt?: string;
}

export type EmporixQuoteUpdateOperation = 'ADD' | 'REMOVE' | 'REPLACE' | 'CREATE';
export type EmporixQuoteUpdatePath =
  | '/quote'
  | '/status'
  | '/validTo'
  | '/comment'
  | '/billingAddressId'
  | '/shippingAddressId'
  | '/companyName'
  | '/customerId'
  | '/shipping'
  | '/items'
  | '/items/{itemId}'
  | '/items/{itemId}/price'
  | '/mixins/{mixinsPath}'
  | '/metadata/{mixinsPath}';

export type EmporixQuoteStatus =
  | 'CREATING'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'DECLINED'
  | 'ACCEPTED'
  | 'ORDER_CREATED'
  | 'CLOSED'
  | 'CHANGE'
  | 'DECLINE'
  | 'DECLINED_BY_MERCHANT'
  | 'EXPIRED';

export interface EmporixQuoteUpdateRequest {
  op: EmporixQuoteUpdateOperation;
  path: EmporixQuoteUpdatePath | string;
  value: EmporixQuoteStatus | string | Record<string, any>;
}

export type EmporixQuoteHistory = EmporixQuoteHistoryItem[];
