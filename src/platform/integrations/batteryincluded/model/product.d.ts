import { Media } from './common';

export interface BatteryIncludedTierPrice {
  id?: string;
  minQuantity?: {
    quantity: number;
    unitCode?: string;
  };
  priceValue?: number;
}

export interface BatteryIncludedPrice {
  amount?: number;
  originalAmount?: number;
  effectiveAmount?: number;
  currency?: string;
  priceId?: string;
  priceModel?: {
    includesTax?: boolean;
    measurementUnit?: string;
    tierType?: string;
    tierValues?: BatteryIncludedTierPrice[];
  };
}

export interface BatteryIncludedCountryInfo {
  prices?: any;
  [key: string]: any;
}

export interface BatteryIncludedCurrencyInfo {
  countryAware?: {
    [countryCode: string]: BatteryIncludedCountryInfo;
  };
  [key: string]: any;
}

export interface BatteryIncludedSiteInfo {
  availability?: any;
  currencyAware?: {
    [currencyCode: string]: BatteryIncludedCurrencyInfo;
  };
  [key: string]: any;
}

export interface BatteryIncludedCategoryBreadcrumb {
  displayPath?: string;
  idPath?: string;
}

export interface BatteryIncludedI18n {
  categoryBreadcrumbs?: BatteryIncludedCategoryBreadcrumb[];
  mixins?: {
    highlights?: {
      highlights?: string[];
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

export interface BatteryIncludedProduct {
  id?: string;
  name?: any;
  sku?: string;
  _product?: any;
  _product_i18n?: BatteryIncludedI18n;
  _product_siteAware?: BatteryIncludedSiteInfo;
  media?: Media[];
  medias?: Media[];
  availability?: any;
  prices?: any;
  [key: string]: any;
}
