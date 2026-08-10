/**
 * Acceptance tests for `StoryblokCmsApi` — the SDK encapsulation layer.
 *
 * The API class is the only file that imports `@storyblok/react/rsc`
 * for the Content-Delivery side; every other Storyblok-aware module
 * talks to it via the typed `StoryblokCmsApi` interface.
 *
 * Behaviour pinned here:
 *  - Lazy-Init: `storyblokInit({...})` is NOT called at module load. The
 *    first `getStory()` call triggers init with the configured access
 *    token; subsequent calls reuse the memoised SDK accessor.
 *  - Token guard: with an empty / unset token, the API resolves to `null`
 *    without ever calling `storyblokInit` — matches the boot-with-no-token
 *    contract (the app must render without a Storyblok token).
 *  - Multi-site prefixing: `${site}/${slug}` is applied when
 *    `NEXT_STORYBLOK_MULTI_SITE === 'true'` and a site arg is
 *    given. Pinned against the legacy `storyblok-cms-page.tsx#fetchData`
 *    branch.
 *  - Version: env-driven preview resolution mirrors the legacy bridge —
 *    `NEXT_STORYBLOK_ACCESS_PREVIEW === 'true'` selects `draft`,
 *    otherwise `published`. The resolved `language` comes from the locale
 *    argument.
 *  - Error path: SDK throws → `null` (no rethrow); SDK returns a payload
 *    without `data.story` → `null`. The adapter translates both into
 *    `{ notfound: true }`.
 *
 * The SDK is jest-mocked so no network call is attempted.
 */
import type { LoggerService } from '@/platform/services/logger/LoggerService';

const mockStoryblokInit = jest.fn();
const mockGetStory = jest.fn();

jest.mock('@storyblok/react/rsc', () => ({
  __esModule: true,
  apiPlugin: { plugin: 'api' },
  storyblokInit: (...args: unknown[]) => mockStoryblokInit(...args),
}));

const silentLogger = (): jest.Mocked<LoggerService> =>
  ({
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  }) as unknown as jest.Mocked<LoggerService>;

const ENV_KEYS = ['NEXT_STORYBLOK_ACCESS_TOKEN', 'NEXT_STORYBLOK_MULTI_SITE', 'NEXT_STORYBLOK_ACCESS_PREVIEW'] as const;

function snapshotEnv(): Record<(typeof ENV_KEYS)[number], string | undefined> {
  return {
    NEXT_STORYBLOK_ACCESS_TOKEN: process.env.NEXT_STORYBLOK_ACCESS_TOKEN,
    NEXT_STORYBLOK_MULTI_SITE: process.env.NEXT_STORYBLOK_MULTI_SITE,
    NEXT_STORYBLOK_ACCESS_PREVIEW: process.env.NEXT_STORYBLOK_ACCESS_PREVIEW,
  };
}

function restoreEnv(snapshot: Record<(typeof ENV_KEYS)[number], string | undefined>): void {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = snapshot[key];
    }
  }
}

describe('StoryblokCmsApi', () => {
  let original: Record<(typeof ENV_KEYS)[number], string | undefined>;

  beforeAll(() => {
    original = snapshotEnv();
  });

  afterAll(() => {
    restoreEnv(original);
  });

  beforeEach(() => {
    mockStoryblokInit.mockReset();
    mockGetStory.mockReset();
    // Return a getStoryblokApi accessor that hands back a fake client.
    mockStoryblokInit.mockImplementation(() => () => ({ getStory: mockGetStory }));
    // Reset env to a clean "no token" baseline so each test is hermetic.
    delete process.env.NEXT_STORYBLOK_ACCESS_TOKEN;
    delete process.env.NEXT_STORYBLOK_MULTI_SITE;
    delete process.env.NEXT_STORYBLOK_ACCESS_PREVIEW;
  });

  describe('identity & lazy init', () => {
    it('does NOT call storyblokInit at module load (lazy-init behaviour)', async () => {
      const { StoryblokCmsApi } = await import('./StoryblokCmsApi');
      const api = new StoryblokCmsApi(silentLogger());

      expect(api).toBeInstanceOf(StoryblokCmsApi);
      expect(mockStoryblokInit).not.toHaveBeenCalled();
    });

    it('triggers storyblokInit on the first getStory() call with the configured access token', async () => {
      process.env.NEXT_STORYBLOK_ACCESS_TOKEN = 'tk-1';
      mockGetStory.mockResolvedValueOnce({ data: { story: { name: 'Home' } } });

      const { StoryblokCmsApi } = await import('./StoryblokCmsApi');
      const api = new StoryblokCmsApi(silentLogger());

      await api.getStory('home', 'en');

      expect(mockStoryblokInit).toHaveBeenCalledTimes(1);
      expect(mockStoryblokInit).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'tk-1',
          bridge: true,
        }),
      );
    });

    it('triggers storyblokInit only once across multiple getStory() calls (singleton init)', async () => {
      process.env.NEXT_STORYBLOK_ACCESS_TOKEN = 'tk-2';
      mockGetStory.mockResolvedValue({ data: { story: { name: 'X' } } });

      const { StoryblokCmsApi } = await import('./StoryblokCmsApi');
      const api = new StoryblokCmsApi(silentLogger());

      await api.getStory('home', 'en');
      await api.getStory('about', 'en');
      await api.getStory('contact', 'de');

      expect(mockStoryblokInit).toHaveBeenCalledTimes(1);
      expect(mockGetStory).toHaveBeenCalledTimes(3);
    });
  });

  describe('token guard', () => {
    it('resolves to `null` when the access token is empty or unset', async () => {
      delete process.env.NEXT_STORYBLOK_ACCESS_TOKEN;
      const { StoryblokCmsApi } = await import('./StoryblokCmsApi');
      const api = new StoryblokCmsApi(silentLogger());

      const result = await api.getStory('home', 'en');

      expect(result).toBeNull();
    });

    it('does NOT call storyblokInit when there is no token (no module-load crash)', async () => {
      process.env.NEXT_STORYBLOK_ACCESS_TOKEN = '   '; // whitespace-only → treated as empty
      const { StoryblokCmsApi } = await import('./StoryblokCmsApi');
      const api = new StoryblokCmsApi(silentLogger());

      await api.getStory('home', 'en');

      expect(mockStoryblokInit).not.toHaveBeenCalled();
    });
  });

  describe('getStory', () => {
    beforeEach(() => {
      process.env.NEXT_STORYBLOK_ACCESS_TOKEN = 'tk-3';
      mockGetStory.mockResolvedValue({ data: { story: { name: 'OK' } } });
    });

    it('forwards the slug verbatim when NEXT_STORYBLOK_MULTI_SITE is "false" or unset', async () => {
      delete process.env.NEXT_STORYBLOK_MULTI_SITE;
      const { StoryblokCmsApi } = await import('./StoryblokCmsApi');
      const api = new StoryblokCmsApi(silentLogger());

      await api.getStory('catalogue/widgets', 'en', 'main');

      expect(mockGetStory).toHaveBeenCalledWith('catalogue/widgets', expect.any(Object), expect.any(Object));
    });

    it('prefixes the slug with `${site}/` when NEXT_STORYBLOK_MULTI_SITE is "true"', async () => {
      process.env.NEXT_STORYBLOK_MULTI_SITE = 'true';
      const { StoryblokCmsApi } = await import('./StoryblokCmsApi');
      const api = new StoryblokCmsApi(silentLogger());

      await api.getStory('catalogue/widgets', 'en', 'us-branch');

      expect(mockGetStory).toHaveBeenCalledWith('us-branch/catalogue/widgets', expect.any(Object), expect.any(Object));
    });

    it('does NOT prefix the slug when multi-site is enabled but no site arg is supplied', async () => {
      process.env.NEXT_STORYBLOK_MULTI_SITE = 'true';
      const { StoryblokCmsApi } = await import('./StoryblokCmsApi');
      const api = new StoryblokCmsApi(silentLogger());

      await api.getStory('home', 'en');

      expect(mockGetStory).toHaveBeenCalledWith('home', expect.any(Object), expect.any(Object));
    });

    it('resolves `version: "published"` for normal visitor traffic (preview env unset)', async () => {
      delete process.env.NEXT_STORYBLOK_ACCESS_PREVIEW;
      const { StoryblokCmsApi } = await import('./StoryblokCmsApi');
      const api = new StoryblokCmsApi(silentLogger());

      await api.getStory('home', 'en');

      expect(mockGetStory).toHaveBeenCalledWith(
        'home',
        expect.objectContaining({ version: 'published' }),
        expect.any(Object),
      );
    });

    it('resolves `version: "draft"` when NEXT_STORYBLOK_ACCESS_PREVIEW is "true"', async () => {
      process.env.NEXT_STORYBLOK_ACCESS_PREVIEW = 'true';
      const { StoryblokCmsApi } = await import('./StoryblokCmsApi');
      const api = new StoryblokCmsApi(silentLogger());

      await api.getStory('home', 'en');

      expect(mockGetStory).toHaveBeenCalledWith(
        'home',
        expect.objectContaining({ version: 'draft' }),
        expect.any(Object),
      );
    });

    it('honours an explicit `version` argument over the env (layout path stays "published" even with preview ON)', async () => {
      process.env.NEXT_STORYBLOK_ACCESS_PREVIEW = 'true';
      const { StoryblokCmsApi } = await import('./StoryblokCmsApi');
      const api = new StoryblokCmsApi(silentLogger());

      await api.getStory('layouts/default', 'en', 'main', 'published');

      expect(mockGetStory).toHaveBeenCalledWith(
        'layouts/default',
        expect.objectContaining({ version: 'published' }),
        expect.any(Object),
      );
    });

    it('passes `language: <locale>` from the call args to the SDK', async () => {
      const { StoryblokCmsApi } = await import('./StoryblokCmsApi');
      const api = new StoryblokCmsApi(silentLogger());

      await api.getStory('home', 'de');

      expect(mockGetStory).toHaveBeenCalledWith(
        'home',
        expect.objectContaining({ language: 'de' }),
        expect.any(Object),
      );
    });

    it('returns the SDK story payload unchanged on success (no shape massaging)', async () => {
      const payload = { data: { story: { name: 'Untouched', content: { body: [] } } } };
      mockGetStory.mockResolvedValueOnce(payload);
      const { StoryblokCmsApi } = await import('./StoryblokCmsApi');
      const api = new StoryblokCmsApi(silentLogger());

      const result = await api.getStory('home', 'en');

      expect(result).toBe(payload);
    });

    it('returns `null` when the SDK throws (no rethrow — settled error path)', async () => {
      mockGetStory.mockRejectedValueOnce(new Error('SDK boom'));
      const { StoryblokCmsApi } = await import('./StoryblokCmsApi');
      const api = new StoryblokCmsApi(silentLogger());

      const result = await api.getStory('home', 'en');

      expect(result).toBeNull();
    });

    it('returns `null` when the SDK returns a payload without `data.story`', async () => {
      mockGetStory.mockResolvedValueOnce({ data: {} });
      const { StoryblokCmsApi } = await import('./StoryblokCmsApi');
      const api = new StoryblokCmsApi(silentLogger());

      const result = await api.getStory('home', 'en');

      expect(result).toBeNull();
    });
  });

  describe('DI injectable', () => {
    it('is bound under the symbol "StoryblokCmsApi"', async () => {
      const { StoryblokCmsApi } = await import('./StoryblokCmsApi');
      const { getInjectableId } = await import('@/platform/core/di/injectable');

      expect(getInjectableId(StoryblokCmsApi)).toBe('StoryblokCmsApi');
    });

    it('accepts an injected LoggerService — error path emits a warn-log', async () => {
      process.env.NEXT_STORYBLOK_ACCESS_TOKEN = 'tk-4';
      mockGetStory.mockRejectedValueOnce(new Error('SDK boom'));
      const logger = silentLogger();
      const { StoryblokCmsApi } = await import('./StoryblokCmsApi');
      const api = new StoryblokCmsApi(logger);

      await api.getStory('home', 'en');

      expect(logger.warn).toHaveBeenCalledTimes(1);
    });
  });
});
