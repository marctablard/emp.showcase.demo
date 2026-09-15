import type { EmporixCart } from '@/platform/integrations/emporix/model/cart';
import { EmporixCartMapper } from './EmporixCartMapper';

/** Live cart payload shape (DE, shipping tax 0, final gross 82.3). */
function showcaseDevCart(overrides: Partial<EmporixCart['calculatedPrice']> = {}): EmporixCart {
  return {
    id: '6a73439ecda403271df7b27e',
    customerId: '69874565',
    currency: 'EUR',
    legalEntityId: '698b29ea9932943fe6de45a9',
    siteCode: 'main',
    items: [
      {
        id: '0',
        itemYrn: 'urn:yaas:saasag:caasproduct:product:showcasedev;6a0c0ac38793283a1ebfa888',
        quantity: 3,
        product: {
          id: '6a0c0ac38793283a1ebfa888',
          localizedName: { en: 'rName enxzcxxrdxxxcs' },
          images: [{ id: 'img-1', url: 'https://cdn.example.com/product.jpg' }],
        },
        calculatedPrice: {
          price: {
            netValue: 69.15,
            grossValue: 82.29,
            taxValue: 13.14,
            taxCode: 'STANDARD',
            taxRate: 19,
          },
          finalPrice: {
            netValue: 69.15,
            grossValue: 82.29,
            taxValue: 13.14,
            taxCode: 'STANDARD',
            taxRate: 19,
          },
        },
      },
    ],
    calculatedPrice: {
      price: {
        netValue: 69.15,
        grossValue: 82.29,
        taxValue: 13.14,
        taxCode: 'STANDARD',
        taxRate: 19,
      },
      shipping: {
        netValue: 0.01,
        grossValue: 0.01,
        taxValue: 0,
        taxCode: 'ZERO',
        taxRate: 0,
      },
      totalShipping: {
        netValue: 0.01,
        grossValue: 0.01,
        taxValue: 0,
        taxCode: 'ZERO',
        taxRate: 0,
      },
      finalPrice: {
        netValue: 69.16,
        grossValue: 82.3,
        taxValue: 13.14,
        taxCode: 'STANDARD',
        taxRate: 19,
      },
      ...overrides,
    },
  } as EmporixCart;
}

/** OpenAPI cart GET example: `discounts[].id: '0'`, `code: LS10PTOTAL`, no `discountIndex`. */
function ls10pTotalOpenApiCart(): EmporixCart {
  return {
    id: '612c9ae63cff1d66f699b691',
    currency: 'EUR',
    siteCode: 'main',
    discounts: [
      {
        id: '0',
        code: 'LS10PTOTAL',
        name: 'LS10PTOTAL',
        currency: 'EUR',
        discountRate: 10,
        valid: true,
      },
    ],
    calculatedPrice: {
      price: {
        netValue: 100,
        grossValue: 110,
        taxValue: 10,
        taxCode: 'STANDARD',
        taxRate: 10,
      },
      discountedPrice: {
        netValue: 90,
        grossValue: 99,
        taxValue: 9,
        taxCode: 'STANDARD',
        taxRate: 10,
      },
      totalDiscount: {
        calculationType: 'ApplyDiscountBeforeTax',
        value: 11.22,
        appliedDiscounts: [
          {
            id: 'LS10PTOTAL',
            value: 11.22,
            discountType: 'PERCENT',
            origin: 'INTERNAL',
          },
        ],
      },
      totalShipping: {
        netValue: 6.5,
        grossValue: 6.955,
        taxValue: 0.455,
        taxCode: 'REDUCED',
        taxRate: 7,
      },
      finalPrice: {
        netValue: 101,
        grossValue: 110.455,
        taxValue: 9.455,
        taxCode: 'STANDARD',
        taxRate: 10,
      },
    },
  } as EmporixCart;
}

describe('EmporixCartMapper', () => {
  const mapper = new EmporixCartMapper();

  it('maps finalPrice as the cart total and shipping net/tax from calculatedPrice', () => {
    const mapped = mapper.mapToService(showcaseDevCart());

    expect(mapped.totalPrice.amount).toBe(82.3);
    expect(mapped.totalPrice.tax?.netValue).toBe(69.16);
    expect(mapped.totalPrice.tax?.grossValue).toBe(82.3);
    expect(mapped.subTotalPrice.amount).toBe(82.29);
    expect(mapped.tax.amount).toBe(13.14);
    expect(mapped.tax.netValue).toBe(69.15);
    expect(mapped.shippingCosts?.amount).toBe(0.01);
    expect(mapped.shippingCosts?.tax?.amount).toBe(0);
    expect(mapped.shippingCosts?.tax?.taxCode).toBe('ZERO');
    expect(mapped.shippingCosts?.tax?.taxRate).toBe(0);
    expect(mapped.discounts).toBeUndefined();
    expect(mapped.savingsTotal).toBeUndefined();
    expect(mapped.totalDiscountCalculationType).toBeUndefined();
    expect(mapped.includesTax).toBeUndefined();
    expect(mapped.goodsDiscountedNet).toBeUndefined();
    expect(mapped.goodsDiscountedVat).toBeUndefined();
    expect(mapped.goodsDiscountedGross).toBeUndefined();
  });

  it('uses array position when discountIndex is omitted even if id is a numeric coupon id', () => {
    const mapped = mapper.mapToService({
      ...ls10pTotalOpenApiCart(),
      discounts: [
        {
          id: '42',
          code: 'LS10PTOTAL',
          name: 'LS10PTOTAL',
          currency: 'EUR',
          discountRate: 10,
          valid: true,
        },
      ],
    } as EmporixCart);

    expect(mapped.discounts).toEqual([
      {
        code: 'LS10PTOTAL',
        name: 'LS10PTOTAL',
        discountIndex: 0,
        amount: 11.22,
        currency: 'EUR',
        type: 'PERCENT',
      },
    ]);
  });

  it('skips valid:false discounts and keeps the original discounts[] index for DELETE', () => {
    const mapped = mapper.mapToService({
      ...ls10pTotalOpenApiCart(),
      discounts: [
        {
          id: 'stale',
          code: 'STALE10',
          name: 'STALE10',
          currency: 'EUR',
          valid: false,
        },
        {
          id: '1',
          code: 'LS10PTOTAL',
          name: 'LS10PTOTAL',
          currency: 'EUR',
          discountRate: 10,
          valid: true,
        },
      ],
    } as EmporixCart);

    expect(mapped.discounts).toEqual([
      {
        code: 'LS10PTOTAL',
        name: 'LS10PTOTAL',
        discountIndex: 1,
        amount: 11.22,
        currency: 'EUR',
        type: 'PERCENT',
      },
    ]);
  });

  it('maps LS10PTOTAL OpenAPI GET chips without discountIndex to domain index 0', () => {
    const mapped = mapper.mapToService(ls10pTotalOpenApiCart());

    expect(mapped.discounts).toEqual([
      {
        code: 'LS10PTOTAL',
        name: 'LS10PTOTAL',
        discountIndex: 0,
        amount: 11.22,
        currency: 'EUR',
        type: 'PERCENT',
      },
    ]);
    expect(mapped.savingsTotal).toBe(11.22);
    expect(mapped.totalDiscountCalculationType).toBe('ApplyDiscountBeforeTax');
    expect(mapped.includesTax).toBe(false);
    expect(mapped.goodsDiscountedNet).toBe(90);
    expect(mapped.goodsDiscountedVat).toBe(9);
    expect(mapped.goodsDiscountedGross).toBe(99);
    expect(mapped.totalPrice.amount).toBe(110.455);
    expect(mapped.tax.netValue).toBe(100);
    expect(mapped.subTotalPrice.amount).toBe(110);
    expect(mapped.shippingCosts?.amount).toBe(6.5);
  });

  it('does not build removable chips from appliedDiscounts when discounts[] is empty', () => {
    const mapped = mapper.mapToService(
      showcaseDevCart({
        totalDiscount: {
          calculationType: 'ApplyDiscountBeforeTax',
          value: 6.915,
          appliedDiscounts: [
            {
              id: 'LS10PTOTAL',
              value: 6.915,
              discountType: 'PERCENT',
              origin: 'INTERNAL',
            },
            {
              id: 'external-price-rule',
              value: 1,
              discountType: 'ABSOLUTE',
              origin: 'EXTERNAL',
            },
          ],
        },
      }),
    );

    expect(mapped.discounts).toBeUndefined();
    expect(mapped.savingsTotal).toBe(6.915);
    expect(mapped.totalDiscountCalculationType).toBe('ApplyDiscountBeforeTax');
    expect(mapped.includesTax).toBe(false);
    expect(mapped.goodsDiscountedGross).toBeUndefined();
    expect(mapped.tax.netValue).toBe(69.15);
    expect(mapped.totalPrice.amount).toBe(82.3);
  });

  it('maps ApplyDiscountAfterTax to includesTax true and discounted gross', () => {
    const mapped = mapper.mapToService(
      showcaseDevCart({
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
          appliedDiscounts: [
            {
              id: 'GROSS10',
              value: 8.22,
              discountType: 'PERCENT',
              origin: 'INTERNAL',
            },
          ],
        },
      }),
    );

    expect(mapped.totalDiscountCalculationType).toBe('ApplyDiscountAfterTax');
    expect(mapped.includesTax).toBe(true);
    expect(mapped.goodsDiscountedGross).toBe(74.07);
    expect(mapped.goodsDiscountedNet).toBe(58.235);
    expect(mapped.goodsDiscountedVat).toBe(13.14);
    expect(mapped.savingsTotal).toBe(8.22);
  });

  it('prefers totalShipping over shipping when both are present', () => {
    const mapped = mapper.mapToService(
      showcaseDevCart({
        shipping: {
          netValue: 7.22,
          grossValue: 7.725,
          taxValue: 0.505,
          taxCode: 'REDUCED',
          taxRate: 7,
        },
        totalShipping: {
          netValue: 6.355,
          grossValue: 6.8,
          taxValue: 0.445,
          taxCode: 'REDUCED',
          taxRate: 7,
        },
      }),
    );

    expect(mapped.shippingCosts?.amount).toBe(6.355);
    expect(mapped.shippingCosts?.tax?.amount).toBe(0.445);
    expect(mapped.shippingCosts?.tax?.grossValue).toBe(6.8);
  });

  it('does not flag freeShipping for a regular cart', () => {
    expect(mapper.mapToService(showcaseDevCart()).freeShipping).toBeUndefined();
  });

  it('flags freeShipping from a FREE_SHIPPING applied discount', () => {
    const mapped = mapper.mapToService(
      showcaseDevCart({
        totalDiscount: {
          calculationType: 'ApplyDiscountBeforeTax',
          value: 4.95,
          appliedDiscounts: [{ id: 'FREESHIP', value: 4.95, discountType: 'FREE_SHIPPING', origin: 'INTERNAL' }],
        },
      }),
    );

    expect(mapped.freeShipping).toBe(true);
  });

  it('types a free-shipping chip from the shipping applied discounts', () => {
    const mapped = mapper.mapToService({
      ...showcaseDevCart({
        shipping: {
          netValue: 4.95,
          grossValue: 4.95,
          taxValue: 0,
          taxCode: 'ZERO',
          taxRate: 0,
          appliedDiscounts: [{ id: 'VKTEST-PROMO03', value: 4.95, discountType: 'FREE_SHIPPING', origin: 'INTERNAL' }],
        },
        totalShipping: { netValue: 0, grossValue: 0, taxValue: 0, taxCode: 'ZERO', taxRate: 0 },
      }),
      discounts: [{ code: 'VKTEST-PROMO03', name: 'Free shipping over 100', discountIndex: 0, valid: true }],
    } as EmporixCart);

    expect(mapped.freeShipping).toBe(true);
    expect(mapped.discounts).toEqual([
      {
        code: 'VKTEST-PROMO03',
        name: 'Free shipping over 100',
        discountIndex: 0,
        amount: 4.95,
        currency: 'EUR',
        type: 'FREE_SHIPPING',
      },
    ]);
  });

  it('types a chip from totalShipping applied discounts and leaves unmatched chips untyped', () => {
    const mapped = mapper.mapToService({
      ...showcaseDevCart({
        totalShipping: {
          netValue: 0,
          grossValue: 0,
          taxValue: 0,
          taxCode: 'ZERO',
          taxRate: 0,
          appliedDiscounts: [{ id: 'SHIPFREE', value: 6.8, discountType: 'FREE_SHIPPING', origin: 'INTERNAL' }],
        },
      }),
      discounts: [
        { code: 'SHIPFREE', discountIndex: 0, valid: true },
        { code: 'UNMATCHED', discountIndex: 1, amount: 3, valid: true },
      ],
    } as EmporixCart);

    expect(mapped.discounts?.[0]).toMatchObject({ code: 'SHIPFREE', amount: 6.8, type: 'FREE_SHIPPING' });
    expect(mapped.discounts?.[1]).toEqual({
      code: 'UNMATCHED',
      name: undefined,
      discountIndex: 1,
      amount: 3,
      currency: 'EUR',
    });
    expect(mapped.discounts?.[1]).not.toHaveProperty('type');
  });

  it('flags freeShipping when totalShipping is zeroed against a non-zero pre-discount shipping', () => {
    const mapped = mapper.mapToService(
      showcaseDevCart({
        shipping: { netValue: 4.95, grossValue: 4.95, taxValue: 0, taxCode: 'ZERO', taxRate: 0 },
        totalShipping: { netValue: 0, grossValue: 0, taxValue: 0, taxCode: 'ZERO', taxRate: 0 },
      }),
    );

    expect(mapped.freeShipping).toBe(true);
    expect(mapped.shippingCosts?.amount).toBe(0);
  });

  it('does not flag freeShipping when shipping is simply zero everywhere', () => {
    const mapped = mapper.mapToService(
      showcaseDevCart({
        shipping: { netValue: 0, grossValue: 0, taxValue: 0, taxCode: 'ZERO', taxRate: 0 },
        totalShipping: { netValue: 0, grossValue: 0, taxValue: 0, taxCode: 'ZERO', taxRate: 0 },
      }),
    );

    expect(mapped.freeShipping).toBeUndefined();
  });

  it('falls back to shipping when totalShipping is absent', () => {
    const mapped = mapper.mapToService(
      showcaseDevCart({
        totalShipping: undefined,
        shipping: {
          netValue: 20,
          grossValue: 21.54,
          taxValue: 1.54,
          taxCode: 'STANDARD',
          taxRate: 7.7,
        },
      }),
    );

    expect(mapped.shippingCosts?.amount).toBe(20);
    expect(mapped.shippingCosts?.tax?.amount).toBe(1.54);
    expect(mapped.shippingCosts?.tax?.taxRate).toBe(7.7);
  });
});
