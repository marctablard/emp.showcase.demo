import type { EmporixQuote } from '@/platform/integrations/emporix/model/quote';
import { EmporixQuoteMapper } from './EmporixQuoteMapper';

describe('EmporixQuoteMapper', () => {
  const siteService = {
    getCountry: jest.fn().mockResolvedValue({ name: 'Germany' }),
  };

  const buildQuote = (overrides: Partial<EmporixQuote> = {}): EmporixQuote => ({
    id: 'quote-1',
    orderId: undefined,
    customer: {
      customerId: 'customer-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
    },
    currency: 'EUR',
    status: {
      value: 'OPEN',
    },
    totalPrice: {
      currency: 'EUR',
      netValue: 100,
      grossValue: 119,
      taxValue: 19,
    },
    shippingAddress: {
      id: 'shipping-1',
      name: 'Ada Lovelace',
      addressLine1: 'Main Street 1',
      city: 'Berlin',
      countryCode: 'DE',
      postcode: '10115',
    },
    items: [],
    metadata: {
      version: 1,
      createdAt: '2026-06-01T00:00:00.000Z',
      modifiedAt: '2026-06-01T00:00:00.000Z',
    },
    mixins: {},
    ...overrides,
  });

  beforeEach(() => {
    siteService.getCountry.mockClear();
  });

  it('maps orderId when the upstream quote is linked to an order', async () => {
    const mapper = new EmporixQuoteMapper(siteService as never);

    const result = await mapper.mapToService(
      buildQuote({
        orderId: 'order-123',
      }),
    );

    expect(result.orderId).toBe('order-123');
  });

  it('leaves orderId undefined when the upstream quote is not linked', async () => {
    const mapper = new EmporixQuoteMapper(siteService as never);

    const result = await mapper.mapToService(buildQuote());

    expect(result.orderId).toBeUndefined();
  });

  it('preserves gross and net item prices', async () => {
    const mapper = new EmporixQuoteMapper(siteService as never);

    const result = await mapper.mapToService(
      buildQuote({
        items: [
          {
            id: 'item-1',
            quantity: { quantity: 1, unitCode: 'pc' },
            price: {
              priceId: 'price-1',
              unitPrice: 130,
              totalNetValue: 130,
              tax: {
                taxClass: 'STANDARD',
                taxRate: 19,
                prices: { grossValue: 154.7, netValue: 130 },
              },
            },
            product: { productId: 'product-1' },
          },
        ],
      }),
    );

    expect(result.items[0].product.itemPrice).toMatchObject({
      amount: 154.7,
      grossValue: 154.7,
      netValue: 130,
      currency: 'EUR',
    });
  });

  it('maps reference and userComment from top-level fields (customerReference/customerComment)', async () => {
    const mapper = new EmporixQuoteMapper(siteService as never);

    const result = await mapper.mapToService(
      buildQuote({
        customerReference: 'TOP-123',
        customerComment: 'top-level comment',
        mixins: {
          additionalInfo: {
            reference: 'MIXIN-123',
            userComment: 'mixin comment',
          },
        },
      }),
    );

    expect(result.reference).toBe('TOP-123');
    expect(result.userComment).toBe('top-level comment');
  });

  it('falls back to mixins for reference and userComment if top-level fields are missing', async () => {
    const mapper = new EmporixQuoteMapper(siteService as never);

    const result = await mapper.mapToService(
      buildQuote({
        mixins: {
          additionalInfo: {
            reference: 'MIXIN-123',
            userComment: 'mixin comment',
          },
        },
      }),
    );

    expect(result.reference).toBe('MIXIN-123');
    expect(result.userComment).toBe('mixin comment');
  });
});
