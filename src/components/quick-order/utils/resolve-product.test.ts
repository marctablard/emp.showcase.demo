import { resolveProductByCode } from './resolve-product';

const fetchMock = jest.fn();

jest.mock('@/lib/client/availability', () => ({
  fetchProductAvailability: jest.fn(),
}));

jest.mock('@/lib/common/clear-mark-highlights', () => ({
  clearMarkHighlights: (value: string | undefined | null) => String(value ?? '').replace(/<\/?mark>/g, ''),
}));

const SITE = 'main';

describe('resolveProductByCode', () => {
  const originalFetch = global.fetch;
  const hadWindow = typeof window !== 'undefined';
  const originalWindow = hadWindow ? window : undefined;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    if (hadWindow) {
      window.fetch = fetchMock as unknown as typeof fetch;
    } else {
      // Provide a minimal window for environments running without jsdom.
      (global as unknown as { window: unknown }).window = {
        location: {
          origin: 'http://localhost',
        },
      };
    }
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (hadWindow) {
      if (originalWindow) {
        window.fetch = originalWindow.fetch;
      }
    } else {
      delete (global as unknown as { window?: unknown }).window;
    }
  });

  it('matches exact product id and returns identifiers with highlight markup stripped', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: '<mark>product-1</mark>',
            sku: '<mark>sku-1</mark>',
            name: 'Solar Panel',
          },
        ],
      }),
    });

    await expect(resolveProductByCode('product-1', 'en', SITE)).resolves.toEqual(
      expect.objectContaining({
        id: 'product-1',
        sku: 'sku-1',
      }),
    );
  });

  it('matches exact product sku and returns identifiers with highlight markup stripped', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: '<mark>product-1</mark>',
            sku: '<mark>sku-1</mark>',
            name: 'Solar Panel',
          },
        ],
      }),
    });

    await expect(resolveProductByCode('sku-1', 'en', SITE)).resolves.toEqual(
      expect.objectContaining({
        id: 'product-1',
        sku: 'sku-1',
      }),
    );
  });

  it('does not match product names', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'product-1',
            sku: 'sku-1',
            name: 'Solar Panel',
          },
        ],
      }),
    });

    await expect(resolveProductByCode('Solar Panel', 'en', SITE)).resolves.toBeNull();
  });

  it('appends the trimmed site to the search request', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });

    await resolveProductByCode('product-1', 'en', '  main  ');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestedUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestedUrl).toContain('site=main');
  });

  it('bails out without a request when no site is available', async () => {
    await expect(resolveProductByCode('product-1', 'en')).resolves.toBeNull();
    await expect(resolveProductByCode('product-1', 'en', '   ')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
