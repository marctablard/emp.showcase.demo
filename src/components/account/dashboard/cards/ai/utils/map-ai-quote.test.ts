import { mapAiQuote, mapAiQuoteList } from './map-ai-quote';

const emporixQuote = {
  id: 'Q1000453',
  customer: { firstName: 'Pawel', lastName: 'Admin' },
  customerReference: 'testy quote',
  currency: 'EUR',
  status: { value: 'OPEN', comment: 'generous discount granted' },
  validTo: '2026-08-23T09:00:00Z',
  items: [
    {
      quantity: { quantity: 1, unitCode: 'pc' },
      product: {
        name: { en: 'Enjoy Solar 200W module' },
        media: { url: 'https://example.com/panel.avif' },
      },
    },
    {
      quantity: { quantity: 1, unitCode: 'pc' },
      product: { name: { en: 'NovaCell Superior Solar Panel System' } },
    },
  ],
  totalPrice: { currency: 'EUR', netValue: 1205.79, grossValue: 1434.89, taxValue: 229.1 },
  metadata: { createdAt: '2026-07-24T08:41:54.272Z' },
};

describe('mapAiQuote', () => {
  it('maps a Quote Service resource onto the Helper widget DTO', () => {
    expect(mapAiQuote(emporixQuote, 'en')).toEqual({
      quoteId: 'Q1000453',
      reference: 'testy quote',
      status: 'OPEN',
      submittedDate: '2026-07-24T08:41:54.272Z',
      validTo: '2026-08-23T09:00:00Z',
      totalGross: 1434.89,
      totalNet: 1205.79,
      totalVat: 229.1,
      currency: 'EUR',
      itemCount: 2,
      customerName: 'Pawel Admin',
      previewItems: [
        { name: 'Enjoy Solar 200W module', image: 'https://example.com/panel.avif', quantity: 1 },
        { name: 'NovaCell Superior Solar Panel System', image: undefined, quantity: 1 },
      ],
    });
  });

  it('keeps an already flattened Helper quote', () => {
    expect(
      mapAiQuote({
        quoteId: 'Q1',
        status: 'ACCEPTED',
        submittedDate: '2026-01-01',
        totalGross: 10,
      }),
    ).toMatchObject({
      quoteId: 'Q1',
      status: 'ACCEPTED',
      submittedDate: '2026-01-01',
      totalGross: 10,
    });
  });
});

describe('mapAiQuoteList', () => {
  it('maps quotes inside a quote_list payload', () => {
    const list = mapAiQuoteList({ quotes: [emporixQuote], pagination: { page: 1, totalPages: 1, totalItems: 1 } });
    expect(list.quotes).toHaveLength(1);
    expect(list.quotes[0].quoteId).toBe('Q1000453');
    expect(list.pagination).toEqual({ page: 1, totalPages: 1, totalItems: 1 });
  });
});
