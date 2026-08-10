import type { PriceModelType } from './price';

/**
 * Runtime const object derived from the PriceModelType union.
 * Adding or removing a member from PriceModelType will cause a compile error here.
 */
export const PRICE_MODEL_TYPE: { [K in PriceModelType]: K } = {
  BASIC: 'BASIC',
  TIERED: 'TIERED',
  VOLUME: 'VOLUME',
};
