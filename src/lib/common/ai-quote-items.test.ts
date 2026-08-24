import { mapAiQuoteItems } from './ai-quote-items';

describe('mapAiQuoteItems', () => {
  it('flattens Emporix quote items onto Helper DTO rows', () => {
    expect(
      mapAiQuoteItems(
        [
          {
            quantity: { quantity: 2, unitCode: 'pc' },
            product: {
              id: 'P1',
              name: { en: 'Solar panel' },
              media: { url: 'https://cdn.example/panel.jpg' },
            },
            price: { currency: 'EUR', netValue: 40, grossValue: 50, taxValue: 10 },
          },
        ],
        'en',
      ),
    ).toEqual([
      {
        productId: 'P1',
        name: 'Solar panel',
        image: 'https://cdn.example/panel.jpg',
        description: undefined,
        quantity: 2,
        price: 50,
        currency: 'EUR',
        unitPrice: { value: 50, gross: 50, net: 40, tax: 10, currency: 'EUR' },
        totalPrice: { value: 100, gross: 100, net: 80, tax: 20, currency: 'EUR' },
      },
    ]);
  });
});
