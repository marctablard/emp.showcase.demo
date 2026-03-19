import { EmporixLocalizedString, EmporixMetadata } from './common';

export interface EmporixCalculatedPrice {
  netValue: number;
  grossValue: number;
  taxValue: number;
}

export interface EmporixQuantity {
  quantity: number;
  unitCode?: string;
}

export interface EmporixPriceMatchItem {
  itemId: {
    itemType: 'PRODUCT' | 'SKU';
    id: string;
  };
  quantity: EmporixQuantity;
}

/**
 * Request for matching prices
 */
export interface EmporixMatchPricesRequest {
  targetCurrency: string;
  siteCode: string;
  targetLocation: {
    countryCode: string;
  };
  items: EmporixPriceMatchItem[];
  /**
   * If no price found for the specified site, try to find the best price for the main site.
   * Useful for branch sites where products may only be priced on the main site.
   */
  useFallback?: boolean;
}

export interface EmporixMatchPricesByContextRequest {
  items: EmporixPriceMatchItem[];
}

export interface EmporixPriceTax {
  taxClass: string;
  taxRate: number;
  prices: EmporixCalculatedPrice;
}

export interface EmporixTierDefinition {
  tierType: 'BASIC' | 'TIERED' | 'VOLUME';

  tiers: {
    id: string;
    minQuantity: EmporixQuantity;
  }[];
}

export interface EmporixPriceModel {
  id: string;
  name: EmporixLocalizedString;
  includesTax: boolean;
  includesMarkup: boolean;
  measurementUnit: EmporixQuantity;
  tierDefinition: EmporixTierDefinition;
  metadata: EmporixMetadata;
}

export interface EmporixTierValue {
  id: string;
  priceValue: number;
}

/**
 * Matched price response
 */
export interface EmporixMatchedPrice {
  priceId: string;
  itemId: EmporixItemId;
  site: { code: string };
  currency: string;
  location: EmporixLocation;
  originalValue: number;
  effectiveValue: number;
  totalValue: number;
  quantity: EmporixQuantity;
  includesTax: boolean;
  priceModel: EmporixPriceModel;
  tax: PriceTax;
  tierValues: EmporixTierValue[];
  metadata: EmporixMetadata;
}
