import { EmporixMetadata, EmporixMixins } from './common';

export interface EmporixCommonAvailability {
  id: string;
  site: string;
  productId: string;
  stockLevel: number;
  available: boolean;
  popularity?: number;
  distributionChannel?: EmporixDistributionChannel;
  mixins?: EmporixMixins;
  metadata?: EmporixMetadata;
}

export interface EmporixAvailability extends EmporixCommonAvailability {
  bundleAvailabilities?: EmporixAvailability[];
}

export type EmporixDistributionChannel = 'ASSORTMENT' | 'HOME_DELIVERY' | 'PICKUP';

export interface EmporixLocation {
  id: string;
  site: string;
  rack?: string;
  rackName?: string;
  order: number;
}

export interface EmporixProductLocationResult {
  productId: string;
  locations: EmporixProductLocation[];
}

export interface EmporixProductLocation extends EmporixLocation {
  zone?: string;
  shelf?: string;
  section?: string;
  bin?: string;
}
