import type { EmporixMatchedPrice } from '@/platform/integrations/emporix/model/price';
import { PRICE_MODEL_TYPE } from '../price-model-type';
import EmporixPriceMapper from './EmporixPriceMapper';

function buildMatchedPrice(overrides: Partial<EmporixMatchedPrice> = {}): EmporixMatchedPrice {
  return {
    priceId: 'price-1',
    itemId: { itemType: 'PRODUCT', id: 'product-1' },
    site: { code: 'main' },
    currency: 'EUR',
    location: { countryCode: 'DE' },
    originalValue: 100,
    effectiveValue: 100,
    totalValue: 100,
    quantity: { quantity: 1, unitCode: 'pc' },
    includesTax: false,
    priceModel: {
      id: 'pm-1',
      name: { en: 'Volume' },
      includesTax: false,
      includesMarkup: false,
      measurementUnit: { quantity: 1, unitCode: 'pc' },
      tierDefinition: {
        tierType: 'VOLUME',
        tiers: [
          { id: 't1', minQuantity: { quantity: 0, unitCode: 'pc' } },
          { id: 't2', minQuantity: { quantity: 10, unitCode: 'pc' } },
        ],
      },
      metadata: { version: 1 },
    },
    tax: {
      taxClass: 'STANDARD',
      taxRate: 19,
      prices: {
        effectiveValue: { netValue: 100, grossValue: 119, taxValue: 19 },
      },
    },
    tierValues: [
      { id: 't1', priceValue: 100 },
      { id: 't2', priceValue: 90 },
    ],
    metadata: { version: 1 },
    ...overrides,
  } as EmporixMatchedPrice;
}

describe('EmporixPriceMapper', () => {
  const mapper = new EmporixPriceMapper();

  it('maps priceModel.tierDefinition.tierType to priceModelType (VOLUME)', () => {
    const result = mapper.mapToService(buildMatchedPrice());

    expect(result.priceModelType).toBe(PRICE_MODEL_TYPE.VOLUME);
    expect(result.tierValues).toEqual([
      { id: 't1', minQuantity: 0, unit: 'pc', price: 100 },
      { id: 't2', minQuantity: 10, unit: 'pc', price: 90 },
    ]);
  });

  it('maps TIERED price model type through to the domain model', () => {
    const result = mapper.mapToService(
      buildMatchedPrice({
        priceModel: {
          ...buildMatchedPrice().priceModel,
          tierDefinition: {
            tierType: 'TIERED',
            tiers: buildMatchedPrice().priceModel.tierDefinition.tiers,
          },
        },
      }),
    );

    expect(result.priceModelType).toBe(PRICE_MODEL_TYPE.TIERED);
  });

  it('maps BASIC price model type through to the domain model', () => {
    const result = mapper.mapToService(
      buildMatchedPrice({
        priceModel: {
          ...buildMatchedPrice().priceModel,
          tierDefinition: {
            tierType: 'BASIC',
            tiers: [{ id: 't1', minQuantity: { quantity: 0, unitCode: 'pc' } }],
          },
        },
        tierValues: [{ id: 't1', priceValue: 100 }],
      }),
    );

    expect(result.priceModelType).toBe(PRICE_MODEL_TYPE.BASIC);
  });
});
