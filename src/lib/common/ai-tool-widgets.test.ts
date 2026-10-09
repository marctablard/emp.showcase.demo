import { adaptToolResult, widgetTypeFromToolName } from './ai-tool-widgets';

describe('ai-tool-widgets', () => {
  it('maps get-quotes to quote_list', () => {
    expect(widgetTypeFromToolName('showcasedev__get-quotes')).toBe('quote_list');
  });

  it('adapts two quotes from MCP JSON', () => {
    const adapted = adaptToolResult('get-quotes', {
      quotes: [
        { id: 'Q1', reference: 'R1' },
        { id: 'Q2', reference: 'R2' },
      ],
    });
    expect(adapted?.type).toBe('quote_list');
    expect(adapted?.data.quotes).toHaveLength(2);
    expect((adapted?.data.quotes as Array<{ id: string }>)[0].id).toBe('Q1');
  });

  it('preserves localized quote names until render', () => {
    const adapted = adaptToolResult('get-quotes', {
      quotes: [{ id: 'Q1', items: [{ product: { name: { en: 'Helmet', de: 'Helm' } } }] }],
    });
    const quote = (adapted?.data.quotes as Array<Record<string, unknown>>)[0];
    expect(quote.id).toBe('Q1');
    expect((quote.items as Array<Record<string, unknown>>)[0]).toMatchObject({
      product: { name: { en: 'Helmet', de: 'Helm' } },
    });
  });

  it('adapts customer JSON onto personalInfo', () => {
    const adapted = adaptToolResult('get-customer-info', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      contactEmail: 'ada@example.com',
      addresses: [{ city: 'London' }],
    });
    expect(adapted?.type).toBe('account_details');
    expect(adapted?.data.personalInfo).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.com' });
    expect(adapted?.data.addresses).toEqual([{ city: 'London' }]);
  });

  it('unwraps LangChain tool envelopes instead of painting the tool name as the customer', () => {
    const adapted = adaptToolResult('get-customer-info', {
      name: 'get-customer-info',
      type: 'tool',
      tool_call_id: 'call-1',
      content: {
        firstName: 'Szymon',
        lastName: 'Mendla',
        contactEmail: 's.mendla@emporix.com',
        company: 'SpaceX',
        customerNumber: '26566461',
        preferredLanguage: 'de',
        preferredCurrency: 'EUR',
        lastLogin: '2026-08-21T10:44:32.254Z',
        addresses: [{ city: 'Belrin', country: 'Germany' }],
      },
    });
    expect(adapted?.data.personalInfo).toMatchObject({
      name: 'Szymon Mendla',
      email: 's.mendla@emporix.com',
      company: 'SpaceX',
      customerNumber: '26566461',
    });
    expect(adapted?.data.addresses).toEqual([{ city: 'Belrin', country: 'Germany' }]);
  });

  it('maps Emporix address fields onto AddressCard fields', () => {
    const adapted = adaptToolResult('get-customer-info', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      addresses: [
        {
          contactName: 'HQ',
          companyName: 'Analytical Engines',
          street: 'Analytical Way',
          streetNumber: '1',
          streetAppendix: 'Gate B',
          zipCode: 'SW1A',
          city: 'London',
          country: 'GB',
          tags: ['SHIPPING', 'BILLING'],
        },
      ],
    });
    expect(adapted?.data.addresses).toEqual([
      {
        name: 'HQ',
        company: 'Analytical Engines',
        addressLine1: 'Analytical Way 1',
        addressLine2: 'Gate B',
        city: 'London',
        postalCode: 'SW1A',
        country: 'GB',
        tags: ['SHIPPING', 'BILLING'],
      },
    ]);
  });

  it('unwraps MCP Result.data customer addresses', () => {
    const adapted = adaptToolResult('get-customer-info', {
      name: 'get-customer-info',
      description: 'Successfully fetched customer information',
      source: 'customers',
      is_success: true,
      data: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        addresses: [{ contactName: 'Home', street: 'Friedrichstr.', zipCode: '10115', city: 'Berlin', country: 'DE' }],
      },
    });
    expect(adapted?.data.personalInfo).toMatchObject({ name: 'Ada Lovelace' });
    expect(adapted?.data.addresses).toEqual([
      {
        name: 'Home',
        addressLine1: 'Friedrichstr.',
        city: 'Berlin',
        postalCode: '10115',
        country: 'DE',
      },
    ]);
  });

  it('maps nested company addresses from get-companies-addresses', () => {
    const adapted = adaptToolResult('get-companies-addresses', [
      {
        companyId: 'le-1',
        companyName: 'SpaceX',
        address: { street: 'Rocket Rd', streetNumber: '1', zipCode: '90250', city: 'Hawthorne', country: 'US' },
      },
    ]);
    expect(adapted?.type).toBe('address_list');
    expect(adapted?.data.addresses).toEqual([
      {
        name: 'SpaceX',
        addressLine1: 'Rocket Rd 1',
        city: 'Hawthorne',
        postalCode: '90250',
        country: 'US',
      },
    ]);
  });

  it('maps legal-entity locations whose address sits in contactDetails', () => {
    const adapted = adaptToolResult('get-companies-addresses', {
      is_success: true,
      data: [
        {
          companyId: 'le-1',
          companyName: 'World Company',
          address: {
            id: 'loc-1',
            name: 'World Company HQ',
            type: 'OFFICE',
            contactDetails: {
              addressLine1: 'Hauptstrasse 10',
              city: 'Berlin',
              postcode: '10501',
              countryCode: 'DE',
              tags: ['BILLING', 'SHIPPING'],
            },
          },
        },
      ],
    });
    expect(adapted?.data.addresses).toEqual([
      {
        id: 'loc-1',
        name: 'World Company HQ',
        company: 'World Company',
        addressLine1: 'Hauptstrasse 10',
        city: 'Berlin',
        postalCode: '10501',
        country: 'DE',
        tags: ['BILLING', 'SHIPPING'],
      },
    ]);
  });

  it('reads structured_content from a tool artifact wrapper', () => {
    const adapted = adaptToolResult('get-customer-info', {
      name: 'get-customer-info',
      type: 'tool',
      artifact: {
        structured_content: {
          personalInfo: {
            name: 'Szymon Mendla',
            email: 's.mendla@emporix.com',
          },
        },
      },
    });
    expect(adapted?.data.personalInfo).toMatchObject({
      name: 'Szymon Mendla',
      email: 's.mendla@emporix.com',
    });
  });

  it('does not treat the tool name as a customer name', () => {
    expect(adaptToolResult('get-customer-info', { name: 'get-customer-info' })).toBeNull();
  });

  it('returns null for unknown tools', () => {
    expect(adaptToolResult('debug-dump', { secret: 'nope' })).toBeNull();
  });

  it('projects Emporix order JSON onto widget fields', () => {
    const adapted = adaptToolResult('get-customer-orders', {
      orders: [
        {
          id: 'EON1624',
          status: 'CREATED',
          created: '2026-07-01T13:35:24.775Z',
          siteCode: 'main',
          subTotalPrice: 90,
          totalPrice: 93.45,
          currency: 'EUR',
          entries: [{ id: null, amount: null, product: null }],
        },
      ],
    });
    expect(adapted?.type).toBe('order_list');
    const order = (adapted?.data.orders as Array<Record<string, unknown>>)[0];
    expect(order).toMatchObject({
      orderId: 'EON1624',
      status: 'CREATED',
      date: '2026-07-01T13:35:24.775Z',
      siteCode: 'main',
      currency: 'EUR',
      itemCount: 1,
      total: { gross: 93.45, value: 93.45 },
    });
    expect(order.entries).toBeUndefined();
    expect(order.items).toBeUndefined();
  });

  it('maps order line items from entries and product names', () => {
    const adapted = adaptToolResult('get-customer-orders', {
      orders: [
        {
          id: 'EON1',
          status: 'CREATED',
          created: '2026-07-01T13:35:24.775Z',
          totalPrice: 20,
          currency: 'EUR',
          entries: [
            {
              amount: 2,
              product: { id: 'P1', name: { en: 'Solar panel' }, media: { url: 'https://cdn.example/p.jpg' } },
            },
          ],
        },
      ],
    });
    const order = (adapted?.data.orders as Array<Record<string, unknown>>)[0];
    expect(order.items).toEqual([
      {
        productId: 'P1',
        name: 'Solar panel',
        quantity: 2,
        image: 'https://cdn.example/p.jpg',
      },
    ]);
    expect(order.itemCount).toBe(1);
  });

  it('maps Emporix entry images and effectiveAmount into widget line items', () => {
    const adapted = adaptToolResult('get-customer-orders', {
      orders: [
        {
          id: 'EON2',
          status: 'CREATED',
          entries: [
            {
              amount: 2,
              product: {
                id: 'P2',
                name: { en: 'Battery' },
                images: [{ url: 'https://cdn.example/battery.jpg' }],
              },
              price: { effectiveAmount: 12.5, currency: 'EUR' },
              calculatedPrice: {
                finalPrice: { netValue: 20, grossValue: 25, taxValue: 5 },
              },
            },
          ],
        },
      ],
    });
    const item = (adapted?.data.orders as Array<Record<string, unknown>>)[0].items as Array<Record<string, unknown>>;
    expect(item[0]).toMatchObject({
      productId: 'P2',
      name: 'Battery',
      quantity: 2,
      image: 'https://cdn.example/battery.jpg',
      unitPrice: { value: 12.5, gross: 12.5, net: 10, currency: 'EUR' },
      totalPrice: { value: 25, gross: 25, net: 20, tax: 5, currency: 'EUR' },
    });
  });

  it('keeps already-adapted order widgets', () => {
    const adapted = adaptToolResult('get-customer-orders', {
      orders: [
        {
          orderId: 'EON1',
          status: 'CREATED',
          date: '2026-07-01',
          total: { gross: 10, value: 10 },
          items: [{ name: 'Widget', quantity: 2 }],
          itemCount: 1,
        },
      ],
    });
    const order = (adapted?.data.orders as Array<Record<string, unknown>>)[0];
    expect(order).toMatchObject({
      orderId: 'EON1',
      date: '2026-07-01',
      total: { gross: 10, value: 10 },
      itemCount: 1,
    });
    expect(order.items).toEqual([{ name: 'Widget', quantity: 2 }]);
  });

  it('projects CaaS products with localized fields onto slim widget rows', () => {
    const adapted = adaptToolResult('get-products', {
      products: [
        {
          id: 'P1',
          name: { en: 'Super 8 Blanche' },
          description: { en: '<p>Crisp lager</p>' },
          brand: { en: 'Super 8' },
          media: { url: 'https://cdn.example/p1.jpg' },
          mixins: { specs: { alcohol: '5%' } },
          price: { amount: 12.5, currency: 'EUR' },
        },
      ],
    });
    expect(adapted?.type).toBe('product_list');
    const product = (adapted?.data.products as Array<Record<string, unknown>>)[0];
    expect(product).toEqual({
      productId: 'P1',
      name: 'Super 8 Blanche',
      description: '<p>Crisp lager</p>',
      brand: 'Super 8',
      image: 'https://cdn.example/p1.jpg',
      price: 12.5,
      currency: 'EUR',
    });
    expect(product).not.toHaveProperty('mixins');
    expect(product.name).not.toEqual({ en: 'Super 8 Blanche' });
  });

  it('keeps already-flat product widgets', () => {
    const adapted = adaptToolResult('get-products', {
      products: [{ productId: 'P2', name: 'Widget', price: 9.99, currency: 'EUR' }],
    });
    expect(adapted?.data.products).toEqual([{ productId: 'P2', name: 'Widget', price: 9.99, currency: 'EUR' }]);
  });

  it('maps singular get-product payloads onto product_list widgets', () => {
    const adapted = adaptToolResult('get-product', {
      id: 'P3',
      name: { en: 'Single Widget' },
      price: { amount: 4.5, currency: 'EUR' },
    });
    expect(adapted?.type).toBe('product_list');
    expect(adapted?.data.products).toEqual([
      {
        productId: 'P3',
        name: 'Single Widget',
        price: 4.5,
        currency: 'EUR',
      },
    ]);
  });

  it('normalizes order totals that use amount fields', () => {
    const adapted = adaptToolResult('get-customer-orders', {
      orders: [{ id: 'EON2', total: { amount: 99, currency: 'EUR' } }],
    });
    const order = (adapted?.data.orders as Array<Record<string, unknown>>)[0];
    expect(order.total).toEqual({ value: 99, gross: 99, currency: 'EUR' });
  });

  it('maps indexedproducts RAG hits onto product_list widgets', () => {
    expect(widgetTypeFromToolName('search_showcasedev__indexedProducts')).toBe('product_list');
    const adapted = adaptToolResult('search_showcasedev__indexedProducts', {
      data: {
        results: [
          {
            chunk: 'solar panel',
            metadata: {
              code: 'SOLAR-1',
              _id: 'mongo-1',
              name: { en: 'Solar Panel 300W' },
              medias: [{ url: 'https://cdn.example/solar.jpg' }],
              sitePrices: {
                main: { effectiveAmount: 199.5, currency: 'EUR' },
              },
            },
          },
        ],
      },
    });
    expect(adapted?.type).toBe('product_list');
    expect(adapted?.data.products).toEqual([
      {
        productId: 'SOLAR-1',
        name: 'Solar Panel 300W',
        image: 'https://cdn.example/solar.jpg',
        price: 199.5,
        currency: 'EUR',
      },
    ]);
  });

  it('uses catalog id over search code for add-to-cart productId', () => {
    const adapted = adaptToolResult('search_showcasedev__indexedProducts', {
      data: {
        results: [
          {
            metadata: {
              id: 'auroratech-smart-solar-solution',
              code: 'auroratech-smart-solar-solution-nominal-power-600w',
              _id: 'mongo-1',
              name: { en: 'Aurora 600W' },
            },
          },
        ],
      },
    });
    expect((adapted?.data.products as Array<Record<string, unknown>>)[0].productId).toBe(
      'auroratech-smart-solar-solution',
    );
  });

  it('maps indexedorders RAG hits onto order_list widgets', () => {
    expect(widgetTypeFromToolName('search_tenant__indexed-orders')).toBe('order_list');
    const adapted = adaptToolResult('search_tenant__indexedOrders', {
      results: [
        {
          metadata: {
            id: 'EON42',
            status: { value: 'CREATED' },
            created: '2024-01-02',
            totalPrice: 42,
            currency: 'EUR',
            entries: [{ product: { id: 'P1', name: { en: 'Widget' } }, amount: 2 }],
          },
        },
      ],
    });
    expect(adapted?.type).toBe('order_list');
    const order = (adapted?.data.orders as Array<Record<string, unknown>>)[0];
    expect(order.orderId).toBe('EON42');
    expect(order.status).toBe('CREATED');
    expect(order.items).toEqual([{ name: 'Widget', quantity: 2, productId: 'P1' }]);
  });

  it('projects cart_summary totals and currency from widget-shaped get-cart JSON', () => {
    const adapted = adaptToolResult('get-cart', {
      currency: 'EUR',
      siteCode: 'main',
      items: [{ productId: 'P1', name: 'Solar panel', quantity: 1, unitPrice: { gross: 99, currency: 'EUR' } }],
      subtotal: { gross: 99, net: 83, tax: 16, currency: 'EUR' },
      total: { gross: 99, net: 83, tax: 16, currency: 'EUR' },
    });
    expect(adapted?.type).toBe('cart_summary');
    expect(adapted?.data).toMatchObject({
      currency: 'EUR',
      siteCode: 'main',
      subtotal: { gross: 99, net: 83, tax: 16, currency: 'EUR' },
      total: { gross: 99, net: 83, tax: 16, currency: 'EUR' },
    });
    expect(adapted?.data.items).toHaveLength(1);
  });

  it('derives cart_summary totals from Emporix-shaped cart price fields', () => {
    const adapted = adaptToolResult('get-cart', {
      currency: 'EUR',
      site: 'main',
      subTotalPrice: { amount: 80, currency: 'EUR' },
      totalPrice: { amount: 99, currency: 'EUR' },
      items: [
        {
          product: { id: 'P1', name: { en: 'Solar panel' } },
          amount: 1,
          price: { effectiveAmount: 99, currency: 'EUR' },
        },
      ],
    });
    expect(adapted?.type).toBe('cart_summary');
    expect(adapted?.data).toMatchObject({
      currency: 'EUR',
      siteCode: 'main',
      subtotal: { gross: 80, value: 80, currency: 'EUR' },
      total: { gross: 99, value: 99, currency: 'EUR' },
    });
    expect((adapted?.data.items as Array<Record<string, unknown>>)[0]).toMatchObject({
      productId: 'P1',
      name: 'Solar panel',
      quantity: 1,
    });
  });

  it('ignores empty cart total placeholders and uses calculatedPrice', () => {
    const adapted = adaptToolResult('get-cart', {
      currency: 'EUR',
      siteCode: 'main',
      total: {},
      subtotal: {},
      calculatedPrice: {
        price: { netValue: 80, grossValue: 95, taxValue: 15 },
        finalPrice: { netValue: 83, grossValue: 99, taxValue: 16 },
      },
      items: [{ productId: 'P1', name: 'Solar panel', quantity: 1, unitPrice: { gross: 99, currency: 'EUR' } }],
    });
    expect(adapted?.data).toMatchObject({
      subtotal: { gross: 95, net: 80, tax: 15, value: 95 },
      total: { gross: 99, net: 83, tax: 16, value: 99 },
    });
  });

  it('prefers calculatedPrice net/tax over amount-only cart totalPrice', () => {
    const adapted = adaptToolResult('get-cart', {
      currency: 'EUR',
      totalPrice: { amount: 99, currency: 'EUR' },
      subTotalPrice: { amount: 99, currency: 'EUR' },
      calculatedPrice: {
        price: { netValue: 83.19, grossValue: 99, taxValue: 15.81 },
        finalPrice: { netValue: 83.19, grossValue: 99, taxValue: 15.81 },
      },
      items: [{ productId: 'P1', name: 'Solar panel', quantity: 1 }],
    });
    expect(adapted?.data.total).toMatchObject({ gross: 99, net: 83.19, tax: 15.81 });
    expect(adapted?.data.subtotal).toMatchObject({ gross: 99, net: 83.19, tax: 15.81 });
  });

  it('reads cart totals from a nested cart wrapper', () => {
    const adapted = adaptToolResult('get-cart', {
      cart: {
        currency: 'EUR',
        items: [{ productId: 'P1', name: 'Solar panel', quantity: 1 }],
        calculatedPrice: {
          finalPrice: { netValue: 83, grossValue: 99, taxValue: 16 },
          price: { netValue: 83, grossValue: 99, taxValue: 16 },
        },
      },
    });
    expect(adapted?.data).toMatchObject({
      currency: 'EUR',
      total: { gross: 99, net: 83, tax: 16, value: 99 },
    });
    expect(adapted?.data.items).toHaveLength(1);
  });

  it('scales explicit unit price into totalPrice by quantity', () => {
    const adapted = adaptToolResult('get-customer-orders', {
      orders: [
        {
          id: 'EON1',
          status: 'CREATED',
          created: '2026-07-01T13:35:24.775Z',
          currency: 'EUR',
          entries: [
            {
              amount: 2,
              product: { id: 'P1', name: { en: 'Solar panel' } },
              unitPrice: { gross: 10, net: 8, tax: 2, currency: 'EUR' },
            },
          ],
        },
      ],
    });
    const item = (adapted?.data.orders as Array<Record<string, unknown>>)[0].items as Array<Record<string, unknown>>;
    expect(item[0]).toMatchObject({
      quantity: 2,
      unitPrice: { gross: 10, net: 8, tax: 2, currency: 'EUR' },
      totalPrice: { gross: 20, net: 16, tax: 4, currency: 'EUR' },
    });
  });

  it('normalizes get-quote Emporix items onto quote_details DTO rows', () => {
    const adapted = adaptToolResult('get-quote', {
      id: 'Q1',
      currency: 'EUR',
      items: [
        {
          quantity: { quantity: 2 },
          product: { id: 'P1', name: { en: 'Solar panel' } },
          price: { currency: 'EUR', grossValue: 25, netValue: 20 },
        },
      ],
    });
    expect(adapted?.type).toBe('quote_details');
    expect(adapted?.data.items).toEqual([
      expect.objectContaining({
        productId: 'P1',
        name: 'Solar panel',
        quantity: 2,
        unitPrice: expect.objectContaining({ gross: 25, net: 20, currency: 'EUR' }),
        totalPrice: expect.objectContaining({ gross: 50, net: 40, currency: 'EUR' }),
      }),
    ]);
  });
});
