import { EmporixMetadata } from './common';
import { EmporixCalculatedPrice } from './price';

export interface EmporixCartPrice extends EmporixCalculatedPrice, EmporixTaxInfo {
  appliedDiscounts?: EmporixCalculatedAppliedDiscount[];
}

export interface EmporixCartItem {
  id: string;
  itemYrn: string;
  quantity: number;
  effectiveQuantity?: number;
  type?: string;
  calculatedPrice?: {
    price: EmporixCartPrice;
    finalPrice: EmporixCartPrice;
    upliftValue: EmporixCartPrice;
    discountedPrice: EmporixCartPrice;
    totalFee: EmporixCartPrice;
    totalShipping: EmporixCartPrice;
    totalDiscount: {
      calculationType: 'ApplyDiscountBeforeTax' | 'ApplyDiscountAfterTax';
      value: number;
      appliedDiscounts: EmporixCalculatedAppliedDiscount[];
    };
  };
  product?: {
    id: string;
    name?: string;
    localizedName?: { [language: string]: string };
    description?: string;
    sku?: string;
    images?: {
      id: string;
      url: string;
    }[];
  };
  tax?: {
    rate: number;
    grossValue: number;
    netValue: number;
  };
}

export interface EmporixCalculatedAppliedDiscount {
  id: string;
  value: number;
  discountType: 'PERCENT' | 'ABSOLUTE' | 'FREE_SHIPPING';
  origin: 'INTERNAL' | 'EXTERNAL';
}

export interface EmporixTaxInfo {
  taxRate: number;
  taxCode: string;
}

export interface EmporixCartAddress {
  contactName?: string;
  companyName?: string;
  street?: string;
  streetNumber?: string;
  streetAppendix?: string;
  zipCode?: string;
  city?: string;
  country?: string;
  state?: string;
  contactPhone?: string;
  type: 'BILLING' | 'SHIPPING';
  origin?: string;
  siteCode?: string;
  metadata?: object;
  mixins?: object;
}

export interface EmporixCart {
  id: string;
  yrn?: string;
  customerId?: string;
  sessionId?: string;
  legalEntityId?: string;
  channel?: {
    name: string;
    source: string;
  };
  currency: string;
  siteCode: string;
  /** @deprecated Use addresses[] instead. Kept for deserialization of existing carts. */
  countryCode?: string;
  /** @deprecated Use addresses[] instead. Kept for deserialization of existing carts. */
  zipCode?: string;
  addresses?: EmporixCartAddress[];
  type?: string;
  status?: string;
  items?: CartItem[];
  calculatedPrice?: {
    price: EmporixCartPrice;
    finalPrice: EmporixCartPrice;
    upliftValue: EmporixCartPrice;
    discountedPrice: EmporixCartPrice;
    totalFee: EmporixCartPrice;
    totalShipping: EmporixCartPrice;
    totalDiscount: {
      calculationType: 'ApplyDiscountBeforeTax' | 'ApplyDiscountAfterTax';
      value: number;
      appliedDiscounts: EmporixCalculatedAppliedDiscount[];
    };
  };
  totalUnitsCount?: number;
  metadata?: EmporixMetadata;
  mixins?: Mixins;
}

export interface EmporixCreateCartRequest {
  customerId?: string;
  siteCode: string;
  currency: string;
  type?: string;
  channel?: {
    name: string;
    source: string;
  };
  sessionValidated?: boolean;
}

export interface EmporixCreatedCart {
  cartId: string;
  yrn: string;
}

export interface EmporixCartProduct {
  id: string;
  name?: string;
  localizedName?: { [language: string]: string };
  description?: string;
  sku?: string;
  images?: {
    id: string;
    url: string;
  }[];
}

export interface EmporixAddCartItemRequest {
  siteCode: string;
  itemYrn: string;
  quantity: number;
  itemType?: string;
  price?: {
    priceId?: string;
    effectiveAmount: number;
    originalAmount: number;
    currency: string;
  };
  tax?: {
    rate: number;
    grossValue: number;
    netValue: number;
  };
  product?: EmporixCartProduct;
}

export interface EmporixCreatedCartItem {
  itemId: string;
  yrn: string;
}

export interface EmporixUpdateCartItemRequest {
  quantity: number;
  price: {
    priceId?: string;
    effectiveAmount: number;
    originalAmount: number;
    currency: string;
  };
}
