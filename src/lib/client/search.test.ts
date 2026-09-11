import { fetchSearchResult, resetInFlightSearchRequests } from './search';

describe('fetchSearchResult', () => {
  beforeEach(() => {
    resetInFlightSearchRequests();
  });

  it('dedupes concurrent fetches for the same search URL', async () => {
    let resolveResponse!: (r: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });

    const fetchMock = jest.fn().mockReturnValue(pending);
    global.fetch = fetchMock as unknown as typeof fetch;

    const url = 'http://localhost/api/search?page=0&size=12&currency=EUR';
    const first = fetchSearchResult(url);
    const second = fetchSearchResult(url);

    resolveResponse({
      ok: true,
      json: async () => ({ items: [], total: 0, page: 0, pageSize: 12 }),
    } as Response);

    const [a, b] = await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ items: [], total: 0, page: 0, pageSize: 12 });
    expect(b).toEqual({ items: [], total: 0, page: 0, pageSize: 12 });
  });

  it('includes HTTP status when the search request fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: '',
    } as Response);

    await expect(fetchSearchResult('http://localhost/api/search')).rejects.toThrow('Search failed: 503 Request failed');
  });

  it('does not reuse an in-flight search from another products-mode scope', async () => {
    const pendingAssigned = new Promise<Response>(() => {});
    const fetchMock = jest
      .fn()
      .mockReturnValueOnce(pendingAssigned)
      .mockReturnValueOnce(
        Promise.resolve({
          ok: true,
          json: async () => ({ items: [{ id: 'all' }], total: 1, page: 0, pageSize: 12 }),
        } as Response),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const url = 'http://localhost/api/search?page=0';
    void fetchSearchResult(url, 'assigned:main:c-1');
    const allMode = await fetchSearchResult(url, 'all:main:c-1');

    expect(allMode).toEqual({ items: [{ id: 'all' }], total: 1, page: 0, pageSize: 12 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
