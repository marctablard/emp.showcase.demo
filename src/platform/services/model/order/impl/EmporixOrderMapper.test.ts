import type { EmporixOrder } from '@/platform/integrations/emporix/model/order';
import EmporixOrderMapper from './EmporixOrderMapper';

describe('EmporixOrderMapper', () => {
  const mapper = new EmporixOrderMapper({} as never);

  const buildOrder = (overrides: Partial<EmporixOrder> = {}): EmporixOrder => ({
    id: 'order-1',
    quoteId: undefined,
    status: 'CREATED',
    entries: [],
    customer: {
      id: 'customer-1',
      email: 'customer@example.com',
    },
    ...overrides,
  });

  it('maps quoteId when the upstream order is linked to a quote', () => {
    const result = mapper.mapToService(
      buildOrder({
        quoteId: 'quote-123',
      }),
    );

    expect(result.quoteId).toBe('quote-123');
  });

  it('leaves quoteId undefined when the upstream order is not linked', () => {
    const result = mapper.mapToService(buildOrder());

    expect(result.quoteId).toBeUndefined();
  });

  it('maps expected delivery from the first shipment expectDeliveryOn when present', () => {
    const result = mapper.mapToService(
      buildOrder({
        shipments: [{}, { expectDeliveryOn: '2026-08-01' }, { expectDeliveryOn: '2026-09-01' }],
        deliveryWindow: { deliveryDate: '2026-10-01' },
      }),
    );

    expect(result.expectedDeliveryDate).toBe('2026-08-01');
  });

  it('falls back to top-level deliveryWindow.deliveryDate when shipment expectation is missing', () => {
    const result = mapper.mapToService(
      buildOrder({
        shipments: [{}],
        deliveryWindow: { deliveryDate: '2026-10-01' },
      }),
    );

    expect(result.expectedDeliveryDate).toBe('2026-10-01');
  });

  it('keeps expected delivery undefined when no documented source exists', () => {
    const result = mapper.mapToService(buildOrder({ shipments: [{}], deliveryWindow: {} }));

    expect(result.expectedDeliveryDate).toBeUndefined();
  });

  it('does not read undocumented shipments deliveryWindow deliveryDate', () => {
    const orderWithUndocumentedShipmentField = {
      ...buildOrder({ deliveryWindow: { deliveryDate: '2026-11-01' } }),
      shipments: [{ deliveryWindow: { deliveryDate: '2099-01-01' } }],
    } as unknown as EmporixOrder;

    const result = mapper.mapToService(orderWithUndocumentedShipmentField);

    expect(result.expectedDeliveryDate).toBe('2026-11-01');
  });

  it('does not map expected delivery back to source payload', () => {
    const source = mapper.mapToSource({
      id: 'order-1',
      status: 'CREATED',
      items: [],
      expectedDeliveryDate: '2026-08-01',
    });

    expect(source).not.toHaveProperty('expectedDeliveryDate');
    expect(source.shipments).toBeUndefined();
    expect(source.deliveryWindow).toBeUndefined();
  });

  it('maps shipping total from calculatedPrice.totalShipping.netValue when present', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        shipping: {
          total: { amount: 15, currency: 'EUR' },
        },
        calculatedPrice: {
          price: { netValue: 100, grossValue: 119, taxValue: 19 },
          finalPrice: { netValue: 115, grossValue: 136.85, taxValue: 21.85 },
          totalShipping: { netValue: 9, grossValue: 10.71, taxValue: 1.71 },
        },
      }),
    );

    expect(result.shipping?.total).toEqual({ value: 9, currency: 'EUR', tax: 1.71 });
  });

  it('omits shipping tax when calculatedPrice.totalShipping.taxValue is absent', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        shipping: {
          total: { amount: 15, currency: 'EUR' },
        },
        calculatedPrice: {
          price: { netValue: 100, grossValue: 119, taxValue: 19 },
          finalPrice: { netValue: 115, grossValue: 136.85, taxValue: 21.85 },
          totalShipping: { netValue: 9, grossValue: 10.71 },
        },
      }),
    );

    expect(result.shipping?.total).toEqual({ value: 9, currency: 'EUR' });
    expect(result.shipping?.total).not.toHaveProperty('tax');
  });

  it('maps shipping taxRate from calculatedPrice.totalShipping and goods taxRate from price', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        shipping: {
          total: { amount: 3.45, currency: 'EUR' },
          lines: [
            {
              code: 'pickup',
              name: 'Pickup',
              amount: 3.45,
              currency: 'EUR',
              tax: { rate: 0, total: { amount: 0, currency: 'EUR', inclusive: false } },
              shippingTaxCode: 'ZERO',
            },
          ],
        },
        calculatedPrice: {
          price: { netValue: 330, grossValue: 392.7, taxValue: 62.7, taxRate: 19 },
          finalPrice: { netValue: 333.45, grossValue: 396.15, taxValue: 62.7 },
          totalShipping: { netValue: 3.45, grossValue: 3.45, taxValue: 0, taxRate: 0 },
        },
      }),
    );

    expect(result.shipping?.total).toEqual({ value: 3.45, currency: 'EUR', tax: 0, taxRate: 0 });
    expect(result.price?.subtotal).toMatchObject({ tax: 62.7, taxRate: 19 });
  });

  it('omits goods taxRate when taxAggregate or line items mix VAT rates', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        taxAggregate: {
          lines: [
            { name: 'STANDARD', rate: 19, amount: 31.35, taxable: 196.35 },
            { name: 'REDUCED', rate: 7, amount: 545.79, taxable: 8342.79 },
          ],
        },
        calculatedPrice: {
          price: { netValue: 7942, grossValue: 8517.74, taxValue: 575.74, taxRate: 7 },
          finalPrice: { netValue: 7962, grossValue: 8537.74, taxValue: 575.74 },
        },
      }),
    );

    expect(result.price?.subtotal.tax).toBe(575.74);
    expect(result.price?.subtotal.taxRate).toBeUndefined();
  });

  it('falls back to shipping line tax.rate when totalShipping.taxRate is absent', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        shipping: {
          total: { amount: 10, currency: 'EUR' },
          lines: [{ code: 'std', amount: 10, currency: 'EUR', tax: { rate: 19 } }],
        },
        calculatedPrice: {
          price: { netValue: 100, grossValue: 119, taxValue: 19 },
          finalPrice: { netValue: 110, grossValue: 130.9, taxValue: 20.9 },
          totalShipping: { netValue: 10, grossValue: 11.9, taxValue: 1.9 },
        },
      }),
    );

    expect(result.shipping?.total).toEqual({ value: 10, currency: 'EUR', tax: 1.9, taxRate: 19 });
  });

  it('falls back to shipping.total.amount when calculatedPrice.totalShipping is missing', () => {
    const result = mapper.mapToService(
      buildOrder({
        shipping: {
          total: { amount: 15, currency: 'EUR' },
        },
        calculatedPrice: {
          price: { netValue: 100, grossValue: 119, taxValue: 19 },
          finalPrice: { netValue: 115, grossValue: 136.85, taxValue: 21.85 },
        },
      }),
    );

    expect(result.shipping?.total).toEqual({ value: 15, currency: 'EUR' });
  });
});
