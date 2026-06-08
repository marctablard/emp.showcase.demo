/**
 * Route-level tests for `POST /api/cms/webhook`.
 *
 * Contract under test:
 * - Resolves `CMSService` via `getCmsService()` (the SSR lazy-bind helper).
 * - Adapter without a webhook surface (`cms.handleWebhook` not a function) →
 *   `405`.
 * - Otherwise the service result `{ status, body }` is passed through verbatim
 *   (200, 401, 503, …) and the outcome is logged.
 * - Service throws / helper rejects → `500` + `LoggerService.error(...)`.
 *
 * Note: the 503 "secret not configured" gate used to live here; it now lives
 * in `DelegatingCmsServiceSSR.handleWebhook` so that non-HMAC adapters are
 * not blocked by a missing Storyblok-only secret.
 */
import type { NextRequest } from 'next/server';
import { POST } from './route';

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

function createRequest(): NextRequest {
  return { method: 'POST', url: 'http://localhost/api/cms/webhook' } as unknown as NextRequest;
}

let logger: LoggerMock;
const ORIGINAL_SECRET = process.env.NEXT_CMS_WEBHOOK_SECRET;

beforeEach(() => {
  getCmsService.mockReset();
  mockedServer.default.__services.clear();
  logger = buildLogger();
  mockedServer.default.__services.set('LoggerService', logger);
  mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  process.env.NEXT_CMS_WEBHOOK_SECRET = 'shhh';
});

afterAll(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.NEXT_CMS_WEBHOOK_SECRET;
  } else {
    process.env.NEXT_CMS_WEBHOOK_SECRET = ORIGINAL_SECRET;
  }
});

describe('POST /api/cms/webhook — capability gate (405)', () => {
  it('returns 405 when the active provider exposes no handleWebhook', async () => {
    getCmsService.mockResolvedValue({ providerId: 'none' });

    const response = await POST(createRequest());

    expect(response.status).toBe(405);
  });

  it('returns 405 (capability) before 503 (secret) even when the secret is absent', async () => {
    delete process.env.NEXT_CMS_WEBHOOK_SECRET;
    getCmsService.mockResolvedValue({ providerId: 'local' });

    const response = await POST(createRequest());

    expect(response.status).toBe(405);
  });
});

describe('POST /api/cms/webhook — disabled gate (503)', () => {
  it('passes through a 503 result from the service (secret gate now lives in the service, not the route)', async () => {
    // The service owns the "no secret → 503" logic for HMAC-based adapters so
    // that adapters without HMAC are not blocked by a provider-specific secret.
    // From the route's perspective, 503 is just another pass-through status.
    delete process.env.NEXT_CMS_WEBHOOK_SECRET;
    const handleWebhook = jest.fn(async () => ({ status: 503, body: { error: 'CMS webhook disabled' } }));
    getCmsService.mockResolvedValue({ providerId: 'storyblok', handleWebhook });

    const response = await POST(createRequest());

    expect(response.status).toBe(503);
    expect(handleWebhook).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/cms/webhook — passthrough', () => {
  it('passes a 200 result (with body) through verbatim and logs the outcome', async () => {
    const handleWebhook = jest.fn(async () => ({ status: 200, body: { invalidated: 2 } }));
    getCmsService.mockResolvedValue({ providerId: 'storyblok', handleWebhook });

    const request = createRequest();
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ invalidated: 2 });
    expect(handleWebhook).toHaveBeenCalledWith(request);
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('passes a 401 result through verbatim (invalid HMAC)', async () => {
    const handleWebhook = jest.fn(async () => ({ status: 401, body: { error: 'Invalid signature' } }));
    getCmsService.mockResolvedValue({ providerId: 'storyblok', handleWebhook });

    const response = await POST(createRequest());

    expect(response.status).toBe(401);
  });
});

describe('POST /api/cms/webhook — error branch (500)', () => {
  it('returns 500 and logs when handleWebhook throws', async () => {
    const handleWebhook = jest.fn(async () => {
      throw new Error('boom');
    });
    getCmsService.mockResolvedValue({ providerId: 'storyblok', handleWebhook });

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to handle CMS webhook' });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when getCmsService itself rejects', async () => {
    getCmsService.mockRejectedValue(new Error('container unbound'));

    const response = await POST(createRequest());

    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
