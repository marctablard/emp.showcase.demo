import BatteryIncludedProductMapper from './BatteryIncludedProductMapper';
import EmporixProductMapper from './EmporixProductMapper';

describe('BatteryIncludedProductMapper', () => {
  const mapper = new BatteryIncludedProductMapper(new EmporixProductMapper());

  it('maps current BI product fields from _product, _product_i18n, and _product_siteAware', () => {
    const result = mapper.mapToService({
      id: '10554915',
      _product: {
        id: '10554915',
        code: 'solaris-high-performance-energy-panel',
        brandId: 'brand-1',
        categoryIds: ['cat-root', 'cat-leaf'],
        labelIds: ['label-1'],
        productType: 'BASIC',
        media: [
          {
            url: 'https://cdn.example.com/panel.jpg',
            contentType: 'image/jpeg',
          },
        ],
        mixins: {
          highlights: {
            highlights: [
              [
                { language: 'en', value: 'Advanced EVA encapsulation system' },
                { language: 'de', value: 'Fortschrittliches EVA-Verguss-System' },
              ],
            ],
          },
        },
      },
      _product_i18n: {
        name: 'Solaris Hochleistungs-Energiepanel',
        description: '<p>Localized description</p>',
        brand: {
          id: 'brand-1',
          name: 'Victron Energy',
          mediaUrl: 'https://cdn.example.com/brand.png',
        },
        labels: [
          {
            id: 'label-1',
            name: 'New',
            mediaUrl: 'https://cdn.example.com/label.png',
            description: '<p>New</p>',
          },
        ],
      },
      _product_siteAware: {
        availability: {
          available: false,
          stockLevel: 500000,
        },
        countryAware: {
          price: {
            currency: 'EUR',
            effectiveAmount: 1200.99,
            originalAmount: 1200.99,
          },
        },
      },
    });

    expect(result).toMatchObject({
      id: '10554915',
      name: 'Solaris Hochleistungs-Energiepanel',
      description: '<p>Localized description</p>',
      brand: {
        id: 'brand-1',
        name: 'Victron Energy',
        logo: {
          url: 'https://cdn.example.com/brand.png',
        },
      },
      labels: [
        {
          id: 'label-1',
          name: 'New',
          image: 'https://cdn.example.com/label.png',
          description: '<p>New</p>',
        },
      ],
      price: {
        amount: 1200.99,
        originalAmount: 1200.99,
        currency: 'EUR',
      },
      primaryImage: {
        url: 'https://cdn.example.com/panel.jpg',
      },
      availability: {
        productId: '10554915',
        availableQuantity: 500000,
        availableInDays: null,
        isAvailable: false,
      },
      purchasable: true,
    });
    expect(result.images).toHaveLength(1);
    expect(result.highlights).toEqual({
      en: ['Advanced EVA encapsulation system'],
      de: ['Fortschrittliches EVA-Verguss-System'],
    });
  });

  it('maps price from country-keyed countryAware payloads', () => {
    const result = mapper.mapToService({
      _product: {
        id: '78878448',
        code: 'solaris-ultra-efficiency-solar-panel',
        productType: 'PARENT_VARIANT',
      },
      _product_i18n: {
        name: 'Solaris Ultra Effizienz Panel',
        description: '<p>Localized description</p>',
      },
      _product_siteAware: {
        countryAware: {
          DE: {
            price: {
              currency: 'EUR',
              effectiveAmount: 3550.95,
              originalAmount: 4000,
            },
          },
        },
      },
    });

    expect(result.price).toEqual({
      amount: 3550.95,
      originalAmount: 4000,
      currency: 'EUR',
    });
    expect(result.purchasable).toBe(false);
  });

  it('does not crash when BI usp descriptions are not arrays', () => {
    const result = mapper.mapToService({
      _product: {
        id: 'usp-product',
        code: 'usp-product',
        productType: 'BASIC',
        mixins: {
          usp: {
            usp: [
              {
                icon: 'sun',
                description: {
                  en: 'Fast delivery',
                  de: 'Schnelle Lieferung',
                },
              },
            ],
          },
        },
      },
      _product_i18n: {
        name: 'USP Product',
        description: '<p>Localized description</p>',
      },
    });

    expect(result.usps).toEqual([
      {
        icon: 'sun',
        description: {
          en: 'Fast delivery',
          de: 'Schnelle Lieferung',
        },
      },
    ]);
  });
});
