import { EmporixLocalizedString, EmporixMonetaryAmount } from './common';

export interface EmporixFindSiteRequest {
  postalCode: string;
  country: string;
}

export interface EmporixShippingSite {
  id: string;
  zones: EmporixShippingZone[];
}

export interface EmporixShippingZone {
  id: string;
  name: EmporixLocalizedString;
  shipTo: EmporixShipToLocation[];
  methods: EmporixShippingMethod[];
}

export interface EmporixShipToLocation {
  country: string;
  postalCodes?: string[];
}

export interface EmporixShippingFee {
  minOrderValue: EmporixMonetaryAmount;
  cost: EmporixMonetaryAmount;
}

export interface EmporixShippingMethod {
  id: string;
  name: EmporixLocalizedString;
  maxOrderValue?: EmporixMonetaryAmount;
  fees: EmporixShippingFee[];
  shippingTaxCode?: string;
}
