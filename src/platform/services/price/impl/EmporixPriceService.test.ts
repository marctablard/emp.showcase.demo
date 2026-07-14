import type { EmporixMatchedPrice } from '@/platform/integrations/emporix/model/price';
import type { EmporixPriceApi } from '@/platform/integrations/emporix/price/EmporixPriceApi';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { ProductPrice } from '@/platform/services/model/price';
import type PriceMapper from '@/platform/services/model/price/impl/EmporixPriceMapper';
import type { SessionService } from '@/platform/services/session/SessionService';
import type { SiteService } from '@/platform/services/site/SiteService';
import EmporixPriceService from './EmporixPriceService';

describe('EmporixPriceService', () => {
  let priceService: EmporixPriceService;
  let priceApi: jest.Mocked<Pick<EmporixPriceApi, 'matchPrices' | 'matchPricesByContext'>>;
  let mapper: jest.Mocked<Pick<PriceMapper, 'mapToService'>>;
  let siteService: jest.Mocked<Pick<SiteService, 'getSite'>>;
  let sessionService: jest.Mocked<Pick<SessionService, 'getCurrent'>>;
  let customerService: jest.Mocked<Pick<CustomerService, 'getCustomer'>>;

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

    sessionService = {
      getCurrent: jest.fn().mockResolvedValue(undefined),
    };

    customerService = {
      getCustomer: jest.fn().mockResolvedValue(null),
    };

    priceService = new EmporixPriceService(
      priceApi as unknown as EmporixPriceApi,
      mapper as unknown as PriceMapper,
      siteService as unknown as SiteService,
      sessionService as unknown as SessionService,
      customerService as unknown as CustomerService,
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

  it('forwards legalEntityId to match-prices for B2B price list matching', async () => {
    priceApi.matchPrices.mockResolvedValue([
      {
        itemId: { id: 'ctrl-premta211' },
        currency: 'EUR',
      } as EmporixMatchedPrice,
    ]);

    await priceService.getProductPrice('ctrl-premta211', 1, undefined, {
      siteCode: 'main',
      currency: 'EUR',
      country: 'DE',
      legalEntityId: '68622659f812a728c0bad17f',
    });

    expect(priceApi.matchPrices).toHaveBeenCalledWith(
      expect.objectContaining({
        legalEntityId: '68622659f812a728c0bad17f',
        targetCurrency: 'EUR',
        siteCode: 'main',
      }),
    );
  });

  it('falls back to the customer profile legal entity when session has no company context', async () => {
    sessionService.getCurrent.mockResolvedValue({
      id: 'session-1',
      siteCode: 'main',
      currency: 'EUR',
      customerId: '41535415',
    });
    customerService.getCustomer.mockResolvedValue({
      id: '41535415',
      email: 'buyer@example.com',
      legalEntityId: '68622659f812a728c0bad17f',
      roles: [],
    });

    priceApi.matchPrices.mockResolvedValue([
      {
        itemId: { id: 'ctrl-premta211' },
        currency: 'EUR',
      } as EmporixMatchedPrice,
    ]);

    await priceService.getProductPrice('ctrl-premta211', 1, undefined, {
      siteCode: 'main',
      currency: 'EUR',
      country: 'DE',
    });

    expect(customerService.getCustomer).toHaveBeenCalled();
    expect(priceApi.matchPrices).toHaveBeenCalledWith(
      expect.objectContaining({
        legalEntityId: '68622659f812a728c0bad17f',
      }),
    );
  });
});
