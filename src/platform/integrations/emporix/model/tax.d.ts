/**
 * Models for Emporix Tax Service
 * GET /tax/{tenant}/taxes/{locationCode}
 * @see https://developer.emporix.io/api-references/api-guides/prices-and-taxes/tax-service/api-reference/taxes
 */

export interface EmporixTaxLocation {
  countryCode: string;
}

export interface EmporixTaxClass {
  code: string;
  name: string | Record<string, string>;
  rate: number;
  description?: string | Record<string, string>;
  order?: number;
  isDefault?: boolean;
}

export interface EmporixTaxConfiguration {
  locationCode?: string;
  location?: EmporixTaxLocation;
  taxClasses?: EmporixTaxClass[];
  metadata?: {
    createdAt: string;
    modifiedAt: string;
    version: number;
  };
}
