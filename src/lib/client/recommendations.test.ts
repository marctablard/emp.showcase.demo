describe('fetchRecommendations', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('dedupes concurrent fetches for the same product id', async () => {
    let resolveResponse!: (r: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });

    const fetchMock = jest.fn().mockReturnValue(pending);
    global.fetch = fetchMock as unknown as typeof fetch;

    const { fetchRecommendations } = await import('./recommendations');

    const first = fetchRecommendations('18473086--18473086004');
    const second = fetchRecommendations('18473086--18473086004');

    resolveResponse({
      ok: true,
      json: async () => ({ products: [{ id: 'rec-1' }] }),
    } as Response);

    const [a, b] = await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ products: [{ id: 'rec-1' }] });
    expect(b).toEqual({ products: [{ id: 'rec-1' }] });
  });
});
