/**
 * @jest-environment jsdom
 */
import { fetchOrdersPage } from './orders';

describe('fetchOrdersPage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('preserves JSON API error payload instead of generic status text', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => JSON.stringify({ error: 'Order query invalid' }),
      headers: new Headers(),
    } as Response);

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(fetchOrdersPage(5, 1, 'invalid:q')).rejects.toThrow('Order query invalid');
  });
});
