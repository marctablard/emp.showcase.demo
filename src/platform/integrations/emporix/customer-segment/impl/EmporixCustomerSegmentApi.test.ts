import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type EmporixApiInvoker from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import type { ItemAssignmentResponse, SegmentResponse } from '../../model';
import EmporixCustomerSegmentApi from './EmporixCustomerSegmentApi';

describe('EmporixCustomerSegmentApi', () => {
  const config: EmporixConfig = {
    baseUrl: 'https://api.emporix.io',
    tenant: 'test-tenant',
    clientId: 'test-client-id',
    clientSecret: '',
    serverClientId: '',
    serverClientSecret: '',
  };

  let apiClient: jest.Mocked<Pick<EmporixApiInvoker, 'authenticatedFetch'>>;
  let logger: jest.Mocked<LoggerService>;
  let api: EmporixCustomerSegmentApi;

  const rawResponse = (
    body: string,
    init: { status?: number; headers?: Record<string, string>; statusText?: string } = {},
  ): Response => {
    const status = init.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: init.statusText ?? (status === 200 ? 'OK' : `HTTP ${status}`),
      headers: new Headers(init.headers),
      text: jest.fn().mockResolvedValue(body),
      json: jest.fn().mockImplementation(() => Promise.resolve(JSON.parse(body))),
    } as unknown as Response;
  };

  const jsonResponse = (body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response =>
    rawResponse(JSON.stringify(body), {
      ...init,
      headers: { 'content-type': 'application/json', ...init.headers },
    });

  const segment: SegmentResponse = { id: 'solarpanelfans', name: { en: 'Solar Panel Buyers' }, status: 'ACTIVE' };
  const assignment: ItemAssignmentResponse = {
    segmentId: 'solarpanelfans',
    metadata: { version: 1 },
    item: { id: 'cat-1', code: 'accessories', name: { en: 'Accessories' } },
    type: 'CATEGORY',
  };

  const lastCall = () => {
    const call = apiClient.authenticatedFetch.mock.calls.at(-1);
    if (!call) {
      throw new Error('authenticatedFetch was not called');
    }
    const [url, options, tokenType, authOptions, metrics] = call;
    return { url, parsedUrl: new URL(url, config.baseUrl), options, tokenType, authOptions, metrics };
  };

  beforeEach(() => {
    apiClient = { authenticatedFetch: jest.fn().mockResolvedValue(jsonResponse([])) };
    logger = {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;
    api = new EmporixCustomerSegmentApi(apiClient as unknown as EmporixApiInvoker, config, logger);
  });

  describe('getMySegments', () => {
    it.each([404, 405, 401, 403])('returns null for HTTP %i', async (status) => {
      apiClient.authenticatedFetch.mockResolvedValue(rawResponse('', { status }));

      await expect(api.getMySegments()).resolves.toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(expect.objectContaining({ status }), expect.any(String));
    });

    it('returns null for 200 with an empty body and no content-type (api-develop probe shape)', async () => {
      apiClient.authenticatedFetch.mockResolvedValue(rawResponse(''));

      await expect(api.getMySegments()).resolves.toBeNull();
      expect(logger.debug).toHaveBeenCalledTimes(1);
    });

    it('returns null for 200 with a JSON content-type but empty body', async () => {
      apiClient.authenticatedFetch.mockResolvedValue(
        rawResponse('', { headers: { 'content-type': 'application/json' } }),
      );

      await expect(api.getMySegments()).resolves.toBeNull();
    });

    it('returns null for 200 with a text/html body', async () => {
      apiClient.authenticatedFetch.mockResolvedValue(
        rawResponse('<html><body>Not found</body></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } }),
      );

      await expect(api.getMySegments()).resolves.toBeNull();
    });

    it('returns null for 200 with invalid JSON under a JSON content-type', async () => {
      apiClient.authenticatedFetch.mockResolvedValue(
        rawResponse('{not json', { headers: { 'content-type': 'application/json' } }),
      );

      await expect(api.getMySegments()).resolves.toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(SyntaxError) }),
        expect.any(String),
      );
    });

    it('returns null for 200 with a JSON object body', async () => {
      apiClient.authenticatedFetch.mockResolvedValue(jsonResponse({ id: 'solarpanelfans' }));

      await expect(api.getMySegments()).resolves.toBeNull();
    });

    it('returns the array for 200 with a JSON array body', async () => {
      apiClient.authenticatedFetch.mockResolvedValue(jsonResponse([segment]));

      await expect(api.getMySegments()).resolves.toEqual([segment]);
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('returns an empty array for 200 with an empty JSON array (legitimate "no segments")', async () => {
      apiClient.authenticatedFetch.mockResolvedValue(jsonResponse([]));

      await expect(api.getMySegments()).resolves.toEqual([]);
    });

    it('calls me/segments with the session token, metrics and forwarded legalEntityId/siteCode', async () => {
      await api.getMySegments({ legalEntityId: 'le-1', siteCode: 'main' });

      const { parsedUrl, options, tokenType, authOptions, metrics } = lastCall();
      expect(parsedUrl.pathname).toBe('/customer-segment/test-tenant/me/segments');
      expect(parsedUrl.searchParams.get('legalEntityId')).toBe('le-1');
      expect(parsedUrl.searchParams.get('siteCode')).toBe('main');
      expect(options).toEqual({ method: 'GET' });
      expect(tokenType).toBe('session');
      expect(authOptions).toBeUndefined();
      expect(metrics).toEqual({ source: 'customer-segment', routePattern: '/customer-segment/{tenant}/me/segments' });
    });

    it('omits the query string when no params are given', async () => {
      await api.getMySegments();

      expect(lastCall().url).toBe('/customer-segment/test-tenant/me/segments');
    });

    it('propagates invoker errors instead of swallowing them', async () => {
      apiClient.authenticatedFetch.mockRejectedValue(new Error('network down'));

      await expect(api.getMySegments()).rejects.toThrow('network down');
    });
  });

  describe('getSegments', () => {
    it('returns the JSON array with the session token and metrics', async () => {
      apiClient.authenticatedFetch.mockResolvedValue(jsonResponse([segment]));

      await expect(api.getSegments({ legalEntityId: 'le-1', siteCode: 'main', pageSize: 100 })).resolves.toEqual([
        segment,
      ]);

      const { parsedUrl, options, tokenType, metrics } = lastCall();
      expect(parsedUrl.pathname).toBe('/customer-segment/test-tenant/segments');
      expect(parsedUrl.searchParams.get('legalEntityId')).toBe('le-1');
      expect(parsedUrl.searchParams.get('siteCode')).toBe('main');
      expect(parsedUrl.searchParams.get('pageSize')).toBe('100');
      expect(options).toEqual({ method: 'GET' });
      expect(tokenType).toBe('session');
      expect(metrics).toEqual({ source: 'customer-segment', routePattern: '/customer-segment/{tenant}/segments' });
    });

    it('throws on a non-ok response like the existing methods', async () => {
      apiClient.authenticatedFetch.mockResolvedValue(rawResponse('', { status: 403, statusText: 'Forbidden' }));

      await expect(api.getSegments()).rejects.toThrow('Failed to retrieve customer segments: Forbidden');
    });
  });

  describe('getSegmentItems', () => {
    it('builds the URL with siteCode/onlyActive/pageSize/pageNumber and returns X-Total-Count', async () => {
      apiClient.authenticatedFetch.mockResolvedValue(
        jsonResponse([assignment], { headers: { 'X-Total-Count': '350' } }),
      );

      const result = await api.getSegmentItems({ siteCode: 'main', onlyActive: true, pageSize: 200, pageNumber: 2 });

      expect(result).toEqual({ items: [assignment], totalCount: 350 });

      const { url, parsedUrl, options, tokenType, metrics } = lastCall();
      expect(parsedUrl.pathname).toBe('/customer-segment/test-tenant/segments/items');
      expect(url).toContain('siteCode=main');
      expect(url).toContain('onlyActive=true');
      expect(url).toContain('pageSize=200');
      expect(url).toContain('pageNumber=2');
      expect(options).toEqual({ method: 'GET', headers: { 'X-Total-Count': 'true' } });
      expect(tokenType).toBe('session');
      expect(metrics).toEqual({
        source: 'customer-segment',
        routePattern: '/customer-segment/{tenant}/segments/items',
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('serialises onlyActive=false explicitly', async () => {
      await api.getSegmentItems({ onlyActive: false });

      expect(lastCall().parsedUrl.searchParams.get('onlyActive')).toBe('false');
    });

    it('falls back to items.length and warns when X-Total-Count is missing', async () => {
      apiClient.authenticatedFetch.mockResolvedValue(jsonResponse([assignment, assignment]));

      const result = await api.getSegmentItems({ pageNumber: 1 });

      expect(result).toEqual({ items: [assignment, assignment], totalCount: 2 });
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ itemCount: 2, pageNumber: 1 }),
        expect.stringContaining('X-Total-Count'),
      );
    });

    it('throws on a non-ok response', async () => {
      apiClient.authenticatedFetch.mockResolvedValue(rawResponse('', { status: 500, statusText: 'Server Error' }));

      await expect(api.getSegmentItems()).rejects.toThrow('Failed to retrieve customer segment items: Server Error');
    });
  });

  describe('getCategoryTrees', () => {
    it('uses the session token, metrics and forwards siteCode/legalEntityId', async () => {
      apiClient.authenticatedFetch.mockResolvedValue(jsonResponse([{ id: 'cat-1', name: { en: 'Root' } }]));

      await expect(api.getCategoryTrees({ siteCode: 'main', legalEntityId: 'le-1' })).resolves.toEqual([
        { id: 'cat-1', name: { en: 'Root' } },
      ]);

      const { parsedUrl, options, tokenType, metrics } = lastCall();
      expect(parsedUrl.pathname).toBe('/customer-segment/test-tenant/segments/items/category-trees');
      expect(parsedUrl.searchParams.get('siteCode')).toBe('main');
      expect(parsedUrl.searchParams.get('legalEntityId')).toBe('le-1');
      expect(options).toEqual({ method: 'GET' });
      expect(tokenType).toBe('session');
      expect(metrics).toEqual({
        source: 'customer-segment',
        routePattern: '/customer-segment/{tenant}/segments/items/category-trees',
      });
    });
  });
});
