import type { Session } from '@/platform/services/model/session';
import { getSessionForSite } from './session';

jest.mock('@/platform/ssr', () => {
  const services = new Map<string, unknown>();
  return {
    __esModule: true,
    default: {
      get: jest.fn((id: string) => services.get(id)),
      __services: services,
    },
  };
});

const mockedSsr = jest.requireMock('@/platform/ssr') as {
  default: { get: jest.Mock; __services: Map<string, unknown> };
};

const originalSession: Session = {
  id: 'session-1',
  siteCode: 'main',
  currency: 'EUR',
  language: 'en',
};

describe('getSessionForSite SSR align', () => {
  const sessionService = {
    getCurrent: jest.fn(),
    setSite: jest.fn(),
    setCurrency: jest.fn(),
  };

  const siteService = {
    getSite: jest.fn(),
  };

  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    sessionService.getCurrent.mockReset();
    sessionService.setSite.mockReset();
    sessionService.setCurrency.mockReset();
    siteService.getSite.mockReset();
    logger.info.mockReset();
    logger.warn.mockReset();
    logger.error.mockReset();
    mockedSsr.default.__services.clear();
    mockedSsr.default.__services.set('SessionService', sessionService);
    mockedSsr.default.__services.set('SiteService', siteService);
    mockedSsr.default.__services.set('LoggerService', logger);
    mockedSsr.default.get.mockImplementation((id: string) => mockedSsr.default.__services.get(id));
    sessionService.getCurrent.mockResolvedValue(originalSession);
    sessionService.setSite.mockResolvedValue(undefined);
    sessionService.setCurrency.mockResolvedValue(undefined);
  });

  it('preserves session currency when the target site lists it', async () => {
    siteService.getSite.mockResolvedValue({
      code: 'us-preserve-eur',
      defaultCurrency: { id: 'USD', code: 'USD' },
      currencies: [
        { id: 'USD', code: 'USD' },
        { id: 'EUR', code: 'EUR' },
      ],
    });

    await getSessionForSite('us-preserve-eur');

    expect(sessionService.setSite).toHaveBeenCalledWith('us-preserve-eur', 'EUR');
  });

  it('falls back to defaultCurrency.id when session currency is not listed', async () => {
    siteService.getSite.mockResolvedValue({
      code: 'us-branch',
      defaultCurrency: { id: 'USD', code: 'USD' },
      currencies: [
        { id: 'USD', code: 'USD' },
        { id: 'CHF', code: 'CHF' },
      ],
    });

    await getSessionForSite('us-branch');

    expect(sessionService.setSite).toHaveBeenCalledWith('us-branch', 'USD');
  });

  it('skips align and returns the original session when the target site is unknown', async () => {
    siteService.getSite.mockResolvedValue(undefined);

    const result = await getSessionForSite('missing-site');

    expect(sessionService.setSite).not.toHaveBeenCalled();
    expect(result).toEqual(originalSession);
  });

  it('resets a session currency the current site does not list', async () => {
    sessionService.getCurrent.mockReset();
    sessionService.getCurrent
      .mockResolvedValueOnce({ ...originalSession, siteCode: 'main', currency: 'GBP' })
      .mockResolvedValue({ ...originalSession, siteCode: 'main', currency: 'EUR' });
    siteService.getSite.mockResolvedValue({
      code: 'main',
      defaultCurrency: { id: 'EUR', code: 'EUR' },
      currencies: [{ id: 'EUR', code: 'EUR' }],
    });

    let result: Awaited<ReturnType<typeof getSessionForSite>> | undefined;
    await jest.isolateModulesAsync(async () => {
      const { getSessionForSite: loadSessionForSite } = await import('./session');
      result = await loadSessionForSite('main');
    });

    expect(sessionService.setSite).not.toHaveBeenCalled();
    expect(sessionService.setCurrency).toHaveBeenCalledWith('EUR');
    expect(result?.currency).toBe('EUR');
  });
});
