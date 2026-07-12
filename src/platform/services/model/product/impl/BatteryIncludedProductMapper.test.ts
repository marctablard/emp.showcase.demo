import BatteryIncludedProductMapper from './BatteryIncludedProductMapper';
import EmporixProductMapper from './EmporixProductMapper';

describe('BatteryIncludedProductMapper', () => {
  const mapper = new BatteryIncludedProductMapper(new EmporixProductMapper());

  it('maps suggest document with value-only specifications into product.specifications', () => {
    const result = mapper.mapToService({
      id: '1',
      _product: {
        id: '1',
        productType: 'BASIC',
        mixins: {
          productVariantAttributes: {
            'nominal-power': '160W',
          },
        },
      },
      _product_i18n: {
        mixins: {
          specifications: {
            specifications: [{ value: 'Victron' }, { value: 'Black' }],
          },
        },
      },
    });

    // Check specification mapping (String -> Array shape normalization worked)
    expect(result.specifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: { en: 'Victron' } }),
        expect.objectContaining({ value: { en: 'Black' } }),
      ]),
    );
    // Group is normally 'other' for unassigned specs by EmporixProductMapper if label or group is assigned. Without it will be undefined for raw emporix mapper but group is 'other' in grouped specifications
    const mappedSpec = result.specifications?.find((s) => s.value?.en === 'Victron');
    expect(mappedSpec?.group).toBeUndefined();

    // Check variant mapping remains intact
    expect(result.variantAttributeValues).toEqual({
      'nominal-power': '160W',
    });
  });

  it('maps full-product with array-shaped specifications without modifying them', () => {
    const result = mapper.mapToService({
      id: '1',
      _product: { id: '1', productType: 'BASIC' },
      _product_i18n: {
        mixins: {
          specifications: {
            specifications: [
              {
                key: 'brand',
                label: [{ language: 'en', value: 'Brand' }],
                value: [{ language: 'en', value: 'FullArray' }],
              },
            ],
          },
        },
      },
    });

    expect(result.specifications).toEqual([
      expect.objectContaining({
        key: 'brand',
        label: { en: 'Brand' },
        value: { en: 'FullArray' },
      }),
    ]);
  });

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
        mixins: {},
      },
      _product_i18n: {
        mixins: {
          highlights: {
            highlights: ['Advanced EVA encapsulation system', 'Fortschrittliches EVA-Verguss-System'],
          },
        },
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
        EUR: {
          AT: {
            price: {
              currency: 'EUR',
              effectiveAmount: 1200.99,
              originalAmount: 1200.99,
            },
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
      en: ['Advanced EVA encapsulation system', 'Fortschrittliches EVA-Verguss-System'],
    });
  });

  it('preserves multi-locale name and description without choosing a fallback locale', () => {
    const result = mapper.mapToService({
      _product: {
        id: 'localized-product',
        code: 'localized-product',
        productType: 'BASIC',
      },
      _product_i18n: {
        name: [
          { language: 'de', value: 'Produktname DE' },
          { language: 'fr', value: 'Nom du produit FR' },
        ],
        description: {
          de: '<p>Beschreibung DE</p>',
          fr: '<p>Description FR</p>',
        },
      },
    });

    expect(result.name).toEqual({
      de: 'Produktname DE',
      fr: 'Nom du produit FR',
    });
    expect(result.description).toEqual({
      de: '<p>Beschreibung DE</p>',
      fr: '<p>Description FR</p>',
    });
  });

  it('preserves multi-locale brand data without falling back to a wrong locale', () => {
    const result = mapper.mapToService({
      _product: {
        id: 'localized-brand-product',
        code: 'localized-brand-product',
        brandId: 'brand-1',
        productType: 'BASIC',
      },
      _product_i18n: {
        name: 'Localized Brand Product',
        brand: {
          id: 'brand-1',
          name: [{ language: 'de', value: 'Marke DE' }],
          mediaUrl: 'https://cdn.example.com/brand.png',
        },
      },
    });

    expect(result.brand).toEqual({
      id: 'brand-1',
      name: {
        de: 'Marke DE',
      },
      logo: {
        url: 'https://cdn.example.com/brand.png',
        altText: {
          de: 'Marke DE',
        },
      },
    });
  });

  it('withholds multi-locale label names while preserving localized descriptions', () => {
    const result = mapper.mapToService({
      _product: {
        id: 'localized-label-product',
        code: 'localized-label-product',
        labelIds: ['label-1'],
        productType: 'BASIC',
      },
      _product_i18n: {
        name: 'Localized Label Product',
        labels: [
          {
            id: 'label-1',
            name: [{ language: 'de', value: 'Neu DE' }],
            mediaUrl: 'https://cdn.example.com/label.png',
            description: [{ language: 'de', value: '<p>Beschreibung DE</p>' }],
          },
        ],
      },
    });

    expect(result.labels).toEqual([
      {
        id: 'label-1',
        image: 'https://cdn.example.com/label.png',
        description: {
          de: '<p>Beschreibung DE</p>',
        },
      },
    ]);
    expect(result.labels?.[0]?.name).toBeUndefined();
  });

  it('maps multi-locale highlights without inventing an en fallback', () => {
    const result = mapper.mapToService({
      _product: {
        id: 'localized-highlights-product',
        code: 'localized-highlights-product',
        productType: 'BASIC',
      },
      _product_i18n: {
        name: 'Localized Highlights Product',
        mixins: {
          highlights: {
            highlights: [
              {
                language: 'de',
                value: ['Highlight DE 1', 'Highlight DE 2'],
              },
              {
                language: 'fr',
                value: ['Highlight FR 1'],
              },
            ],
          },
        },
      },
    });

    expect(result.highlights).toEqual({
      de: ['Highlight DE 1', 'Highlight DE 2'],
      fr: ['Highlight FR 1'],
    });
    expect(result.highlights).not.toHaveProperty('en');
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
    expect(result.isParentVariant).toBe(true);
    expect(result.purchasable).toBe(false);
  });

  it('maps the selected nested currencyAware.countryAware branch', () => {
    const result = mapper.mapToService({
      _product: {
        id: 'currency-aware-product',
        code: 'currency-aware-product',
        productType: 'PARENT_VARIANT',
      },
      _product_i18n: {
        name: 'Currency Aware Product',
      },
      _product_siteAware: {
        currencyAware: {
          countryAware: {
            DE: {
              price: {
                currency: 'EUR',
                effectiveAmount: 50,
                originalAmount: 110,
              },
            },
          },
        },
      },
    });

    expect(result.price).toEqual({
      amount: 50,
      originalAmount: 110,
      currency: 'EUR',
    });
  });

  it('does not fall back to sibling currencyAware branches when the selected branch is absent', () => {
    const result = mapper.mapToService({
      _product: {
        id: 'missing-selected-currency-product',
        code: 'missing-selected-currency-product',
        productType: 'PARENT_VARIANT',
      },
      _product_i18n: {
        name: 'Missing Selected Currency Product',
      },
      _product_siteAware: {
        currencyAware: {
          CHF: {
            countryAware: {
              CH: {
                price: {
                  currency: 'CHF',
                  effectiveAmount: 65,
                  originalAmount: 70,
                },
              },
            },
          },
          EUR: {
            countryAware: {
              DE: {
                price: {
                  currency: 'EUR',
                  effectiveAmount: 60,
                  originalAmount: 75,
                },
              },
            },
          },
        },
      },
    });

    expect(result.price).toBeUndefined();
  });

  it('uses the current site/current currency explicit branch when flattened selection is absent', () => {
    const result = mapper.mapToService({
      _product: {
        id: 'site-and-currency-selected-product',
        code: 'site-and-currency-selected-product',
        productType: 'PARENT_VARIANT',
      },
      _product_i18n: {
        name: 'Site And Currency Selected Product',
      },
      __batteryIncludedSelection: {
        siteAware: 'main',
        currencyAware: 'EUR',
      },
      _product_siteAware: {
        main: {
          currencyAware: {
            CHF: {
              countryAware: {
                CH: {
                  prices: [
                    {
                      currency: 'CHF',
                      effectiveAmount: 65,
                      originalAmount: 70,
                    },
                  ],
                },
              },
            },
            EUR: {
              countryAware: {
                DE: {
                  prices: [
                    {
                      currency: 'EUR',
                      effectiveAmount: 60,
                      originalAmount: 75,
                    },
                  ],
                },
              },
            },
          },
        },
        secondary: {
          currencyAware: {
            EUR: {
              countryAware: {
                FR: {
                  prices: [
                    {
                      currency: 'EUR',
                      effectiveAmount: 10,
                      originalAmount: 12,
                    },
                  ],
                },
              },
            },
          },
        },
      },
    });

    expect(result.price).toEqual({
      amount: 60,
      originalAmount: 75,
      currency: 'EUR',
    });
  });

  it('selects the price object whose currency matches the current currency from a prices array', () => {
    const result = mapper.mapToService({
      _product: {
        id: 'matching-currency-price-array-product',
        code: 'matching-currency-price-array-product',
        productType: 'PARENT_VARIANT',
      },
      _product_i18n: {
        name: 'Matching Currency Price Array Product',
      },
      __batteryIncludedSelection: {
        siteAware: 'main',
        currencyAware: 'EUR',
      },
      _product_siteAware: {
        main: {
          currencyAware: {
            EUR: {
              countryAware: {
                DE: {
                  prices: [
                    {
                      currency: 'USD',
                      effectiveAmount: 5,
                      originalAmount: 8,
                    },
                    {
                      currency: 'EUR',
                      effectiveAmount: 50,
                      originalAmount: 65,
                    },
                  ],
                },
              },
            },
          },
        },
      },
    });

    expect(result.price).toEqual({
      amount: 50,
      originalAmount: 65,
      currency: 'EUR',
    });
  });

  it('does not display a flattened nested array price when the current currency is CHF and the array contains EUR', () => {
    const result = mapper.mapToService({
      _product: {
        id: 'flattened-array-currency-mismatch-product',
        code: 'flattened-array-currency-mismatch-product',
        productType: 'PARENT_VARIANT',
      },
      _product_i18n: {
        name: 'Flattened Array Currency Mismatch Product',
      },
      __batteryIncludedSelection: {
        siteAware: 'main',
        currencyAware: 'CHF',
      },
      _product_siteAware: {
        currencyAware: {
          countryAware: {
            CH: {
              prices: [
                {
                  currency: 'EUR',
                  effectiveAmount: 50,
                  originalAmount: 65,
                },
              ],
            },
          },
        },
      },
    });

    expect(result.price).toBeUndefined();
  });

  it('uses the contextual explicit site and currency branch when it contains a matching CHF price', () => {
    const result = mapper.mapToService({
      _product: {
        id: 'contextual-explicit-chf-product',
        code: 'contextual-explicit-chf-product',
        productType: 'PARENT_VARIANT',
      },
      _product_i18n: {
        name: 'Contextual Explicit CHF Product',
      },
      __batteryIncludedSelection: {
        siteAware: 'main',
        currencyAware: 'CHF',
      },
      _product_siteAware: {
        main: {
          currencyAware: {
            CHF: {
              countryAware: {
                CH: {
                  prices: [
                    {
                      currency: 'EUR',
                      effectiveAmount: 50,
                      originalAmount: 80,
                    },
                    {
                      currency: 'CHF',
                      effectiveAmount: 65,
                      originalAmount: 90,
                    },
                  ],
                },
              },
            },
          },
        },
      },
    });

    expect(result.price).toEqual({
      amount: 65,
      originalAmount: 90,
      currency: 'CHF',
    });
  });

  it('does not display a direct non-nested price object when the final price currency mismatches the current currency', () => {
    const result = mapper.mapToService({
      _product: {
        id: 'direct-price-currency-mismatch-product',
        code: 'direct-price-currency-mismatch-product',
        productType: 'PARENT_VARIANT',
      },
      _product_i18n: {
        name: 'Direct Price Currency Mismatch Product',
      },
      __batteryIncludedSelection: {
        siteAware: 'main',
        currencyAware: 'CHF',
      },
      _product_siteAware: {
        countryAware: {
          CH: {
            price: {
              currency: 'EUR',
              effectiveAmount: 50,
              originalAmount: 65,
            },
          },
        },
      },
    });

    expect(result.price).toBeUndefined();
  });

  it('does not fall back to the wrong sibling site or currency branch', () => {
    const result = mapper.mapToService({
      _product: {
        id: 'wrong-site-or-currency-product',
        code: 'wrong-site-or-currency-product',
        productType: 'PARENT_VARIANT',
      },
      _product_i18n: {
        name: 'Wrong Site Or Currency Product',
      },
      __batteryIncludedSelection: {
        siteAware: 'main',
        currencyAware: 'USD',
      },
      _product_siteAware: {
        main: {
          currencyAware: {
            EUR: {
              countryAware: {
                DE: {
                  prices: [
                    {
                      currency: 'EUR',
                      effectiveAmount: 60,
                      originalAmount: 75,
                    },
                  ],
                },
              },
            },
          },
        },
        secondary: {
          currencyAware: {
            USD: {
              countryAware: {
                US: {
                  prices: [
                    {
                      currency: 'USD',
                      effectiveAmount: 30,
                      originalAmount: 40,
                    },
                  ],
                },
              },
            },
          },
        },
      },
    });

    expect(result.price).toBeUndefined();
  });

  it('maps flattened selected currencyAware.countryAware.prices payloads', () => {
    const result = mapper.mapToService({
      _product: {
        id: 'flattened-currency-aware-product',
        code: 'flattened-currency-aware-product',
        productType: 'PARENT_VARIANT',
      },
      _product_i18n: {
        name: 'Flattened Currency Aware Product',
      },
      __batteryIncludedSelection: {
        siteAware: 'main',
        currencyAware: 'EUR',
      },
      _product_siteAware: {
        currencyAware: {
          countryAware: {
            prices: [
              {
                currency: 'USD',
                effectiveAmount: 5,
                originalAmount: 15,
              },
              {
                currency: 'EUR',
                effectiveAmount: 50,
                originalAmount: 110,
              },
            ],
          },
          USD: {
            countryAware: {
              US: {
                price: {
                  currency: 'USD',
                  effectiveAmount: 10,
                  originalAmount: 20,
                },
              },
            },
          },
        },
      },
    });

    expect(result.price).toEqual({
      amount: 50,
      originalAmount: 110,
      currency: 'EUR',
    });
  });

  it('prefers the selected currency from root prices over a lower mismatched price', () => {
    const result = mapper.mapToService({
      _product: {
        id: 'root-prices-currency-product',
        code: 'root-prices-currency-product',
        productType: 'PARENT_VARIANT',
        prices: [
          {
            currency: 'USD',
            effectiveAmount: 10,
            originalAmount: 20,
          },
          {
            currency: 'EUR',
            effectiveAmount: 90,
            originalAmount: 110,
          },
        ],
      },
      _product_i18n: {
        name: 'Root Prices Currency Product',
      },
      __batteryIncludedSelection: {
        siteAware: 'main',
        currencyAware: 'EUR',
      },
    });

    expect(result.price).toEqual({
      amount: 90,
      originalAmount: 110,
      currency: 'EUR',
    });
  });

  it('handles selected currencyAware.<currency>.countryAware.<country>.prices payloads', () => {
    const result = mapper.mapToService({
      _product: {
        id: 'victron-bluesolar-55w',
        code: 'victron-bluesolar-55w',
        productType: 'PARENT_VARIANT',
      },
      _product_i18n: {
        name: 'Victron BlueSolar 55W',
      },
      _product_siteAware: {
        currencyAware: {
          EUR: {
            countryAware: {
              DE: {
                prices: [
                  {
                    currency: 'EUR',
                    effectiveAmount: 95,
                    originalAmount: 120,
                  },
                ],
              },
            },
          },
        },
      },
    });

    expect(result.price).toEqual({
      amount: 95,
      originalAmount: 120,
      currency: 'EUR',
    });
  });

  it('handles site-wrapped selected currencyAware.<currency>.countryAware.<country>.prices payloads', () => {
    const result = mapper.mapToService({
      _product: {
        id: 'site-wrapped-explicit-currency-product',
        code: 'site-wrapped-explicit-currency-product',
        productType: 'PARENT_VARIANT',
      },
      _product_i18n: {
        name: 'Site Wrapped Explicit Currency Product',
      },
      _product_siteAware: {
        main: {
          currencyAware: {
            EUR: {
              countryAware: {
                DE: {
                  prices: [
                    {
                      currency: 'EUR',
                      effectiveAmount: 89,
                      originalAmount: 105,
                    },
                  ],
                },
              },
            },
          },
        },
      },
    });

    expect(result.price).toEqual({
      amount: 89,
      originalAmount: 105,
      currency: 'EUR',
    });
  });

  it('maps site-wrapped flattened currencyAware.countryAware.prices payloads', () => {
    const result = mapper.mapToService({
      _product: {
        id: 'site-wrapped-flattened-currency-product',
        code: 'site-wrapped-flattened-currency-product',
        productType: 'PARENT_VARIANT',
      },
      _product_i18n: {
        name: 'Site Wrapped Flattened Currency Product',
      },
      _product_siteAware: {
        main: {
          currencyAware: {
            countryAware: {
              prices: [
                {
                  currency: 'EUR',
                  effectiveAmount: 77,
                  originalAmount: 99,
                },
              ],
            },
          },
        },
      },
    });

    expect(result.price).toEqual({
      amount: 77,
      originalAmount: 99,
      currency: 'EUR',
    });
  });

  it('maps flattened selected currencyAware.countryAware.<country>.prices payloads', () => {
    const result = mapper.mapToService({
      _product: {
        id: 'flattened-selected-country-product',
        code: 'flattened-selected-country-product',
        productType: 'PARENT_VARIANT',
      },
      _product_i18n: {
        name: 'Flattened Selected Country Product',
      },
      _product_siteAware: {
        currencyAware: {
          countryAware: {
            US: {
              prices: [
                {
                  currency: 'USD',
                  effectiveAmount: 19,
                  originalAmount: 25,
                },
              ],
            },
          },
          EUR: {
            countryAware: {
              DE: {
                price: {
                  currency: 'EUR',
                  effectiveAmount: 50,
                  originalAmount: 110,
                },
              },
            },
          },
        },
      },
    });

    expect(result.price).toEqual({
      amount: 19,
      originalAmount: 25,
      currency: 'USD',
    });
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

  it('maps variant chips from _product.mixins.productVariantAttributes in PARENT_VARIANT hits', () => {
    const result = mapper.mapToService({
      _product: {
        id: 'variant-product-1',
        code: 'variant-product-1',
        productType: 'PARENT_VARIANT',
        mixins: {
          productVariantAttributes: {
            'nominal-power': '300W',
            color: 'Black',
          },
        },
      },
      _product_i18n: {
        name: 'Variant Product',
      },
    });

    expect(result.variantAttributes).toEqual([
      {
        key: 'nominal-power',
        name: 'nominal-power',
        values: [
          {
            key: '300W',
            selected: false,
          },
        ],
      },
      {
        key: 'color',
        name: 'color',
        values: [
          {
            key: 'Black',
            selected: false,
          },
        ],
      },
    ]);
    expect(result.isParentVariant).toBe(true);
    expect(result.variantCount).toBeUndefined();
  });

  it('maps empty variantAttributes for PARENT_VARIANT hits without mixins.productVariantAttributes', () => {
    const result = mapper.mapToService({
      _product: {
        id: '70875110',
        code: 'terravolt-all-weather-solar-panel',
        productType: 'PARENT_VARIANT',
      },
      _product_i18n: {
        name: 'TerraVolt All-Weather Solar Panel',
      },
    });

    expect(result.variantAttributes).toEqual([]);
  });

  it('maps category suggestions from the breadcrumb display path facet', () => {
    const result = mapper.mapSearchSuggestions([
      {
        kind: 'facet._product_i18n.categoryBreadcrumbs.displayPath',
        hits: [
          {
            value: 'Electrical supplies > Power generation > Solar panels',
            count: 25,
            highlighted: 'Electrical supplies > Power generation > <mark>Solar</mark> panels',
            data: {
              idPath: '123 > 456 > 789',
            },
          },
          {
            value: 'Without Highlights',
            count: 5,
          },
        ],
      },
    ]);

    expect(result.categories).toEqual([
      {
        name: 'Electrical supplies > Power generation > Solar panels',
        highlighted: 'Electrical supplies > Power generation > <mark>Solar</mark> panels',
        count: 25,
        idPath: '123 > 456 > 789',
      },
      {
        name: 'Without Highlights',
        highlighted: 'Without Highlights',
        count: 5,
        idPath: undefined,
      },
    ]);
  });

  it('maps highlighted BI document suggestions that use nested site and currency aware branches', () => {
    const result = mapper.mapSearchSuggestions([
      {
        kind: 'document',
        hits: [
          {
            highlighted: {
              _product: {
                id: 'site-wrapped-suggestion-product',
                code: 'site-wrapped-suggestion-product',
                productType: 'PARENT_VARIANT',
              },
              _product_i18n: {
                name: 'Site Wrapped Suggestion Product',
              },
              __batteryIncludedSelection: {
                siteAware: 'main',
                currencyAware: 'EUR',
              },
              _product_siteAware: {
                main: {
                  currencyAware: {
                    EUR: {
                      countryAware: {
                        DE: {
                          prices: [
                            {
                              currency: 'EUR',
                              effectiveAmount: 89,
                              originalAmount: 105,
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    ]);

    expect(result.queryCompletions).toEqual([]);
    expect(result.categories).toEqual([]);
    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({
      id: 'site-wrapped-suggestion-product',
      name: 'Site Wrapped Suggestion Product',
      price: {
        amount: 89,
        originalAmount: 105,
        currency: 'EUR',
      },
    });
  });

  it('preserves contextual suggestion pricing when generic highlighted prices contain a lower unrelated fallback', () => {
    const result = mapper.mapSearchSuggestions([
      {
        kind: 'document',
        hits: [
          {
            highlighted: {
              _product: {
                id: 'contextual-suggestion-product',
                code: 'contextual-suggestion-product',
                productType: 'PARENT_VARIANT',
                prices: [
                  {
                    currency: 'USD',
                    effectiveAmount: 10,
                    originalAmount: 12,
                  },
                  {
                    currency: 'EUR',
                    effectiveAmount: 120,
                    originalAmount: 130,
                  },
                ],
              },
              _product_i18n: {
                name: 'Contextual Suggestion Product',
              },
              __batteryIncludedSelection: {
                siteAware: 'main',
                currencyAware: 'EUR',
              },
              _product_siteAware: {
                main: {
                  currencyAware: {
                    EUR: {
                      countryAware: {
                        DE: {
                          prices: [
                            {
                              currency: 'EUR',
                              effectiveAmount: 89,
                              originalAmount: 105,
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    ]);

    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.price).toEqual({
      amount: 89,
      originalAmount: 105,
      currency: 'EUR',
    });
  });

  it('uses the selected currency for suggestion fallback root prices when a matching candidate exists', () => {
    const result = mapper.mapSearchSuggestions([
      {
        kind: 'document',
        hits: [
          {
            highlighted: {
              _product: {
                id: 'root-price-suggestion-product',
                code: 'root-price-suggestion-product',
                productType: 'PARENT_VARIANT',
                prices: [
                  {
                    currency: 'USD',
                    effectiveAmount: 10,
                    originalAmount: 12,
                  },
                  {
                    currency: 'EUR',
                    effectiveAmount: 120,
                    originalAmount: 130,
                  },
                ],
              },
              _product_i18n: {
                name: 'Root Price Suggestion Product',
              },
              __batteryIncludedSelection: {
                siteAware: 'main',
                currencyAware: 'EUR',
              },
            },
          },
        ],
      },
    ]);

    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.price).toEqual({
      amount: 120,
      originalAmount: 130,
      currency: 'EUR',
    });
  });

  it('maps suggestion prices from the full document when highlighted only contains snippet fields', () => {
    const result = mapper.mapSearchSuggestions([
      {
        kind: 'document',
        hits: [
          {
            document: {
              _product: {
                id: 'document-backed-suggestion-product',
                code: 'document-backed-suggestion-product',
                productType: 'PARENT_VARIANT',
              },
              _product_i18n: {
                name: 'Document Backed Suggestion Product',
              },
              _product_siteAware: {
                main: {
                  currencyAware: {
                    EUR: {
                      countryAware: {
                        DE: {
                          prices: [
                            {
                              currency: 'EUR',
                              effectiveAmount: 89,
                              originalAmount: 105,
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
            highlighted: {
              _product: {
                id: 'document-backed-suggestion-product',
                code: 'document-backed-suggestion-product',
                productType: 'PARENT_VARIANT',
              },
              _product_i18n: {
                name: '<mark>Document</mark> Backed Suggestion Product',
              },
              __batteryIncludedSelection: {
                siteAware: 'main',
                currencyAware: 'EUR',
              },
              _product_siteAware: {
                main: {
                  availability: {
                    available: true,
                  },
                },
              },
            },
          },
        ],
      },
    ]);

    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({
      id: 'document-backed-suggestion-product',
      name: '<mark>Document</mark> Backed Suggestion Product',
      price: {
        amount: 89,
        originalAmount: 105,
        currency: 'EUR',
      },
    });
  });
});
