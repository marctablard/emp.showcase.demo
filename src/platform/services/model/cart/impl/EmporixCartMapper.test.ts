import type { EmporixCart } from '@/platform/integrations/emporix/model/cart';
import { EmporixCartMapper } from './EmporixCartMapper';

/** Live cart payload shape from COP-5174 (DE, shipping tax 0, final gross 82.3). */
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
