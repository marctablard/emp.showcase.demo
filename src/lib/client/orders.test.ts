/**
 * @jest-environment jsdom
 */
import { fetchOrdersPage } from './orders';

describe('fetchOrdersPage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('forwards explicit pageSize/pageNumber values when they are 0', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '',
      headers: new Headers(),
      json: async () => [],
    } as Response);

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchOrdersPage(0, 0);

    expect(fetchMock).toHaveBeenCalledWith('/api/orders?pageSize=0&pageNumber=0');
  });

  it('omits pageSize/pageNumber when they are undefined', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '',
      headers: new Headers(),
      json: async () => [],
    } as Response);

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchOrdersPage();

    expect(fetchMock).toHaveBeenCalledWith('/api/orders');
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
