import { readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: jest.fn(() => ({
    error: jest.fn(),
  })),
}));

describe('getTaxClasses', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('does not import server or integrations', () => {
    const source = readFileSync(join(__dirname, 'tax.ts'), 'utf8');
    expect(source).not.toMatch(/@\/platform\/server/);
    expect(source).not.toMatch(/@\/platform\/integrations/);
  });

  it('fetches the country list without taxCode and caches per countryCode', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        countryCode: 'CH',
        taxClasses: [
          { code: 'STANDARD', rate: 7.7 },
          { code: 'REDUCED', rate: 3.7 },
          { code: 'ZERO', rate: 0 },
        ],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getTaxClasses } = await import('./tax');
    const first = await getTaxClasses('CH');
    const second = await getTaxClasses('ch');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/tax?countryCode=CH', { cache: 'no-store' });
    expect(first).toEqual([
      { code: 'STANDARD', rate: 7.7 },
      { code: 'REDUCED', rate: 3.7 },
      { code: 'ZERO', rate: 0 },
    ]);
    expect(second).toEqual(first);
  });

  it('fetches again for a different countryCode', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ countryCode: 'CH', taxClasses: [{ code: 'STANDARD', rate: 7.7 }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ countryCode: 'DE', taxClasses: [{ code: 'STANDARD', rate: 19 }] }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getTaxClasses } = await import('./tax');
    await expect(getTaxClasses('CH')).resolves.toEqual([{ code: 'STANDARD', rate: 7.7 }]);
    await expect(getTaxClasses('DE')).resolves.toEqual([{ code: 'STANDARD', rate: 19 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('coalesces concurrent fetches for the same countryCode', async () => {
    let resolveResponse!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = jest.fn().mockReturnValue(pending);
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getTaxClasses } = await import('./tax');
    const first = getTaxClasses('CH');
    const second = getTaxClasses('CH');

    resolveResponse({
      ok: true,
      json: async () => ({ countryCode: 'CH', taxClasses: [{ code: 'STANDARD', rate: 7.7 }] }),
    } as Response);

    const [a, b] = await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual([{ code: 'STANDARD', rate: 7.7 }]);
    expect(b).toEqual(a);
  });

  it('does not cache a failed fetch', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ countryCode: 'CH', taxClasses: [] }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getTaxClasses } = await import('./tax');
    const { getLogger } = jest.requireMock('@/lib/logger/use-logger-client') as {
      getLogger: jest.Mock;
    };
    const logger = { error: jest.fn() };
    getLogger.mockReturnValue(logger);

    await expect(getTaxClasses('CH')).rejects.toThrow('Failed to fetch tax classes: Bad Request');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ countryCode: 'CH' }),
      'Error fetching tax classes',
    );

    await expect(getTaxClasses('CH')).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
