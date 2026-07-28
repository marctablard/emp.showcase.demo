import type { EmporixMatchedPrice } from '@/platform/integrations/emporix/model/price';
import type { EmporixPriceApi } from '@/platform/integrations/emporix/price/EmporixPriceApi';
import type { ProductPrice } from '@/platform/services/model/price';
import type PriceMapper from '@/platform/services/model/price/impl/EmporixPriceMapper';
import type { SiteService } from '@/platform/services/site/SiteService';
import EmporixPriceService from './EmporixPriceService';

describe('EmporixPriceService', () => {
  let priceService: EmporixPriceService;
  let priceApi: jest.Mocked<Pick<EmporixPriceApi, 'matchPrices' | 'matchPricesByContext'>>;
  let mapper: jest.Mocked<Pick<PriceMapper, 'mapToService'>>;
  let siteService: jest.Mocked<Pick<SiteService, 'getSite'>>;

  beforeEach(() => {
    priceApi = {
      matchPrices: jest.fn(),
      matchPricesByContext: jest.fn(),
    };

    mapper = {
      mapToService: jest.fn(
        (matchedPrice: EmporixMatchedPrice) =>
          ({
            id: `${matchedPrice.itemId.id}-${matchedPrice.currency}`,
            productId: matchedPrice.itemId.id,
            currency: matchedPrice.currency,
          }) as ProductPrice,
      ),
    };

    siteService = {
      getSite: jest.fn(),
    };

    priceService = new EmporixPriceService(
      priceApi as unknown as EmporixPriceApi,
      mapper as unknown as PriceMapper,
      siteService as unknown as SiteService,
    );
  });

  it('prefers the requested currency when batch match-prices returns multiple currencies for the same product', async () => {
    priceApi.matchPrices.mockResolvedValue([
      {
        itemId: { id: 'enjoysolar-200w-module' },
        currency: 'USD',
      } as EmporixMatchedPrice,
      {
        itemId: { id: 'enjoysolar-200w-module' },
        currency: 'EUR',
      } as EmporixMatchedPrice,
      {
        itemId: { id: 'bluesolar-victron-55w' },
        currency: 'EUR',
      } as EmporixMatchedPrice,
    ]);

    const prices = await priceService.getProductPrices(
      ['enjoysolar-200w-module', 'bluesolar-victron-55w'],
      1,
      undefined,
      {
        siteCode: 'main',
        currency: 'EUR',
        country: 'DE',
      },
    );

    expect(prices.get('enjoysolar-200w-module')?.currency).toBe('EUR');
    expect(prices.get('bluesolar-victron-55w')?.currency).toBe('EUR');
  });

  it('prefers the requested currency for single-product price lookups when multiple currencies are returned', async () => {
    priceApi.matchPrices.mockResolvedValue([
      {
        itemId: { id: 'enjoysolar-200w-module' },
        currency: 'USD',
      } as EmporixMatchedPrice,
      {
        itemId: { id: 'enjoysolar-200w-module' },
        currency: 'EUR',
      } as EmporixMatchedPrice,
    ]);

    const price = await priceService.getProductPrice('enjoysolar-200w-module', 1, undefined, {
      siteCode: 'main',
      currency: 'EUR',
      country: 'DE',
    });

    expect(price?.currency).toBe('EUR');
  });
});
