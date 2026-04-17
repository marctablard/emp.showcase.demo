/**
 * Tests for CSRF fetch retry logic.
 * Verifies that the patched window.fetch retries once on CSRF 403 errors.
 */

let originalFetch: typeof globalThis.fetch;
let csrfCallCount: number;

beforeEach(() => {
  csrfCallCount = 0;
  // Reset module state
  jest.resetModules();

  // Mock window for browser environment
  if (typeof window === 'undefined') {
    (globalThis as any).window = {
      location: { origin: 'http://localhost:3000' },
    };
  }

  // Save original fetch
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if ((globalThis as any).window && !(globalThis as any).window.document) {
    delete (globalThis as any).window;
  }
});

function createMockFetch(responses: Array<{ status: number; body?: any; headers?: Record<string, string> }>) {
  let callIndex = 0;
  return jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Handle CSRF token fetch
    if (url.endsWith('/api/csrf')) {
      csrfCallCount++;
      return new Response(JSON.stringify({ token: `token-${csrfCallCount}` }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    const responseConfig = responses[callIndex] || responses[responses.length - 1];
    callIndex++;
    return new Response(JSON.stringify(responseConfig.body || {}), {
      status: responseConfig.status,
      headers: { 'content-type': 'application/json', ...(responseConfig.headers || {}) },
    });
  });
}

describe('CSRF fetch retry logic', () => {
  test('retries once on CSRF 403 error', async () => {
    const mockFetch = createMockFetch([
      { status: 403, body: { error: 'Invalid CSRF token' } },
      { status: 200, body: { success: true } },
    ]);

    globalThis.fetch = mockFetch;
    (globalThis as any).window.fetch = mockFetch;

    const { setupCsrfFetch } = await import('@/lib/client/csrf-fetch');
    setupCsrfFetch();

    const response = await (globalThis as any).window.fetch('/api/cart', { method: 'POST' });
    expect(response.status).toBe(200);
    expect(csrfCallCount).toBe(2);
  });

  test('does not retry on non-CSRF 403 error', async () => {
    const mockFetch = createMockFetch([{ status: 403, body: { error: 'Forbidden' } }]);

    globalThis.fetch = mockFetch;
    (globalThis as any).window.fetch = mockFetch;

    const { setupCsrfFetch } = await import('@/lib/client/csrf-fetch');
    setupCsrfFetch();

    const response = await (globalThis as any).window.fetch('/api/cart', { method: 'POST' });
    expect(response.status).toBe(403);
    expect(csrfCallCount).toBe(1);
  });

  test('does not retry on 200 response', async () => {
    const mockFetch = createMockFetch([{ status: 200, body: { ok: true } }]);

    globalThis.fetch = mockFetch;
    (globalThis as any).window.fetch = mockFetch;

    const { setupCsrfFetch } = await import('@/lib/client/csrf-fetch');
    setupCsrfFetch();

    const response = await (globalThis as any).window.fetch('/api/cart', { method: 'POST' });
    expect(response.status).toBe(200);
    expect(csrfCallCount).toBe(1);
  });

  test('returns second 403 on double failure (no infinite loop)', async () => {
    const mockFetch = createMockFetch([
      { status: 403, body: { error: 'Invalid CSRF token' } },
      { status: 403, body: { error: 'Invalid CSRF token' } },
    ]);

    globalThis.fetch = mockFetch;
    (globalThis as any).window.fetch = mockFetch;

    const { setupCsrfFetch } = await import('@/lib/client/csrf-fetch');
    setupCsrfFetch();

    const response = await (globalThis as any).window.fetch('/api/cart', { method: 'POST' });
    expect(response.status).toBe(403);
    expect(csrfCallCount).toBe(2);
  });

  test('skips CSRF for GET requests', async () => {
    const mockFetch = createMockFetch([{ status: 200, body: { data: 'ok' } }]);

    globalThis.fetch = mockFetch;
    (globalThis as any).window.fetch = mockFetch;

    const { setupCsrfFetch } = await import('@/lib/client/csrf-fetch');
    setupCsrfFetch();

    const response = await (globalThis as any).window.fetch('/api/cart', { method: 'GET' });
    expect(response.status).toBe(200);
    expect(csrfCallCount).toBe(0);
  });
});
