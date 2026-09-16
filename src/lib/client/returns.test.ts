import type { Return } from '@/platform/services/model/return';
import {
  ReturnApiError,
  createReturn,
  fetchReturnById,
  fetchReturns,
  fetchReturnsForOrder,
  fetchReturnsForOrderIds,
  fetchReturnsPage,
} from './returns';

interface ResponseInitLike {
  ok?: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
}

/** Minimal Response-like object whose `.json()`/`.text()` resolve to `body`. */
function jsonResponse<T>(body: T, init: ResponseInitLike = {}): Response {
  const status = init.status ?? 200;
  return {
    ok: init.ok ?? (status >= 200 && status < 300),
    status,
    statusText: init.statusText ?? 'OK',
    headers: new Map(Object.entries(init.headers ?? {})),
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

/** Replace `global.fetch` for one test. The jest setup resets mocks per test, so install in beforeEach. */
function installFetchMock(): jest.Mock {
  const mock = jest.fn();
  (global as unknown as { fetch: jest.Mock }).fetch = mock;
  return mock;
}

describe('lib/client/returns', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = installFetchMock();
  });

  describe('createReturn', () => {
    it('posts the return payload and returns the created id', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'ret-1' }));

      const result = await createReturn('order-1', [{ id: 'item-1', quantity: 1 }], 'DEFECTIVE');

      expect(fetchMock).toHaveBeenCalledWith('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: 'order-1',
          items: [{ id: 'item-1', quantity: 1 }],
          reasonCode: 'DEFECTIVE',
          reasonDetails: undefined,
        }),
      });
      expect(result).toEqual({ id: 'ret-1' });
    });

    it('trims reasonDetails and includes it in the body when non-empty', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'ret-2' }));

      await createReturn('order-2', [{ id: 'item-1', quantity: 2 }], 'OTHER', '  broken on arrival  ');

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/returns',
        expect.objectContaining({
          body: JSON.stringify({
            orderId: 'order-2',
            items: [{ id: 'item-1', quantity: 2 }],
            reasonCode: 'OTHER',
            reasonDetails: 'broken on arrival',
          }),
        }),
      );
    });

    it('omits reasonDetails when it is only whitespace', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'ret-3' }));

      await createReturn('order-3', [{ id: 'item-1', quantity: 1 }], 'OTHER', '   ');

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/returns',
        expect.objectContaining({
          body: JSON.stringify({
            orderId: 'order-3',
            items: [{ id: 'item-1', quantity: 1 }],
            reasonCode: 'OTHER',
            reasonDetails: undefined,
          }),
        }),
      );
    });

    it('throws a retry message when the upstream service failed with a 5xx', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ upstreamStatus: 503, error: 'ignored-since-upstream-wins' }, { ok: false, status: 502 }),
      );

      await expect(createReturn('order-4', [{ id: 'item-1', quantity: 1 }], 'OTHER')).rejects.toThrow(
        'Returns service failed upstream (503). Please retry.',
      );
    });

    it('throws the error field from the response body when present', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Order already returned' }, { ok: false, status: 409 }));

      await expect(createReturn('order-5', [{ id: 'item-1', quantity: 1 }], 'OTHER')).rejects.toThrow(
        'Order already returned',
      );
    });

    it('falls back to a status-based message when the body has no error field', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 400 }));

      await expect(createReturn('order-6', [{ id: 'item-1', quantity: 1 }], 'OTHER')).rejects.toThrow(
        'Failed to create return (400)',
      );
    });

    it('falls back to a status-based message when the error body cannot be parsed as JSON', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      } as unknown as Response);

      await expect(createReturn('order-7', [{ id: 'item-1', quantity: 1 }], 'OTHER')).rejects.toThrow(
        'Failed to create return (500)',
      );
    });

    it('falls back to a status-based message when the error body is a JSON array', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ['unexpected', 'array'],
      } as unknown as Response);

      await expect(createReturn('order-8', [{ id: 'item-1', quantity: 1 }], 'OTHER')).rejects.toThrow(
        'Failed to create return (422)',
      );
    });

    it('falls back to a status-based message when the error body is a JSON primitive', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => 'plain string body',
      } as unknown as Response);

      await expect(createReturn('order-9', [{ id: 'item-1', quantity: 1 }], 'OTHER')).rejects.toThrow(
        'Failed to create return (400)',
      );
    });

    it('rejects with a ReturnApiError carrying status, reason and upstream details', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          { error: 'Validation failed', reason: 'INVALID_ITEM', upstreamStatus: 400, upstreamMessage: 'bad item' },
          { ok: false, status: 400 },
        ),
      );

      let caught: unknown;
      try {
        await createReturn('order-10', [{ id: 'item-1', quantity: 1 }], 'OTHER');
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(ReturnApiError);
      const apiError = caught as ReturnApiError;
      expect(apiError.status).toBe(400);
      expect(apiError.reason).toBe('INVALID_ITEM');
      expect(apiError.upstreamStatus).toBe(400);
      expect(apiError.upstreamMessage).toBe('bad item');
    });
  });

  describe('ReturnApiError', () => {
    it('leaves reason and upstream fields undefined when no details are given', () => {
      const error = new ReturnApiError('plain failure', 418);

      expect(error.message).toBe('plain failure');
      expect(error.status).toBe(418);
      expect(error.reason).toBeUndefined();
      expect(error.upstreamStatus).toBeUndefined();
      expect(error.upstreamMessage).toBeUndefined();
    });
  });

  describe('fetchReturnsPage', () => {
    const sampleReturn: Return = { id: 'r1' } as unknown as Return;

    it('requests /api/returns without a query string when no options are given', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([sampleReturn]));

      const result = await fetchReturnsPage();

      expect(fetchMock).toHaveBeenCalledWith('/api/returns', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result.items).toEqual([sampleReturn]);
    });

    it('builds a query string from pageSize, pageNumber, query and sort', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([sampleReturn]));

      await fetchReturnsPage(20, 2, 'orders._id:o1', 'createdAt');

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/returns?pageSize=20&pageNumber=2&query=orders._id%3Ao1&sort=createdAt',
        expect.anything(),
      );
    });

    it('parses a numeric x-total-count header into totalCount', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([sampleReturn], { headers: { 'x-total-count': '7' } }));

      const result = await fetchReturnsPage(11);

      expect(result.totalCount).toBe(7);
    });

    it('leaves totalCount undefined when the header is missing', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([sampleReturn]));

      const result = await fetchReturnsPage(12);

      expect(result.totalCount).toBeUndefined();
    });

    it('leaves totalCount undefined when the header is not a valid number', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([sampleReturn], { headers: { 'x-total-count': 'not-a-number' } }));

      const result = await fetchReturnsPage(13);

      expect(result.totalCount).toBeUndefined();
    });

    it('caches a successful page and does not re-fetch within the TTL', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([sampleReturn]));

      const first = await fetchReturnsPage(14);
      const second = await fetchReturnsPage(14);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(second).toEqual(first);
    });

    it('bypasses the cache when forceRefresh is true', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([sampleReturn]));
      fetchMock.mockResolvedValueOnce(jsonResponse([sampleReturn, sampleReturn]));

      await fetchReturnsPage(15);
      const second = await fetchReturnsPage(15, undefined, undefined, undefined, true);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(second.items).toHaveLength(2);
    });

    it('re-fetches once the cache entry has expired', async () => {
      jest.useFakeTimers();
      try {
        fetchMock.mockResolvedValueOnce(jsonResponse([sampleReturn]));
        fetchMock.mockResolvedValueOnce(jsonResponse([sampleReturn, sampleReturn]));

        await fetchReturnsPage(16);
        jest.advanceTimersByTime(60_001);
        const second = await fetchReturnsPage(16);

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(second.items).toHaveLength(2);
      } finally {
        jest.useRealTimers();
      }
    });

    it('dedupes concurrent requests for the same URL into a single fetch call', async () => {
      let resolveFetch!: (value: Response) => void;
      fetchMock.mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      );

      const first = fetchReturnsPage(17);
      const second = fetchReturnsPage(17);

      resolveFetch(jsonResponse([sampleReturn]));

      const [firstResult, secondResult] = await Promise.all([first, second]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(firstResult).toEqual(secondResult);
    });

    it('throws the error message from the response body on failure', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Not allowed' }, { ok: false, status: 403 }));

      await expect(fetchReturnsPage(18)).rejects.toThrow('Not allowed');
    });

    it('falls back to a generic message when the failure body has no error field', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

      await expect(fetchReturnsPage(19)).rejects.toThrow('Failed to fetch returns');
    });
  });

  describe('fetchReturns', () => {
    it('resolves to just the items from fetchReturnsPage', async () => {
      const sampleReturn: Return = { id: 'r-only' } as unknown as Return;
      fetchMock.mockResolvedValueOnce(jsonResponse([sampleReturn], { headers: { 'x-total-count': '1' } }));

      const result = await fetchReturns(21);

      expect(result).toEqual([sampleReturn]);
    });
  });

  describe('fetchReturnsForOrderIds', () => {
    it('returns an empty array without calling fetch when given no order ids', async () => {
      const result = await fetchReturnsForOrderIds([]);

      expect(result).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('builds a single-id query for one order id', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([]));

      await fetchReturnsForOrderIds(['order-a']);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`query=${encodeURIComponent('orders._id:order-a')}`),
        expect.anything(),
      );
    });

    it('builds a deduped, sorted multi-id query for several order ids', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([]));

      await fetchReturnsForOrderIds(['order-z', 'order-a', 'order-z']);

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/returns?query=orders._id%3A%28order-a%2Corder-z%29',
        expect.anything(),
      );
    });
  });

  describe('fetchReturnsForOrder', () => {
    it('delegates to fetchReturnsForOrderIds with a single-element array', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([]));

      await fetchReturnsForOrder('order-single');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`query=${encodeURIComponent('orders._id:order-single')}`),
        expect.anything(),
      );
    });
  });

  describe('cache invalidation', () => {
    it('drops cached returns after a return was created, so returnability is recomputed', async () => {
      const page = [{ id: 'ret-1' }];
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => '1' },
        json: jest.fn().mockResolvedValue(page),
      } as unknown as Response);

      await fetchReturnsPage(5, 1);
      await fetchReturnsPage(5, 1);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: jest.fn().mockResolvedValue({ id: 'new-return' }),
      } as unknown as Response);
      await createReturn('order-1', [{ id: 'item-1', quantity: 1 }], 'DEFECTIVE');

      await fetchReturnsPage(5, 1);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('fetchReturnById', () => {
    it('returns the return on success', async () => {
      const ret: Return = { id: 'ret-42' } as unknown as Return;
      fetchMock.mockResolvedValueOnce(jsonResponse(ret));

      const result = await fetchReturnById('ret-42');

      expect(fetchMock).toHaveBeenCalledWith('/api/returns/ret-42', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result).toEqual(ret);
    });

    it('falls back to the status code when the 404 body is empty', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: jest.fn() } as unknown as Response);

      await expect(fetchReturnById('missing')).rejects.toMatchObject({
        message: 'Return not found',
        code: 'RETURN_NOT_FOUND',
      });
    });

    it('takes the code and message from the 404 body when the route sends one', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: jest.fn().mockResolvedValue({ error: 'Return gone for good', code: 'RETURN_FETCH_FAILED' }),
      } as unknown as Response);

      // Deliberately not RETURN_NOT_FOUND: with the fallback value the assertion would hold even
      // if the client kept re-inventing the code instead of reading the route's.
      await expect(fetchReturnById('missing')).rejects.toMatchObject({
        message: 'Return gone for good',
        code: 'RETURN_FETCH_FAILED',
      });
    });

    it('throws the error field from the body for other failures', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Access denied' }, { ok: false, status: 403 }));

      await expect(fetchReturnById('ret-43')).rejects.toThrow('Access denied');
    });

    it('falls back to a generic message when the failure body has no error field', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

      await expect(fetchReturnById('ret-44')).rejects.toThrow('Failed to fetch return');
    });
  });
});
