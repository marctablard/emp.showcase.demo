import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { switchSiteAndRedirect } from './site-switcher-utils';

describe('switchSiteAndRedirect', () => {
  const createLogger = (): jest.Mocked<LoggerService> =>
    ({
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    }) as unknown as jest.Mocked<LoggerService>;

  it('redirects when session site update succeeds', async () => {
    const getRedirectPath = jest.fn().mockReturnValue('/us-branch');
    const navigateTo = jest.fn();
    const notifySwitchFailure = jest.fn();
    const updateSessionSite = jest.fn().mockResolvedValue(true);
    const getSiteByCode = jest.fn().mockResolvedValue({ languages: ['en'] });
    const logger = createLogger();

    const result = await switchSiteAndRedirect({
      site: 'us-branch',
      locale: 'en',
      getSiteByCode,
      updateSessionSite,
      getRedirectPath,
      navigateTo,
      logger,
      notifySwitchFailure,
    });

    expect(result).toBe(true);
    expect(updateSessionSite).toHaveBeenCalledWith('us-branch');
    expect(getRedirectPath).toHaveBeenCalledWith({
      href: '/',
      locale: 'en',
      site: 'us-branch',
      forcePrefix: true,
    });
    expect(navigateTo).toHaveBeenCalledWith('/us-branch');
    expect(notifySwitchFailure).not.toHaveBeenCalled();
  });

  it('does not redirect and notifies user when session site update fails', async () => {
    const getRedirectPath = jest.fn();
    const navigateTo = jest.fn();
    const notifySwitchFailure = jest.fn();
    const updateSessionSite = jest.fn().mockResolvedValue(false);
    const getSiteByCode = jest.fn().mockResolvedValue({ languages: ['en'] });
    const logger = createLogger();

    const result = await switchSiteAndRedirect({
      site: 'us-branch',
      locale: 'en',
      getSiteByCode,
      updateSessionSite,
      getRedirectPath,
      navigateTo,
      logger,
      notifySwitchFailure,
    });

    expect(result).toBe(false);
    expect(getRedirectPath).not.toHaveBeenCalled();
    expect(navigateTo).not.toHaveBeenCalled();
    expect(notifySwitchFailure).toHaveBeenCalledTimes(1);
  });

  it('does not call backend update for unknown site', async () => {
    const getRedirectPath = jest.fn();
    const navigateTo = jest.fn();
    const notifySwitchFailure = jest.fn();
    const updateSessionSite = jest.fn();
    const getSiteByCode = jest.fn().mockResolvedValue(undefined);
    const logger = createLogger();

    const result = await switchSiteAndRedirect({
      site: 'missing-site',
      locale: 'en',
      getSiteByCode,
      updateSessionSite,
      getRedirectPath,
      navigateTo,
      logger,
      notifySwitchFailure,
    });

    expect(result).toBe(false);
    expect(updateSessionSite).not.toHaveBeenCalled();
    expect(getRedirectPath).not.toHaveBeenCalled();
    expect(navigateTo).not.toHaveBeenCalled();
    expect(notifySwitchFailure).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith({ site: 'missing-site' }, 'Site not found');
  });

  it('does not swallow navigation errors as switch failure', async () => {
    const getRedirectPath = jest.fn().mockReturnValue('/us-branch');
    const navigateTo = jest.fn().mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });
    const notifySwitchFailure = jest.fn();
    const updateSessionSite = jest.fn().mockResolvedValue(true);
    const getSiteByCode = jest.fn().mockResolvedValue({ languages: ['en'] });
    const logger = createLogger();

    await expect(
      switchSiteAndRedirect({
        site: 'us-branch',
        locale: 'en',
        getSiteByCode,
        updateSessionSite,
        getRedirectPath,
        navigateTo,
        logger,
        notifySwitchFailure,
      }),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(notifySwitchFailure).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalledWith(expect.anything(), 'Failed to switch site');
  });
});
