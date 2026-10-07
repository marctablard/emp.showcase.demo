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

  it('maps siteCode from the upstream order', () => {
    const result = mapper.mapToService(
      buildOrder({
        siteCode: 'main',
      }),
    );

    expect(result.siteCode).toBe('main');
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

  it('omits goods taxRate when line items mix VAT rates', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        entries: [
          { itemYrn: 'yrn:item:a', calculatedPrice: { price: { taxRate: 19 } } },
          { itemYrn: 'yrn:item:b', calculatedPrice: { price: { taxRate: 7 } } },
        ] as never,
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

  it('keeps goods taxRate from items when taxAggregate also includes shipping', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        entries: [{ itemYrn: 'yrn:item:solar', calculatedPrice: { price: { taxRate: 7.7 } } }] as never,
        taxAggregate: {
          lines: [
            { name: 'STANDARD', rate: 7.7, amount: 7.7, taxable: 100 },
            { name: 'REDUCED_3', rate: 3.7, amount: 0.74, taxable: 20 },
          ],
        },
        calculatedPrice: {
          price: { netValue: 100, grossValue: 107.7, taxValue: 7.7, taxRate: 7.7 },
          finalPrice: { netValue: 120, grossValue: 128.44, taxValue: 8.44 },
        },
      }),
    );

    expect(result.price?.subtotal.taxRate).toBe(7.7);
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

  it('omits published coupon fields when the upstream order has no discounts', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        calculatedPrice: {
          price: { netValue: 100, grossValue: 119, taxValue: 19 },
          finalPrice: { netValue: 115, grossValue: 136.85, taxValue: 21.85 },
        },
      }),
    );

    expect(result.discounts).toBeUndefined();
    expect(result.savingsTotal).toBeUndefined();
    expect(result.totalDiscountCalculationType).toBeUndefined();
    expect(result.includesTax).toBeUndefined();
    expect(result.goodsDiscountedNet).toBeUndefined();
    expect(result.goodsDiscountedVat).toBeUndefined();
    expect(result.goodsDiscountedGross).toBeUndefined();
    expect(result).not.toHaveProperty('discountCalculationType');
  });

  it('maps before-tax totalDiscount, coupon codes, and discounted goods', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        discounts: [
          { code: 'TOTAL', amount: 101.1, currency: 'EUR', sequenceId: 1 },
          {
            code: '10POFF',
            amount: 101.1,
            currency: 'EUR',
            calculationType: 'ApplyDiscountBeforeTax',
          },
        ],
        calculatedPrice: {
          price: { netValue: 1010.99, grossValue: 1203.08, taxValue: 192.09, taxCode: 'STANDARD', taxRate: 19 },
          discountedPrice: {
            netValue: 909.89,
            grossValue: 1082.77,
            taxValue: 172.88,
            taxCode: 'STANDARD',
            taxRate: 19,
          },
          totalDiscount: {
            calculationType: 'ApplyDiscountBeforeTax',
            value: 101.1,
            appliedDiscounts: [{ id: '10POFF', value: 101.1 }],
          },
          finalPrice: { netValue: 909.89, grossValue: 1082.77, taxValue: 172.88 },
        },
      }),
    );

    expect(result.discounts?.map((discount) => discount.code)).toEqual(['TOTAL', '10POFF']);
    expect(result.savingsTotal).toBe(101.1);
    expect(result.totalDiscountCalculationType).toBe('ApplyDiscountBeforeTax');
    expect(result.includesTax).toBe(false);
    expect(result.goodsDiscountedNet).toBe(909.89);
    expect(result.goodsDiscountedVat).toBe(172.88);
    expect(result.goodsDiscountedGross).toBe(1082.77);
    expect(result).not.toHaveProperty('discountCalculationType');
  });

  it('maps after-tax totalDiscount and discounted gross', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        discounts: [
          {
            code: 'GROSS10',
            amount: 8.22,
            currency: 'EUR',
            calculationType: 'ApplyDiscountAfterTax',
          },
        ],
        calculatedPrice: {
          price: { netValue: 69.15, grossValue: 82.29, taxValue: 13.14, taxCode: 'STANDARD', taxRate: 19 },
          discountedPrice: {
            netValue: 58.235,
            grossValue: 74.07,
            taxValue: 13.14,
            taxCode: 'STANDARD',
            taxRate: 19,
          },
          totalDiscount: {
            calculationType: 'ApplyDiscountAfterTax',
            value: 8.22,
            appliedDiscounts: [{ id: 'GROSS10', value: 8.22 }],
          },
          finalPrice: { netValue: 58.235, grossValue: 74.07, taxValue: 13.14 },
        },
      }),
    );

    expect(result.discounts).toEqual([{ code: 'GROSS10', value: 8.22, currency: 'EUR' }]);
    expect(result.savingsTotal).toBe(8.22);
    expect(result.totalDiscountCalculationType).toBe('ApplyDiscountAfterTax');
    expect(result.includesTax).toBe(true);
    expect(result.goodsDiscountedGross).toBe(74.07);
    expect(result.goodsDiscountedNet).toBe(58.235);
    expect(result.goodsDiscountedVat).toBe(13.14);
  });

  it('maps FREE_SHIPPING from the published discount type even when amount is 0', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        discounts: [{ code: 'VKTEST-COUPON05', amount: 0, currency: 'EUR', discountType: 'FREE_SHIPPING' }],
        calculatedPrice: {
          price: { netValue: 100, grossValue: 119, taxValue: 19 },
          finalPrice: { netValue: 100, grossValue: 119, taxValue: 19 },
          totalShipping: { netValue: 0, grossValue: 0, taxValue: 0 },
        },
      }),
    );

    expect(result.discounts).toEqual([{ code: 'VKTEST-COUPON05', value: 0, currency: 'EUR', type: 'FREE_SHIPPING' }]);
  });

  it('resolves FREE_SHIPPING from totalShipping appliedDiscounts when the discount row omits type', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        discounts: [{ code: 'VKTEST-COUPON05', amount: 0, currency: 'EUR' }],
        calculatedPrice: {
          price: { netValue: 100, grossValue: 119, taxValue: 19 },
          finalPrice: { netValue: 100, grossValue: 119, taxValue: 19 },
          totalShipping: {
            netValue: 0,
            grossValue: 0,
            appliedDiscounts: [{ id: 'VKTEST-COUPON05', value: 4.95, discountType: 'FREE_SHIPPING' }],
          },
        },
      }),
    );

    expect(result.discounts?.[0]).toMatchObject({
      code: 'VKTEST-COUPON05',
      value: 0,
      type: 'FREE_SHIPPING',
    });
  });

  it('uses the first applied row that has a recognized type, not a typeless earlier match', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        discounts: [{ code: 'VKTEST-COUPON05', amount: 0, currency: 'EUR' }],
        calculatedPrice: {
          price: { netValue: 100, grossValue: 119, taxValue: 19 },
          finalPrice: { netValue: 100, grossValue: 119, taxValue: 19 },
          totalShipping: {
            netValue: 0,
            grossValue: 0,
            appliedDiscounts: [{ id: 'VKTEST-COUPON05', value: 0 }],
          },
          totalDiscount: {
            value: 0,
            appliedDiscounts: [{ id: 'VKTEST-COUPON05', value: 4.95, discountType: 'FREE_SHIPPING' }],
          },
        },
      }),
    );

    expect(result.discounts?.[0]).toMatchObject({
      code: 'VKTEST-COUPON05',
      type: 'FREE_SHIPPING',
    });
  });

  it('falls back to discount name when description is missing', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        discounts: [{ code: '10POFF', amount: 10, currency: 'EUR', name: '10 percent off' }],
        calculatedPrice: {
          price: { netValue: 100, grossValue: 119, taxValue: 19 },
          finalPrice: { netValue: 90, grossValue: 107.1, taxValue: 17.1 },
        },
      }),
    );

    expect(result.discounts?.[0]?.description).toBe('10 percent off');
  });

  it('prefers the totalDiscount applied value when shipping also has a matching row', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        discounts: [{ code: 'MIXED', currency: 'EUR' }],
        calculatedPrice: {
          price: { netValue: 1010.99, grossValue: 1203.08, taxValue: 192.09 },
          finalPrice: { netValue: 909.89, grossValue: 1082.77, taxValue: 172.88 },
          totalDiscount: {
            value: 101.1,
            appliedDiscounts: [{ id: 'MIXED', value: 101.1, discountType: 'PERCENT' }],
          },
          totalShipping: {
            netValue: 0,
            grossValue: 0,
            taxValue: 0,
            appliedDiscounts: [{ id: 'MIXED', value: 4.95, discountType: 'FREE_SHIPPING' }],
          },
        },
      }),
    );

    expect(result.discounts?.[0]).toMatchObject({
      code: 'MIXED',
      value: 101.1,
      type: 'PERCENT',
    });
  });

  it('fills a missing coupon amount from an id-less applied row when it is the sole shopper coupon', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        discounts: [{ code: 'FREESHIP', currency: 'EUR' }],
        calculatedPrice: {
          price: { netValue: 100, grossValue: 119, taxValue: 19 },
          finalPrice: { netValue: 100, grossValue: 119, taxValue: 19 },
          totalShipping: {
            netValue: 0,
            grossValue: 0,
            appliedDiscounts: [{ value: 4.95, discountType: 'FREE_SHIPPING' }],
          },
        },
      }),
    );

    expect(result.discounts?.[0]).toMatchObject({
      code: 'FREESHIP',
      value: 4.95,
      type: 'FREE_SHIPPING',
    });
  });

  it('reads FREE_SHIPPING type from a shipping row when the aggregate row has no discountType', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        discounts: [{ code: 'FREESHIP', amount: 0, currency: 'EUR' }],
        calculatedPrice: {
          price: { netValue: 100, grossValue: 119, taxValue: 19 },
          finalPrice: { netValue: 100, grossValue: 119, taxValue: 19 },
          totalDiscount: {
            value: 4.95,
            appliedDiscounts: [{ id: 'FREESHIP', value: 4.95 }],
          },
          totalShipping: {
            netValue: 0,
            grossValue: 0,
            taxValue: 0,
            appliedDiscounts: [{ id: 'FREESHIP', value: 4.95, discountType: 'FREE_SHIPPING' }],
          },
        },
      }),
    );

    expect(result.discounts?.[0]).toMatchObject({
      code: 'FREESHIP',
      type: 'FREE_SHIPPING',
    });
  });

  it('sums goods and shipping component rows when totalDiscount is omitted', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        discounts: [{ code: 'MIXED', currency: 'EUR' }],
        calculatedPrice: {
          price: { netValue: 1010.99, grossValue: 1203.08, taxValue: 192.09 },
          finalPrice: { netValue: 909.89, grossValue: 1082.77, taxValue: 172.88 },
          discountedPrice: {
            netValue: 909.89,
            grossValue: 1082.77,
            taxValue: 172.88,
            appliedDiscounts: [{ id: 'MIXED', value: 101.1, discountType: 'PERCENT' }],
          },
          totalShipping: {
            netValue: 0,
            grossValue: 0,
            taxValue: 0,
            appliedDiscounts: [{ id: 'MIXED', value: 4.95, discountType: 'FREE_SHIPPING' }],
          },
        },
      }),
    );

    expect(result.discounts?.[0]).toMatchObject({
      code: 'MIXED',
      value: 106.05,
    });
  });

  it('fills a missing coupon amount from discountedPrice.appliedDiscounts when totals omit the row', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        discounts: [{ code: 'GOODS10', currency: 'EUR' }],
        calculatedPrice: {
          price: { netValue: 100, grossValue: 119, taxValue: 19 },
          finalPrice: { netValue: 90, grossValue: 107.1, taxValue: 17.1 },
          discountedPrice: {
            netValue: 90,
            grossValue: 107.1,
            taxValue: 17.1,
            appliedDiscounts: [{ id: 'GOODS10', value: 10, discountType: 'PERCENT', origin: 'INTERNAL' }],
          },
        },
      }),
    );

    expect(result.discounts?.[0]).toMatchObject({
      code: 'GOODS10',
      value: 10,
      type: 'PERCENT',
    });
  });

  it('fills a missing coupon amount from totalFee.appliedDiscounts when totals omit the row', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        discounts: [{ code: 'FEE5', currency: 'EUR' }],
        calculatedPrice: {
          price: { netValue: 100, grossValue: 119, taxValue: 19 },
          finalPrice: { netValue: 100, grossValue: 119, taxValue: 19 },
          totalFee: {
            netValue: 0,
            grossValue: 0,
            appliedDiscounts: [{ id: 'FEE5', value: 5, discountType: 'ABSOLUTE', origin: 'INTERNAL' }],
          },
        },
      }),
    );

    expect(result.discounts?.[0]).toMatchObject({
      code: 'FEE5',
      value: 5,
      type: 'ABSOLUTE',
    });
  });

  it('does not infer an id-less EXTERNAL applied row onto the sole shopper coupon', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        discounts: [{ code: 'FREESHIP', currency: 'EUR' }],
        calculatedPrice: {
          price: { netValue: 100, grossValue: 119, taxValue: 19 },
          finalPrice: { netValue: 100, grossValue: 119, taxValue: 19 },
          totalShipping: {
            netValue: 0,
            grossValue: 0,
            appliedDiscounts: [{ value: 4.95, discountType: 'FREE_SHIPPING', origin: 'EXTERNAL' }],
          },
        },
      }),
    );

    expect(result.discounts?.[0]).toMatchObject({ code: 'FREESHIP', value: 0 });
    expect(result.discounts?.[0]).not.toHaveProperty('type');
  });

  it('does not guess an id-less applied row when multiple shopper coupons are present', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        discounts: [
          { code: 'GOODS10', currency: 'EUR' },
          { code: 'FREESHIP', currency: 'EUR' },
        ],
        calculatedPrice: {
          price: { netValue: 100, grossValue: 119, taxValue: 19 },
          finalPrice: { netValue: 90, grossValue: 107.1, taxValue: 17.1 },
          totalDiscount: {
            value: 14.95,
            appliedDiscounts: [{ value: 10, discountType: 'PERCENT' }],
          },
          totalShipping: {
            netValue: 0,
            grossValue: 0,
            appliedDiscounts: [{ value: 4.95, discountType: 'FREE_SHIPPING' }],
          },
        },
      }),
    );

    expect(result.discounts?.[0]).toMatchObject({ code: 'GOODS10', value: 0 });
    expect(result.discounts?.[0]).not.toHaveProperty('type');
    expect(result.discounts?.[1]).toMatchObject({ code: 'FREESHIP', value: 0 });
    expect(result.discounts?.[1]).not.toHaveProperty('type');
  });

  it('fills a missing coupon amount from the calculated applied-discount value', () => {
    const result = mapper.mapToService(
      buildOrder({
        currency: 'EUR',
        discounts: [{ code: 'LS10PTOTAL', currency: 'EUR' }],
        calculatedPrice: {
          price: { netValue: 100, grossValue: 119, taxValue: 19 },
          finalPrice: { netValue: 90, grossValue: 107.1, taxValue: 17.1 },
          totalDiscount: {
            value: 10,
            appliedDiscounts: [{ id: 'LS10PTOTAL', value: 10, discountType: 'PERCENT' }],
          },
        },
      }),
    );

    expect(result.discounts?.[0]).toMatchObject({
      code: 'LS10PTOTAL',
      value: 10,
      type: 'PERCENT',
    });
  });
});
