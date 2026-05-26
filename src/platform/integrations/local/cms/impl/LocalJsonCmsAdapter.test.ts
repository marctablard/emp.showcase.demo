/**
 * Unit tests for `LocalJsonCmsAdapter` — local-JSON-backed CMS implementation.
 *
 * Behaviour contract:
 * - `id === 'local'`, `hasContent() === true`.
 * - `getPage` resolves the (site, locale, slug) triple via the injected
 *   `CmsDataLoader` strategy. Tests pass a fake loader — no on-disk fixtures.
 * - Site-fallback: if the loader returns `null` for the requested site AND
 *   the requested site differs from the configured `defaultSite`, the adapter
 *   retries with the default site. The retry path is the migrated behaviour
 *   of the legacy `LocalCmsServiceSSR.tryLoadPage`.
 * - `getNavigation` is a stub that resolves to `{ notfound: true }`.
 * - Loader errors are caught and surfaced as `{ notfound: true }` — no throw.
 */
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { CMSPage } from '@/platform/services/model/cms';
import type { Session } from '@/platform/services/model/session/session';
import type { SessionService } from '@/platform/services/session';
import { type CmsDataLoader, LocalJsonCmsAdapter } from './LocalJsonCmsAdapter';

const SAMPLE_PAGE: CMSPage = {
  title: 'Home',
  description: 'Landing',
  url: '/',
  components: [{ id: 'hero-1', type: 'hero' }],
};

function buildSessionService(siteCode: string | undefined): jest.Mocked<SessionService> {
  const session: Session | undefined = siteCode ? ({ id: 's1', currency: 'EUR', siteCode } as Session) : undefined;
  return {
    getCurrent: jest.fn(async () => session),
  } as unknown as jest.Mocked<SessionService>;
}

function buildLogger(): jest.Mocked<LoggerService> {
  return {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  } as unknown as jest.Mocked<LoggerService>;
}

describe('LocalJsonCmsAdapter', () => {
  describe('identity', () => {
    it('reports the provider id "local"', () => {
      const adapter = new LocalJsonCmsAdapter(buildSessionService('main'), buildLogger());

      expect(adapter.id).toBe('local');
    });

    it('always reports content available — hasContent() === true', () => {
      const adapter = new LocalJsonCmsAdapter(buildSessionService('main'), buildLogger());

      expect(adapter.hasContent()).toBe(true);
    });
  });

  describe('getPage — happy path', () => {
    it('loads the JSON for the session site and returns it as a CMSPage', async () => {
      const loader: CmsDataLoader = jest.fn(async () => SAMPLE_PAGE);
      const adapter = new LocalJsonCmsAdapter(buildSessionService('main'), buildLogger(), loader);

      const result = await adapter.getPage('home', 'en', 'main');

      expect(loader).toHaveBeenCalledWith('main', 'en', 'home');
      expect(result).toEqual(SAMPLE_PAGE);
    });

    it('normalizes the slug (strips disallowed chars, lowercases) and locale (lowercases) before calling the loader', async () => {
      const loader: CmsDataLoader = jest.fn(async () => SAMPLE_PAGE);
      const adapter = new LocalJsonCmsAdapter(buildSessionService('main'), buildLogger(), loader);

      await adapter.getPage('Home/Page!', 'EN', 'main');

      expect(loader).toHaveBeenCalledWith('main', 'en', 'homepage');
    });
  });

  describe('getPage — default-site fallback', () => {
    it('retries with the default site when the loader returns null for the session site', async () => {
      const loader: CmsDataLoader = jest.fn(async (site) => (site === '_default_' ? SAMPLE_PAGE : null));
      const adapter = new LocalJsonCmsAdapter(buildSessionService('us-branch'), buildLogger(), loader);

      const result = await adapter.getPage('home', 'en', 'us-branch');

      expect(loader).toHaveBeenNthCalledWith(1, 'us-branch', 'en', 'home');
      expect(loader).toHaveBeenNthCalledWith(2, '_default_', 'en', 'home');
      expect(result).toEqual(SAMPLE_PAGE);
    });

    it('does NOT retry when the requested site already equals the default site', async () => {
      const loader: CmsDataLoader = jest.fn(async () => null);
      const adapter = new LocalJsonCmsAdapter(buildSessionService('_default_'), buildLogger(), loader, '_default_');

      const result = await adapter.getPage('missing', 'en', '_default_');

      expect(loader).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expect.objectContaining({ notfound: true }));
    });

    it('returns `{ notfound: true }` when neither the session site nor the default site has the page', async () => {
      const loader: CmsDataLoader = jest.fn(async () => null);
      const adapter = new LocalJsonCmsAdapter(buildSessionService('us-branch'), buildLogger(), loader);

      const result = await adapter.getPage('missing', 'en', 'us-branch');

      expect(loader).toHaveBeenCalledTimes(2);
      expect(result).toEqual(
        expect.objectContaining({
          notfound: true,
          message: expect.stringContaining('missing'),
        }),
      );
    });

    it('uses the configured `defaultSite` constructor argument instead of the hardcoded "_default_"', async () => {
      const loader: CmsDataLoader = jest.fn(async (site) => (site === 'fallback-site' ? SAMPLE_PAGE : null));
      const adapter = new LocalJsonCmsAdapter(buildSessionService('main'), buildLogger(), loader, 'fallback-site');

      const result = await adapter.getPage('home', 'en', 'main');

      expect(loader).toHaveBeenNthCalledWith(2, 'fallback-site', 'en', 'home');
      expect(result).toEqual(SAMPLE_PAGE);
    });
  });

  describe('getPage — session fallback', () => {
    it('falls back to the default site when no session is available', async () => {
      const loader: CmsDataLoader = jest.fn(async (site) => (site === '_default_' ? SAMPLE_PAGE : null));
      const adapter = new LocalJsonCmsAdapter(buildSessionService(undefined), buildLogger(), loader, '_default_');

      const result = await adapter.getPage('home', 'en', 'whatever');

      expect(loader).toHaveBeenCalledWith('_default_', 'en', 'home');
      expect(result).toEqual(SAMPLE_PAGE);
    });
  });

  describe('getPage — error handling', () => {
    it('catches loader exceptions and returns a `{ notfound: true }` result (no throw)', async () => {
      const logger = buildLogger();
      const loader: CmsDataLoader = jest.fn(async () => {
        throw new Error('disk I/O exploded');
      });
      const adapter = new LocalJsonCmsAdapter(buildSessionService('main'), logger, loader);

      const result = await adapter.getPage('home', 'en', 'main');

      expect(result).toEqual(expect.objectContaining({ notfound: true }));
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('getNavigation (notfound stub)', () => {
    it('getNavigation resolves to `{ notfound: true }`', async () => {
      const adapter = new LocalJsonCmsAdapter(buildSessionService('main'), buildLogger());

      await expect(adapter.getNavigation('en', 'main')).resolves.toEqual(expect.objectContaining({ notfound: true }));
    });
  });
});
