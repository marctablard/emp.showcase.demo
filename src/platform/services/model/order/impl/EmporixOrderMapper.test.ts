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

    expect(result.shipping?.total).toEqual({ value: 9, currency: 'EUR' });
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
