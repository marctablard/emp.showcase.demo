import { CURRENCY_COOKIE_NAME } from '@/lib/common/cookie-names';
import { PATCH } from './route';

/**
 * Route-level tests for `PATCH /api/session`. Focus: the `next-currency`
 * cookie is written on every path that successfully advances the session
 * currency, and is suppressed when the PATCH does not touch currency or the
 * upstream call fails.
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

function createRequest(body: unknown, options: { invalidJson?: boolean } = {}): { json: () => Promise<unknown> } {
  return {
    json: jest.fn(() => (options.invalidJson ? Promise.reject(new Error('bad json')) : Promise.resolve(body))),
  };
}

describe('PATCH /api/session', () => {
  let sessionService: MockService;
  let logger: MockService;
  const originalSiteCookieEnv = process.env.NEXT_PUBLIC_SITE_COOKIE;

  beforeEach(() => {
    sessionService = {
      getCurrent: jest.fn(),
      updateContext: jest.fn(),
      setLanguage: jest.fn(),
      setCurrency: jest.fn(),
      setCountry: jest.fn(),
      setSite: jest.fn(),
    };
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      trace: jest.fn(),
    };

    mockedServer.default.__services.clear();
    mockedServer.default.__services.set('SessionService', sessionService);
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));

    process.env.NEXT_PUBLIC_SITE_COOKIE = 'NEXT_SITE';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_COOKIE = originalSiteCookieEnv;
  });

  it('combined path with currency — sets the currency cookie from the canonical post-PATCH value', async () => {
    sessionService.updateContext.mockResolvedValue({
      id: 's1',
      siteCode: 'us',
      currency: 'USD',
      language: 'en',
    });

    const response = await PATCH(createRequest({ siteCode: 'us', currency: 'USD' }) as never);

    expect(response.status).toBe(200);
    expect(sessionService.updateContext).toHaveBeenCalledWith(
      expect.objectContaining({ siteCode: 'us', currency: 'USD' }),
      expect.any(Object),
    );
    expect(response.cookies.get(CURRENCY_COOKIE_NAME)?.value).toBe('USD');
    expect(response.cookies.get('NEXT_SITE')?.value).toBe('us');
  });

  it('legacy per-field path with only currency — sets the currency cookie', async () => {
    sessionService.setCurrency.mockResolvedValue(undefined);
    sessionService.getCurrent.mockResolvedValue({
      id: 's1',
      siteCode: 'main',
      currency: 'USD',
    });

    const response = await PATCH(createRequest({ currency: 'USD' }) as never);

    expect(response.status).toBe(200);
    expect(sessionService.updateContext).not.toHaveBeenCalled();
    expect(sessionService.setCurrency).toHaveBeenCalledWith('USD');
    expect(response.cookies.get(CURRENCY_COOKIE_NAME)?.value).toBe('USD');
  });

  it('PATCH with siteCode only — site cookie set, currency cookie NOT set', async () => {
    sessionService.setSite.mockResolvedValue(undefined);
    sessionService.getCurrent.mockResolvedValue({ id: 's1', siteCode: 'us', currency: 'EUR' });

    const response = await PATCH(createRequest({ siteCode: 'us' }) as never);

    expect(response.status).toBe(200);
    expect(response.cookies.get('NEXT_SITE')?.value).toBe('us');
    expect(response.cookies.get(CURRENCY_COOKIE_NAME)).toBeUndefined();
  });

  it('falls back to the requested currency value when the legacy path does not return the updated session', async () => {
    // Covers the `updatedSession?.currency || fields.currency` branch when
    // `getCurrent()` is stale or returns undefined.
    sessionService.setCurrency.mockResolvedValue(undefined);
    sessionService.getCurrent.mockResolvedValue(undefined);

    const response = await PATCH(createRequest({ currency: 'USD' }) as never);

    expect(response.status).toBe(200);
    expect(response.cookies.get(CURRENCY_COOKIE_NAME)?.value).toBe('USD');
  });

  it('does NOT set the cookie when the combined PATCH throws (500 path)', async () => {
    sessionService.updateContext.mockRejectedValue(
      new Error('Failed to update own session context: Not Found (version has not been found)'),
    );

    const response = await PATCH(createRequest({ siteCode: 'us', currency: 'USD' }) as never);

    expect(response.status).toBe(500);
    expect(response.cookies.get(CURRENCY_COOKIE_NAME)).toBeUndefined();
    expect(response.cookies.get('NEXT_SITE')).toBeUndefined();
  });

  it('returns 400 and sets no cookies on invalid JSON body', async () => {
    const response = await PATCH(createRequest(undefined, { invalidJson: true }) as never);

    expect(response.status).toBe(400);
    expect(response.cookies.get(CURRENCY_COOKIE_NAME)).toBeUndefined();
    expect(response.cookies.get('NEXT_SITE')).toBeUndefined();
  });
});
