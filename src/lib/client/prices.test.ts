describe('fetchProductPrices', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('dedupes concurrent batch price fetches for the same products and currency', async () => {
    let resolveResponse!: (r: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });

    const fetchMock = jest.fn().mockReturnValue(pending);
    global.fetch = fetchMock as unknown as typeof fetch;

    const { fetchProductPrices } = await import('./prices');

    const first = fetchProductPrices(['v1', 'v2'], 'EUR');
    const second = fetchProductPrices(['v2', 'v1'], 'EUR');

    resolveResponse({
      ok: true,
      json: async () => ({ v1: { amount: 10 }, v2: { amount: 20 } }),
    } as Response);

    const [a, b] = await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ v1: { amount: 10 }, v2: { amount: 20 } });
    expect(b).toEqual({ v1: { amount: 10 }, v2: { amount: 20 } });
  });
});
