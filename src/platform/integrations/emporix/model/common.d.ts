export interface EmporixAddress {
  contactName?: string;
  companyName?: string;
  street: string;
  streetNumber?: string;
  streetAppendix?: string;
  extraLine1?: string;
  extraLine2?: string;
  extraLine3?: string;
  extraLine4?: string;
  zipCode: string;
  city: string;
  country: string;
  state?: string;
  contactPhone?: string;
  type?: string;
  tags: string[];
  metadata?: EmporixMetadata;
  mixins?: EmporixMixins;
  id?: string;
}

export interface EmporixLocalizedString {
  [locale: string]: string;
}

export interface EmporixSearchParams<T> {
  query?: string;
  page?: number;
  size?: number;
  sort?: string;
  expand?: string[];

  criteria?: Partial<T>;
}

export interface EmporixPaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface EmporixMedia {
  id: string;
  url: string;
  contentType: string;
  tags?: string[];
  customAttributes?: {
    name: string;
    id: string;
    type: string;
  };
  createdAt?: string;
}

export interface EmporixMonetaryAmount {
  amount: number;
  currency: string;
}

export interface EmporixSites {
  items: EmporixSite[];
}

export interface EmporixFindSiteRequest {
  postalCode: string;
  country: string;
}

export interface EmporixMetadata {
  createdAt?: string;
  modifiedAt?: string;
  calculatedAt?: string;
  version?: number;
  mixins?: {
    [key: string]: string;
  };
  version?: number;
  [key: string]: string | number | object | Array | null;
}

export interface EmporixMixin {
  [key: string]: string | number | object | Array | null;
}

export interface EmporixMixins {
  [key: string]: EmporixMixin;
}
