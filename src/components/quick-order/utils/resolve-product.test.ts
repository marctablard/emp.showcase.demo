import { resolveProductByCode } from './resolve-product';

const fetchMock = jest.fn();

jest.mock('@/lib/client/availability', () => ({
  fetchProductAvailability: jest.fn(),
}));

jest.mock('@/lib/common/clear-mark-highlights', () => ({
  clearMarkHighlights: (value: string | undefined | null) => String(value ?? '').replace(/<\/?mark>/g, ''),
}));

describe('resolveProductByCode', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    if (typeof window !== 'undefined') {
      window.fetch = fetchMock as unknown as typeof fetch;
    } else {
      // Mock window for tests running in restricted environment without jsdom
      (global as any).window = {
        location: {
          origin: 'http://localhost',
        },
      };
    }
  });

  it('matches exact product id even when the API response contains highlighted markup', async () => {
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

    await expect(resolveProductByCode('product-1', 'en')).resolves.toEqual(
      expect.objectContaining({
        id: '<mark>product-1</mark>',
        sku: '<mark>sku-1</mark>',
      }),
    );
  });

  it('matches exact product sku even when the API response contains highlighted markup', async () => {
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

    await expect(resolveProductByCode('sku-1', 'en')).resolves.toEqual(
      expect.objectContaining({
        id: '<mark>product-1</mark>',
        sku: '<mark>sku-1</mark>',
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

    await expect(resolveProductByCode('Solar Panel', 'en')).resolves.toBeNull();
  });
});
