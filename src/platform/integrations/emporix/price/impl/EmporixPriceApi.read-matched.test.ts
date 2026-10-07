import { readMatchedPricesResponse } from './EmporixPriceApi';

describe('readMatchedPricesResponse', () => {
  it('treats HTTP 404 as no matched prices (not a thrown error)', async () => {
    const response = new Response('no price', { status: 404, statusText: 'Not Found' });

    await expect(readMatchedPricesResponse(response)).resolves.toEqual([]);
  });

  it('returns the JSON body on success', async () => {
    const matches = [{ itemId: { id: 'p1' }, currency: 'EUR' }];
    const response = new Response(JSON.stringify(matches), { status: 200 });

    await expect(readMatchedPricesResponse(response)).resolves.toEqual(matches);
  });

  it('throws on a non-404 failure so callers can fail the price request', async () => {
    const response = new Response('boom', { status: 503, statusText: 'Service Unavailable' });

    await expect(readMatchedPricesResponse(response)).rejects.toThrow(
      'Failed to match prices: Service Unavailable boom',
    );
  });
});
