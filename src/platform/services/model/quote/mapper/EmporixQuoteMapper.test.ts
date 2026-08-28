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
      unitPrice: 130,
    });
  });

  it('maps subtotalPrice into subtotalNet/subtotalVat for Quoted Price goods-only display', async () => {
    const mapper = new EmporixQuoteMapper(siteService as never);

    const result = await mapper.mapToService(
      buildQuote({
        totalPrice: {
          currency: 'USD',
          netValue: 767.9,
          grossValue: 900.72,
          taxValue: 143.82,
        },
        subtotalPrice: {
          currency: 'USD',
          netValue: 756.9,
          grossValue: 900.72,
          taxValue: 143.82,
        },
        shipping: { value: 11 },
      }),
    );

    expect(result.totalNet).toBe(767.9);
    expect(result.subtotalNet).toBe(756.9);
    expect(result.subtotalVat).toBe(143.82);
    expect(result.shippingCost).toBe(11);
  });

  it('maps shipping.grossValue for Quoted Price shipping tax', async () => {
    const mapper = new EmporixQuoteMapper(siteService as never);

    const result = await mapper.mapToService(
      buildQuote({
        shipping: { value: 11, grossValue: 13.09 },
      }),
    );

    expect(result.shippingCost).toBe(11);
    expect(result.shippingGross).toBe(13.09);
  });

  it('maps unitPrice, newUnitPrice, discount and taxRate for base/quoted display', async () => {
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
              newUnitPrice: 84.5,
              discount: 35,
              totalNetValue: 84.5,
              tax: {
                taxClass: 'STANDARD',
                taxRate: 19,
                prices: { grossValue: 100.56, netValue: 84.5 },
              },
            },
            product: { productId: 'product-1' },
          },
        ],
      }),
    );

    expect(result.items[0].product.itemPrice).toMatchObject({
      unitPrice: 130,
      newUnitPrice: 84.5,
      discount: 35,
      taxRate: 19,
      netValue: 84.5,
      grossValue: 100.56,
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

  it('maps a single taxAggregate rate to vatRate', async () => {
    const mapper = new EmporixQuoteMapper(siteService as never);

    const result = await mapper.mapToService(
      buildQuote({
        taxAggregate: {
          lines: [{ name: 'STANDARD', amount: 36.09, rate: 19, taxable: 226.04 }],
        },
      }),
    );

    expect(result.vatRate).toBe(19);
    expect(result.taxAggregate?.lines).toHaveLength(1);
  });

  it('leaves vatRate undefined when taxAggregate mixes STANDARD and REDUCED', async () => {
    const mapper = new EmporixQuoteMapper(siteService as never);

    const result = await mapper.mapToService(
      buildQuote({
        taxAggregate: {
          lines: [
            { name: 'STANDARD', amount: 31.35, rate: 19, taxable: 196.35 },
            { name: 'REDUCED', amount: 545.79, rate: 7, taxable: 8342.79 },
          ],
        },
      }),
    );

    expect(result.vatRate).toBeUndefined();
  });

  it('falls back to first taxAggregate line rate when STANDARD is absent', async () => {
    const mapper = new EmporixQuoteMapper(siteService as never);

    const result = await mapper.mapToService(
      buildQuote({
        taxAggregate: {
          lines: [{ name: 'REDUCED', amount: 1, rate: 7, taxable: 14 }],
        },
      }),
    );

    expect(result.vatRate).toBe(7);
  });

  it('leaves vatRate undefined when taxAggregate is absent', async () => {
    const mapper = new EmporixQuoteMapper(siteService as never);

    const result = await mapper.mapToService(buildQuote());

    expect(result.vatRate).toBeUndefined();
  });

  it('prefers localized shipping methodName over methodId', async () => {
    const mapper = new EmporixQuoteMapper(siteService as never);

    const result = await mapper.mapToService(
      buildQuote({
        shipping: {
          value: 9.5,
          methodId: 'dhl-standard',
          methodName: { de: 'DHL Standard', en: 'DHL Standard' },
        },
      }),
    );

    expect(result.shippingMethod).toBe('DHL Standard');
    expect(result.shippingCost).toBe(9.5);
  });

  it('falls back to shipping methodId when methodName is absent', async () => {
    const mapper = new EmporixQuoteMapper(siteService as never);

    const result = await mapper.mapToService(
      buildQuote({
        shipping: {
          value: 5,
          methodId: 'pickup',
        },
      }),
    );

    expect(result.shippingMethod).toBe('pickup');
  });

  it('omits missing addressLine2 from street (no literal undefined)', async () => {
    const mapper = new EmporixQuoteMapper(siteService as never);

    const result = await mapper.mapToService(
      buildQuote({
        shippingAddress: {
          id: 'shipping-1',
          name: 'Vitalii Buyer',
          addressLine1: 'Hauptstraße 123',
          city: 'Berlin',
          countryCode: 'DE',
          postcode: '10115',
        },
      }),
    );

    expect(result.shippingAddress.street).toBe('Hauptstraße 123');
    expect(result.shippingAddress.street).not.toContain('undefined');
    expect(result.shippingAddress.contactName).toBe('Vitalii Buyer');
    expect(result.shippingAddress.zipCode).toBe('10115');
  });

  it('joins addressLine1 and addressLine2 when both are present', async () => {
    const mapper = new EmporixQuoteMapper(siteService as never);

    const result = await mapper.mapToService(
      buildQuote({
        shippingAddress: {
          id: 'shipping-1',
          name: 'Vitalii Buyer',
          addressLine1: 'Hauptstraße',
          addressLine2: '123',
          city: 'Berlin',
          countryCode: 'DE',
          postcode: '10115',
        },
      }),
    );

    expect(result.shippingAddress.street).toBe('Hauptstraße 123');
  });
});
