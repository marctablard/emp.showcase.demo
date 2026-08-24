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
});
