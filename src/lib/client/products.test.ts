describe('fetchProductById', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  const okResponse = (body: unknown): Response => ({ ok: true, json: async () => body }) as Response;

  it('dedupes concurrent fetches for the same id within one dedupe scope', async () => {
    let resolveResponse!: (r: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = jest.fn().mockReturnValue(pending);
    global.fetch = fetchMock as unknown as typeof fetch;

    const { fetchProductById } = await import('@/lib/client/products');

    const p1 = fetchProductById('p-1');
    const p2 = fetchProductById('p-1');
    resolveResponse(okResponse({ id: 'p-1' }));

    await Promise.all([p1, p2]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not reuse an in-flight regular request for a products-mode validation scope (COP-4822)', async () => {
    const pendingRegular = new Promise<Response>(() => {});
    const fetchMock = jest
      .fn()
      .mockReturnValueOnce(pendingRegular)
      .mockReturnValueOnce(Promise.resolve({ ok: false, status: 404 } as Response));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { fetchProductById } = await import('@/lib/client/products');

    // A full-catalog request for the same product is still in flight...
    void fetchProductById('p-1');
    // ...but the assigned-mode visibility check must issue its own request and get its own (404) verdict.
    const validation = await fetchProductById(
      'p-1',
      undefined,
      'products-mode-validation:assigned:main:customer-1:p-1',
    );

    expect(validation).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/products/p-1?site=main',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('does not reuse an in-flight request when options.siteCode differs', async () => {
    const pendingMain = new Promise<Response>(() => {});
    const fetchMock = jest
      .fn()
      .mockReturnValueOnce(pendingMain)
      .mockReturnValueOnce(Promise.resolve({ ok: false, status: 404 } as Response));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { fetchProductById } = await import('@/lib/client/products');

    void fetchProductById('p-1', { siteCode: 'main' }, 'assigned:main:c-1');
    const otherSite = await fetchProductById('p-1', { siteCode: 'us' }, 'assigned:main:c-1');

    expect(otherSite).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/products/p-1?site=us',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });
});

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

    const p1 = fetchVariants('parent-1', 'assigned:main:c-1');
    const p2 = fetchVariants('parent-1', 'assigned:main:c-1');

    resolveResponse({
      ok: true,
      json: async () => ({ variants: [{ id: 'v1' }] }),
    } as Response);

    const [a, b] = await Promise.all([p1, p2]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/products/parent-1/variants?site=main',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(a).toEqual([{ id: 'v1' }]);
    expect(b).toEqual([{ id: 'v1' }]);
  });

  it('does not reuse an in-flight variants request from another products-mode scope', async () => {
    const pendingAssigned = new Promise<Response>(() => {});
    const fetchMock = jest
      .fn()
      .mockReturnValueOnce(pendingAssigned)
      .mockReturnValueOnce(
        Promise.resolve({ ok: true, json: async () => ({ variants: [{ id: 'v-all' }] }) } as Response),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { fetchProductVariants: fetchVariants } = await import('@/lib/client/products');

    void fetchVariants('parent-1', 'assigned:main:c-1');
    const allMode = await fetchVariants('parent-1', 'all:main:c-1');

    expect(allMode).toEqual([{ id: 'v-all' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
