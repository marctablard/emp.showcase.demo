import { NextRequest } from 'next/server';
import { PRODUCTS_MODE_COOKIE_NAME } from '@/lib/common/products-mode-cookie';
import type { ProductsModeContext } from '@/platform/services/products-mode/ProductsModeService';
import { PUT } from './route';

/**
 * Route-level tests for `PUT /api/customer-segment/products-mode` (COP-4822).
 * Focus: body validation, server-side authority over `canToggleAllProducts`,
 * the `next-products-mode` cookie attributes and `Cache-Control: private, no-store`.
 */

jest.mock('@/platform/server', () => {
  const services = new Map<string, unknown>();
  return {
    __esModule: true,
    default: {
      get: jest.fn((id: string) => services.get(id)),
      __services: services,
    },
  };
});

const mockedServer = jest.requireMock('@/platform/server') as {
  default: { get: jest.Mock; __services: Map<string, unknown> };
};

type MockService = { [method: string]: jest.Mock };

const ROUTE_URL = 'http://localhost/api/customer-segment/products-mode';

function createRequest(body: unknown, options: { rawBody?: string; cookie?: string; site?: string } = {}): NextRequest {
  const url = options.site ? `${ROUTE_URL}?site=${options.site}` : ROUTE_URL;
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (options.cookie) {
    headers.set('cookie', `${PRODUCTS_MODE_COOKIE_NAME}=${options.cookie}`);
  }
  return new NextRequest(url, {
    method: 'PUT',
    headers,
    body: options.rawBody ?? JSON.stringify(body),
  });
}

function assignedContext(overrides: Partial<ProductsModeContext> = {}): ProductsModeContext {
  return {
    mode: 'assigned',
    segmentIds: ['seg-1'],
    canToggleAllProducts: true,
    engine: 'batteryincluded',
    siteCode: 'main',
    customerId: 'cust-42',
    ...overrides,
  };
}

function setCookieHeader(response: Response): string {
  return response.headers.get('set-cookie') ?? '';
}

function expectPrivateNoStore(response: Response): void {
  expect(response.headers.get('cache-control')).toBe('private, no-store');
}

describe('PUT /api/customer-segment/products-mode', () => {
  let productsModeService: MockService;
  let logger: MockService;

  beforeEach(() => {
    productsModeService = { resolve: jest.fn() };
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      trace: jest.fn(),
    };

    mockedServer.default.__services.clear();
    mockedServer.default.__services.set('ProductsModeService', productsModeService);
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  describe('invalid body', () => {
    it.each([
      ['unknown mode', { mode: 'anonymous' }],
      ['missing mode', {}],
      ['non-string mode', { mode: 1 }],
      ['null body', null],
    ])('%s → 400 without resolving the mode', async (_label, body) => {
      const response = await PUT(createRequest(body));

      expect(response.status).toBe(400);
      expect(productsModeService.resolve).not.toHaveBeenCalled();
      expect(setCookieHeader(response)).toBe('');
      expectPrivateNoStore(response);
    });

    it('malformed JSON → 400', async () => {
      const response = await PUT(createRequest(undefined, { rawBody: '{not json' }));

      expect(response.status).toBe(400);
      expect(productsModeService.resolve).not.toHaveBeenCalled();
      expectPrivateNoStore(response);
    });
  });

  it('canToggleAllProducts=false → 403 ALL_PRODUCTS_MODE_NOT_ALLOWED and Set-Cookie deletes next-products-mode', async () => {
    productsModeService.resolve.mockResolvedValue(
      assignedContext({ canToggleAllProducts: false, engine: 'emporix', segmentIds: [] }),
    );

    const response = await PUT(createRequest({ mode: 'all' }, { cookie: 'all.cust-42' }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'ALL_PRODUCTS_MODE_NOT_ALLOWED' });
    const setCookie = setCookieHeader(response);
    expect(setCookie).toContain(`${PRODUCTS_MODE_COOKIE_NAME}=;`);
    expect(setCookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    expect(setCookie).toContain('Path=/');
    expectPrivateNoStore(response);
  });

  it('canToggleAllProducts=false also rejects mode=assigned with 403 (no cookie left behind)', async () => {
    productsModeService.resolve.mockResolvedValue(assignedContext({ canToggleAllProducts: false }));

    const response = await PUT(createRequest({ mode: 'assigned' }));

    expect(response.status).toBe(403);
    expect(setCookieHeader(response)).toContain(`${PRODUCTS_MODE_COOKIE_NAME}=;`);
    expectPrivateNoStore(response);
  });

  it('mode=all → sets next-products-mode=all.<customerId> as HttpOnly, SameSite=Lax, Path=/ session cookie', async () => {
    productsModeService.resolve.mockResolvedValue(assignedContext());

    const response = await PUT(createRequest({ mode: 'all' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ mode: 'all' });
    const setCookie = setCookieHeader(response);
    expect(setCookie).toContain(`${PRODUCTS_MODE_COOKIE_NAME}=all.cust-42`);
    expect(setCookie).toContain('HttpOnly');
    // Cookie attribute values are case-insensitive; Next serialises `SameSite=lax`.
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toContain('Path=/');
    expect(setCookie).not.toMatch(/Max-Age=/i);
    expect(setCookie).not.toMatch(/Expires=/i);
    expectPrivateNoStore(response);
  });

  it('mode=assigned → 200 and Set-Cookie deletes next-products-mode', async () => {
    productsModeService.resolve.mockResolvedValue(assignedContext({ mode: 'all' }));

    const response = await PUT(createRequest({ mode: 'assigned' }, { cookie: 'all.cust-42' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ mode: 'assigned' });
    const setCookie = setCookieHeader(response);
    expect(setCookie).toContain(`${PRODUCTS_MODE_COOKIE_NAME}=;`);
    expect(setCookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    expect(setCookie).toContain('Path=/');
    expectPrivateNoStore(response);
  });

  it('forwards the opt-in cookie value and ?site to ProductsModeService.resolve', async () => {
    productsModeService.resolve.mockResolvedValue(assignedContext({ siteCode: 'us' }));

    await PUT(createRequest({ mode: 'all' }, { cookie: 'all.other', site: 'us' }));

    expect(productsModeService.resolve).toHaveBeenCalledWith({ optInCookieValue: 'all.other', siteCode: 'us' });
  });

  it('passes undefined cookie/site to resolve when absent', async () => {
    productsModeService.resolve.mockResolvedValue(assignedContext());

    await PUT(createRequest({ mode: 'all' }));

    expect(productsModeService.resolve).toHaveBeenCalledWith({ optInCookieValue: undefined, siteCode: undefined });
  });

  it('resolve failure → 500, logs via LoggerService, sets no cookie, still private', async () => {
    productsModeService.resolve.mockRejectedValue(new Error('upstream down'));

    const response = await PUT(createRequest({ mode: 'all' }));

    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'upstream down', path: '/api/customer-segment/products-mode', method: 'PUT' }),
      'Error updating products mode',
    );
    expect(setCookieHeader(response)).toBe('');
    expectPrivateNoStore(response);
  });
});
