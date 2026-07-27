describe('fetchProductVariants', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('dedupes concurrent fetches for the same parentId', async () => {
    let resolveResponse!: (r: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });

    const fetchMock = jest.fn().mockReturnValue(pending);
    global.fetch = fetchMock as unknown as typeof fetch;

    const { fetchProductVariants: fetchVariants } = await import('@/lib/client/products');

    const p1 = fetchVariants('parent-1');
    const p2 = fetchVariants('parent-1');

    resolveResponse({
      ok: true,
      json: async () => ({ variants: [{ id: 'v1' }] }),
    } as Response);

    const [a, b] = await Promise.all([p1, p2]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual([{ id: 'v1' }]);
    expect(b).toEqual([{ id: 'v1' }]);
  });
});
