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
  active?: boolean;
  fees: EmporixShippingFee[];
  shippingTaxCode?: string;
}

/** GET /shipping/{tenant}/actualDeliveryWindows/{cartId} */
export interface EmporixActualDeliveryWindow {
  id?: string;
  deliveryDate: string;
  deliveryTimeRange?: {
    startTime?: string;
    endTime?: string;
  };
  deliveryCycle?: string;
  zoneId?: string;
  /** Shipping method name (or id) for this window. May be a localized map. */
  deliveryMethod?: string | Record<string, string>;
  shippingMethod?: string | Record<string, string>;
  methodId?: string;
  cutOffTime?: string;
  slotId?: string;
}
