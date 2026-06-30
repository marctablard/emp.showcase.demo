import { POST } from './route';

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

function createRequest(options: { hostname?: string; headerValue?: string; tokenHeaderValue?: string } = {}) {
  const headers = new Headers();
  if (options.headerValue !== undefined) {
    headers.set('x-emporix-local-auth-bootstrap', options.headerValue);
  }
  if (options.tokenHeaderValue !== undefined) {
    headers.set('x-emporix-local-auth-bootstrap-token', options.tokenHeaderValue);
  }
  return {
    headers,
    nextUrl: new URL(`http://${options.hostname ?? 'localhost'}/api/test/auth/bootstrap`),
  };
}

describe('POST /api/test/auth/bootstrap', () => {
  const originalEnabled = process.env.NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_ENABLED;
  const originalToken = process.env.NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_TOKEN;
  const originalNodeEnv = process.env.NODE_ENV;

  let logger: Record<string, jest.Mock>;
  let bootstrapService: { bootstrap: jest.Mock };

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      trace: jest.fn(),
    };
    bootstrapService = {
      bootstrap: jest.fn(),
    };

    mockedServer.default.__services.clear();
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.__services.set('LocalAuthSyncBootstrapService', bootstrapService);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));

    process.env.NODE_ENV = 'test';
    delete process.env.NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_ENABLED;
    delete process.env.NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_TOKEN;
  });

  afterEach(() => {
    process.env.NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_ENABLED = originalEnabled;
    process.env.NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_TOKEN = originalToken;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('returns 404 when the bootstrap route is disabled', async () => {
    const response = await POST(createRequest({ headerValue: 'auth-site-sync' }) as never);

    expect(response.status).toBe(404);
    expect(bootstrapService.bootstrap).not.toHaveBeenCalled();
  });

  it('returns 403 when the request guard fails', async () => {
    process.env.NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_ENABLED = 'true';
    process.env.NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_TOKEN = 'local-test-token';

    const response = await POST(createRequest({ headerValue: 'wrong-value', hostname: 'localhost' }) as never);

    expect(response.status).toBe(403);
    expect(bootstrapService.bootstrap).not.toHaveBeenCalled();
  });

  it('returns 403 when the shared bootstrap token is missing', async () => {
    process.env.NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_ENABLED = 'true';

    const response = await POST(createRequest({ headerValue: 'auth-site-sync' }) as never);

    expect(response.status).toBe(403);
    expect(bootstrapService.bootstrap).not.toHaveBeenCalled();
  });

  it('returns minimal bootstrap metadata for an allowed local request', async () => {
    process.env.NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_ENABLED = 'true';
    process.env.NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_TOKEN = 'local-test-token';
    bootstrapService.bootstrap.mockResolvedValue({
      authenticated: true,
      siteCode: 'us-branch',
      currency: 'USD',
      customerId: 'should-not-leak',
    });

    const response = await POST(
      createRequest({ headerValue: 'auth-site-sync', tokenHeaderValue: 'local-test-token' }) as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authenticated: true,
      siteCode: 'us-branch',
      currency: 'USD',
    });
  });

  it('allows the explicit localhost bootstrap lane in production mode when the env flag is enabled', async () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_ENABLED = 'true';
    process.env.NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_TOKEN = 'prod-local-test-token';
    bootstrapService.bootstrap.mockResolvedValue({
      authenticated: true,
      siteCode: 'main',
      currency: 'EUR',
    });

    const response = await POST(
      createRequest({ headerValue: 'auth-site-sync', tokenHeaderValue: 'prod-local-test-token' }) as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authenticated: true,
      siteCode: 'main',
      currency: 'EUR',
    });
  });

  it('returns 500 when the bootstrap service throws', async () => {
    process.env.NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_ENABLED = 'true';
    process.env.NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_TOKEN = 'local-test-token';
    bootstrapService.bootstrap.mockRejectedValue(new Error('boom'));

    const response = await POST(
      createRequest({ headerValue: 'auth-site-sync', tokenHeaderValue: 'local-test-token' }) as never,
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Failed to bootstrap local auth session' });
  });
});
