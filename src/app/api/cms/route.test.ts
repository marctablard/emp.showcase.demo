/**
 * Route-level tests for `GET /api/cms`.
 *
 * Contract under test:
 * - Resolves `CMSService` via `getCmsService()` (the SSR lazy-bind helper),
 *   not directly off `ssr.get(...)`.
 * - Happy-path: forwards `(slug, locale, site)` from query string to
 *   `cmsService.getPage(...)` and returns the result as JSON (200).
 * - Notfound result: `{ notfound: true }` is forwarded verbatim (still 200,
 *   the consumer interprets the shape).
 * - Service throws: response is 500 with `{ error: 'Failed to fetch CMS data' }`
 *   and the error is reported via `LoggerService.error(...)`.
 */
import type { NextRequest } from 'next/server';
// Import AFTER the mocks so the route module picks up the mocked DI lookups.
import { GET } from './route';

jest.mock('@/platform/services/cms/get-cms-service', () => ({
  __esModule: true,
  getCmsService: jest.fn(),
}));

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

const { getCmsService } = jest.requireMock('@/platform/services/cms/get-cms-service') as {
  getCmsService: jest.Mock;
};

const mockedServer = jest.requireMock('@/platform/server') as {
  default: { get: jest.Mock; __services: Map<string, unknown> };
};

type LoggerMock = {
  trace: jest.Mock;
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  fatal: jest.Mock;
};

function buildLogger(): LoggerMock {
  return {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  };
}

function createRequest(url: string): NextRequest {
  return { url } as unknown as NextRequest;
}

const SAMPLE_PAGE = {
  title: 'Home',
  description: 'Landing',
  url: '/',
  components: [{ id: 'btn-1', type: 'button', title: 'Buy', link: '/buy' }],
};

let logger: LoggerMock;

beforeEach(() => {
  getCmsService.mockReset();
  mockedServer.default.__services.clear();
  logger = buildLogger();
  mockedServer.default.__services.set('LoggerService', logger);
  mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
});

describe('GET /api/cms — happy path', () => {
  it('forwards (slug, locale, site) from the query string and returns 200 + JSON body', async () => {
    const getPage = jest.fn(async () => SAMPLE_PAGE);
    getCmsService.mockResolvedValue({ getPage });

    const response = await GET(createRequest('http://localhost/api/cms?slug=home&locale=de&site=main'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getPage).toHaveBeenCalledWith('home', 'de', 'main');
    expect(body).toEqual(SAMPLE_PAGE);
  });

  it('applies default slug/locale/site when query params are absent', async () => {
    const getPage = jest.fn(async () => SAMPLE_PAGE);
    getCmsService.mockResolvedValue({ getPage });

    await GET(createRequest('http://localhost/api/cms'));

    // Defaults: slug='home', locale='de', site=''
    expect(getPage).toHaveBeenCalledWith('home', 'de', '');
  });
});

describe('GET /api/cms — notfound branch', () => {
  it('forwards `{ notfound: true }` verbatim with status 200', async () => {
    const notfound = { notfound: true };
    const getPage = jest.fn(async () => notfound);
    getCmsService.mockResolvedValue({ getPage });

    const response = await GET(createRequest('http://localhost/api/cms?slug=missing&locale=en&site=main'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(notfound);
  });
});

describe('GET /api/cms — error branch', () => {
  it('returns 500 with an error body and reports via LoggerService.error when the service throws', async () => {
    const getPage = jest.fn(async () => {
      throw new Error('upstream down');
    });
    getCmsService.mockResolvedValue({ getPage });

    const response = await GET(createRequest('http://localhost/api/cms?slug=home&locale=de&site=main'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to fetch CMS data' });
    expect(logger.error).toHaveBeenCalledTimes(1);
    const [context, message] = logger.error.mock.calls[0];
    expect(message).toBe('Error fetching CMS data');
    expect(context).toMatchObject({
      path: '/api/cms',
      method: 'GET',
      slug: 'home',
      locale: 'de',
      site: 'main',
      error: 'upstream down',
    });
  });

  it('returns 500 when `getCmsService` itself rejects (helper failure path)', async () => {
    getCmsService.mockRejectedValue(new Error('container unbound'));

    const response = await GET(createRequest('http://localhost/api/cms?slug=home&locale=de&site=main'));

    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
