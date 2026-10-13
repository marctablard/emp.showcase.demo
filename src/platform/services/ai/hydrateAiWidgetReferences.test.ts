import { type AiWidgetEntityFetchers, hydrateAiWidgetReferences } from './hydrateAiWidgetReferences';

function createFetchers(entities: Record<string, unknown> = {}): jest.Mocked<AiWidgetEntityFetchers> {
  const lookup = jest.fn(async (id: string) => entities[id] ?? null);
  return { order: jest.fn(lookup), product: jest.fn(lookup), quote: jest.fn(lookup), return: jest.fn(lookup) };
}

const envelope = (type: string, data: unknown) =>
  JSON.stringify({ message: 'Caption.', type, data, cartRefresh: false });

describe('hydrateAiWidgetReferences', () => {
  it('loads referenced orders in the order the agent listed them', async () => {
    const fetchers = createFetchers({
      'EON-2': { id: 'EON-2', status: 'CREATED', created: '2026-10-09T10:00:00Z' },
      'EON-1': { id: 'EON-1', status: { value: 'SHIPPED' }, created: '2026-10-08T10:00:00Z' },
    });

    const parsed = JSON.parse(
      await hydrateAiWidgetReferences(envelope('order_list', { orderIds: ['EON-2', 'EON-1'] }), fetchers),
    );

    expect(parsed).toMatchObject({ message: 'Caption.', type: 'order_list', cartRefresh: false });
    expect(
      parsed.data.orders.map((order: { orderId: string; status: string }) => [order.orderId, order.status]),
    ).toEqual([
      ['EON-2', 'CREATED'],
      ['EON-1', 'SHIPPED'],
    ]);
    expect(parsed.data.orderIds).toBeUndefined();
  });

  it('loads products, quotes and returns through their own fetchers', async () => {
    const fetchers = createFetchers({
      'P-1': { id: 'P-1', name: { en: 'Inverter' } },
      'Q-1': { id: 'Q-1', status: 'OPEN' },
      'R-1': { id: 'R-1', status: 'PENDING' },
    });

    const products = JSON.parse(
      await hydrateAiWidgetReferences(envelope('product_list', { productIds: ['P-1'] }), fetchers),
    );
    const quotes = JSON.parse(await hydrateAiWidgetReferences(envelope('quote_list', { quoteIds: ['Q-1'] }), fetchers));
    const quote = JSON.parse(
      await hydrateAiWidgetReferences(envelope('quote_details', { quoteIds: ['Q-1'] }), fetchers),
    );
    const returns = JSON.parse(
      await hydrateAiWidgetReferences(envelope('return_list', { returnIds: ['R-1'] }), fetchers),
    );

    expect(products.data.products).toEqual([{ productId: 'P-1', name: 'Inverter' }]);
    expect(quotes.data.quotes).toEqual([{ id: 'Q-1', status: 'OPEN' }]);
    expect(quote.data).toMatchObject({ id: 'Q-1', status: 'OPEN' });
    expect(returns.data.returns).toEqual([{ id: 'R-1', status: 'PENDING' }]);
    expect(fetchers.product).toHaveBeenCalledWith('P-1');
    expect(fetchers.return).toHaveBeenCalledWith('R-1');
  });

  it('keeps widget data that already came from the tool result', async () => {
    const fetchers = createFetchers();
    const message = envelope('order_list', { orders: [{ orderId: 'EON-1' }], orderIds: ['EON-1'] });

    await expect(hydrateAiWidgetReferences(message, fetchers)).resolves.toBe(message);
    expect(fetchers.order).not.toHaveBeenCalled();
  });

  it('never puts unsafe IDs into API paths', async () => {
    const fetchers = createFetchers();

    await hydrateAiWidgetReferences(
      envelope('order_list', { orderIds: ['../customers', 'a/b', 42, 'EON-1'] }),
      fetchers,
    );

    expect(fetchers.order).toHaveBeenCalledTimes(1);
    expect(fetchers.order).toHaveBeenCalledWith('EON-1');
  });

  it('skips entities that fail to load', async () => {
    const fetchers = createFetchers({ 'EON-2': { id: 'EON-2', status: 'CREATED' } });
    fetchers.order.mockImplementation(async (id) => {
      if (id === 'EON-1') {
        throw new Error('403');
      }
      return { id, status: 'CREATED' };
    });

    const parsed = JSON.parse(
      await hydrateAiWidgetReferences(envelope('order_list', { orderIds: ['EON-1', 'EON-2'] }), fetchers),
    );

    expect(parsed.data.orders.map((order: { orderId: string }) => order.orderId)).toEqual(['EON-2']);
  });

  it('falls back to the caption when nothing could be loaded', async () => {
    const parsed = JSON.parse(
      await hydrateAiWidgetReferences(envelope('order_list', { orderIds: ['EON-404'] }), createFetchers()),
    );

    expect(parsed).toEqual({ message: 'Caption.', type: 'order_list', data: null, cartRefresh: false });
  });

  it('leaves plain text, unknown types and data-less envelopes untouched', async () => {
    const fetchers = createFetchers();
    const messages = ['Just text', envelope('text', null), envelope('order_list', null), envelope('cart_summary', {})];

    for (const message of messages) {
      await expect(hydrateAiWidgetReferences(message, fetchers)).resolves.toBe(message);
    }
    expect(fetchers.order).not.toHaveBeenCalled();
  });
});
