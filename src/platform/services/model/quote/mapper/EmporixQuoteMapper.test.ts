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
});
