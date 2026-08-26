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
});
