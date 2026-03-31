export interface LocationData {
  city: string;
  country: Country;
  state: string;
  geoLocation?: GeoLocation;
  postalCode?: string;
  timezone?: string;
  error?: string;
}

/**
 * Country information
 */
export interface Country {
  code: string;
  name: string | LocalizedString;
  regions?: string[];
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

/**
 * Exchange rate information
 */
export interface ExchangeRate {
  sourceCurrency: string;
  targetCurrency: string;
  rate: number;
}

export interface Region {
  code: string;
  name: string | LocalizedString;
}

export interface Currency {
  id: string;
  code?: string;
  name?: string;
  active?: boolean;
  exchangeRates?: ExchangeRate[];
}

export interface Tax {
  amount: number;
  currency: string;
  netValue: number;
  grossValue: number;
}

export interface TaxType {
  taxCode: string;
  taxRate: number;
}

export interface Price {
  amount: number;
  originalAmount?: number;
  currency: string;
  tiers?: {
    id: string;
    minQuantity: number;
    unit?: string;
    price: number;
  }[];
  tax?: Tax & TaxType;
}

export interface FilterValue {
  id: string;
  name?: string;
  count?: number;
  active: boolean;
}

export interface Filter {
  id: string;
  name?: string;
  values: FilterValue[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SearchResult<T> extends Paginated<T> {
  availableFilters: Filter[];
}

export interface PaginationQuery {
  page?: number;
  size?: number;
}

export interface SearchParams<T> extends PaginationQuery {
  query?: string;
  sort?: string;
  criteria?: Partial<T>;
  filters?: Record<string, string | string[]>;
  customerSegments?: boolean;
  locale?: string;
  site?: string;
}

export interface LocalizedString {
  [key: string]: string;
}

export type AddressType = 'SHIPPING' | 'BILLING';

export interface Address {
  id?: string;
  isDefault?: boolean;
  contactName: string;
  companyName?: string;
  street: string;
  streetNumber?: string;
  streetAppendix?: string;
  zipCode: string;
  city: string;
  country: string;
  state?: string;
  contactPhone?: string;
  geoLocation?: GeoLocation;
}

export interface Media {
  url: string;
  altText?: string | LocalizedString;
  contentType?: string;
}

/**
 * Stock availability information for a product
 */
export interface StockAvailability {
  /**
   * Product ID
   */
  productId: string;

  /**
   * Available quantity in stock
   */
  availableQuantity: number;

  /**
   * Number of days until the product is available if not in stock
   * null if the product is in stock or unavailable
   */
  availableInDays: number | null;

  /**
   * Whether the product is available for order
   */
  isAvailable: boolean;
}
