// The type-only import also marks this file as a TS module — the sibling
// _actions test file declares overlapping top-level consts; without a module
// marker both files share the global script scope and tsc reports
// "Cannot redeclare".
import type * as CmsBannerModule from './cms-banner';

/**
 * Acceptance contract for the `fetchTopBanner` server action.
 *
 * The action is the server-only gateway for the client-side top-banner hook.
 * The Storyblok access token never leaves the server: the client gets only
 * the resolved story payload, the env value stays in the action.
 *
 *  - returns `null` when the access token env is unset or whitespace-only,
 *  - returns `null` when the Storyblok SDK init accessor resolves null (defensive),
 *  - returns `null` when `storyblokInit` itself returns null (defensive),
 *  - requests `version: 'published'` unless the preview env is exactly
 *    `'true'` (strict case — `'TRUE'` does NOT enable preview),
 *  - requests `version: 'draft'` when the preview env equals `'true'`,
 *  - passes the `locale` argument through as the `language` param,
 *  - returns `null` and warn-logs when the underlying `api.get` rejects.
 *
 * The SDK contract from `@storyblok/react/rsc`:
 *
 *     storyblokInit(opts) -> (() => StoryblokClient)
 *
 * i.e. it returns an *accessor* function that must be invoked to get the
 * client. The test mock matches this shape: `mockStoryblokInit` returns an
 * accessor function which itself returns the client (or `null`).
 *
 * Runs in the Library project (node env). The action's lazy-require of
 * `@/platform/server` is mocked so the test never boots the real DI graph.
 */

const mockApiGet = jest.fn();
const mockStoryblokInit = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerDebug = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('@storyblok/react/rsc', () => ({
  __esModule: true,
  apiPlugin: { plugin: 'api' },
  storyblokInit: (...args: unknown[]) => mockStoryblokInit(...args),
}));

jest.mock('@/platform/server', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => ({
      trace: jest.fn(),
      debug: mockLoggerDebug,
      info: mockLoggerInfo,
      warn: mockLoggerWarn,
      error: mockLoggerError,
      fatal: jest.fn(),
    })),
  },
}));

const TOKEN_KEY = 'NEXT_STORYBLOK_ACCESS_TOKEN';
const PREVIEW_KEY = 'NEXT_STORYBLOK_ACCESS_PREVIEW';
const LEGACY_TOKEN_KEY = 'NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN';
const LEGACY_PREVIEW_KEY = 'NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW';

const ORIGINAL_TOKEN = process.env[TOKEN_KEY];
const ORIGINAL_PREVIEW = process.env[PREVIEW_KEY];
const ORIGINAL_LEGACY_TOKEN = process.env[LEGACY_TOKEN_KEY];
const ORIGINAL_LEGACY_PREVIEW = process.env[LEGACY_PREVIEW_KEY];

beforeEach(() => {
  // Drop the module registry so each `loadAction()` re-evaluates `cms-banner`
  // with a fresh, empty memoised-client cache. Without this, the module-level
  // `storyblokInit`-accessor memo (keyed by token) leaks across test cases
  // that reuse the same `tk-banner` token. The `jest.mock` factories above are
  // re-applied to the freshly required module automatically.
  jest.resetModules();

  mockApiGet.mockReset();
  mockStoryblokInit.mockReset();
  mockLoggerWarn.mockReset();
  mockLoggerInfo.mockReset();
  mockLoggerDebug.mockReset();
  mockLoggerError.mockReset();

  // Default: `storyblokInit` returns an accessor `() => client`. The accessor
  // is invoked by the action to get the SDK client whose `get` is the
  // file-local spy. This matches the real SDK shape
  // (`@storyblok/react/rsc.storyblokInit` returns `() => StoryblokClient`).
  // Each test that needs a different shape (null init, null accessor, throwing
  // get) overrides this explicitly. Re-prime here because the platform setup
  // runs `jest.resetAllMocks()` in `afterEach`, which would otherwise strip
  // both the module-mock implementation and the spy default.
  mockStoryblokInit.mockReturnValue(() => ({ get: mockApiGet }));

  const serverModule = jest.requireMock('@/platform/server') as {
    default: { get: jest.Mock };
  };
  serverModule.default.get.mockImplementation(() => ({
    trace: jest.fn(),
    debug: mockLoggerDebug,
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
    fatal: jest.fn(),
  }));

  delete process.env[TOKEN_KEY];
  delete process.env[PREVIEW_KEY];
  delete process.env[LEGACY_TOKEN_KEY];
  delete process.env[LEGACY_PREVIEW_KEY];
});

afterAll(() => {
  if (ORIGINAL_TOKEN === undefined) {
    delete process.env[TOKEN_KEY];
  } else {
    process.env[TOKEN_KEY] = ORIGINAL_TOKEN;
  }
  if (ORIGINAL_PREVIEW === undefined) {
    delete process.env[PREVIEW_KEY];
  } else {
    process.env[PREVIEW_KEY] = ORIGINAL_PREVIEW;
  }
  if (ORIGINAL_LEGACY_TOKEN === undefined) {
    delete process.env[LEGACY_TOKEN_KEY];
  } else {
    process.env[LEGACY_TOKEN_KEY] = ORIGINAL_LEGACY_TOKEN;
  }
  if (ORIGINAL_LEGACY_PREVIEW === undefined) {
    delete process.env[LEGACY_PREVIEW_KEY];
  } else {
    process.env[LEGACY_PREVIEW_KEY] = ORIGINAL_LEGACY_PREVIEW;
  }
});

async function loadAction() {
  // Defer the import so each test sees the env state set in its own setup.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- defer module-load until after env reset
  const mod = require('./cms-banner') as typeof CmsBannerModule;
  return mod.fetchTopBanner;
}

const SAMPLE_STORY = {
  data: {
    story: {
      content: {
        title: 'Sale',
        link: { id: '1', url: '/sale', target: '_self' },
        is_active: true,
      },
    },
  },
};

describe('fetchTopBanner — token guard', () => {
  it('returns null when the access token env is unset', async () => {
    const fetchTopBanner = await loadAction();

    await expect(fetchTopBanner({ locale: 'en' })).resolves.toBeNull();
    expect(mockStoryblokInit).not.toHaveBeenCalled();
    expect(mockApiGet).not.toHaveBeenCalled();
    // DI-touch guard: the token-guard exit must short-circuit BEFORE the
    // lazy-required `@/platform/server` container is asked for the logger.
    // Without this pin, the no-token path could silently boot the container
    // (or call `.get` once) and the test would still go green via the early
    // null return.
    const serverModule = jest.requireMock('@/platform/server') as { default: { get: jest.Mock } };
    expect(serverModule.default.get).not.toHaveBeenCalled();
  });

  it('returns null when the configured token is whitespace-only', async () => {
    process.env[TOKEN_KEY] = '   ';
    const fetchTopBanner = await loadAction();

    await expect(fetchTopBanner({ locale: 'en' })).resolves.toBeNull();
    expect(mockStoryblokInit).not.toHaveBeenCalled();
    expect(mockApiGet).not.toHaveBeenCalled();
    // Same DI-touch guard as above: whitespace-only token must take the
    // same early exit, never reaching the logger lookup.
    const serverModule = jest.requireMock('@/platform/server') as { default: { get: jest.Mock } };
    expect(serverModule.default.get).not.toHaveBeenCalled();
  });

  it('returns null when storyblokInit returns null (defensive: SDK refused to bootstrap)', async () => {
    process.env[TOKEN_KEY] = 'tk-banner';
    mockStoryblokInit.mockReturnValue(null);
    const fetchTopBanner = await loadAction();

    await expect(fetchTopBanner({ locale: 'en' })).resolves.toBeNull();
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('returns null when the storyblokInit accessor resolves a null client (defensive)', async () => {
    process.env[TOKEN_KEY] = 'tk-banner';
    // Accessor is callable but yields no client — the action must bail before
    // attempting `client.get(...)`.
    mockStoryblokInit.mockReturnValue(() => null);
    const fetchTopBanner = await loadAction();

    await expect(fetchTopBanner({ locale: 'en' })).resolves.toBeNull();
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe('fetchTopBanner — story fetch contract', () => {
  it('fetches cdn/stories/top-banner-announcement with version:"published" when preview env is unset', async () => {
    process.env[TOKEN_KEY] = 'tk-banner';
    mockApiGet.mockResolvedValue(SAMPLE_STORY);
    const fetchTopBanner = await loadAction();

    const result = await fetchTopBanner({ locale: 'en' });

    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(mockApiGet).toHaveBeenCalledWith(
      'cdn/stories/top-banner-announcement',
      expect.objectContaining({ version: 'published', language: 'en' }),
    );
    expect(result).toEqual(SAMPLE_STORY.data);
  });

  it('fetches with version:"draft" when preview env equals "true" (strict)', async () => {
    process.env[TOKEN_KEY] = 'tk-banner';
    process.env[PREVIEW_KEY] = 'true';
    mockApiGet.mockResolvedValue(SAMPLE_STORY);
    const fetchTopBanner = await loadAction();

    await fetchTopBanner({ locale: 'en' });

    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(mockApiGet).toHaveBeenCalledWith(
      'cdn/stories/top-banner-announcement',
      expect.objectContaining({ version: 'draft', language: 'en' }),
    );
  });

  it('treats preview env "TRUE" (mismatched case) as published — case-sensitive comparison', async () => {
    process.env[TOKEN_KEY] = 'tk-banner';
    process.env[PREVIEW_KEY] = 'TRUE';
    mockApiGet.mockResolvedValue(SAMPLE_STORY);
    const fetchTopBanner = await loadAction();

    await fetchTopBanner({ locale: 'en' });

    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(mockApiGet).toHaveBeenCalledWith(
      'cdn/stories/top-banner-announcement',
      expect.objectContaining({ version: 'published' }),
    );
  });

  // Strict-equality matrix: only the exact string `'true'` enables preview.
  // Every other value — including blank, `'false'`, `'0'`, `'1'`, `'yes'` —
  // must yield `version: 'published'`. A future regression that swaps the
  // comparison to a loose truthy check (e.g. `Boolean(env)` or `=== '1'`)
  // would flip at least one row red.
  it.each(['', 'false', '0', '1', 'yes'])(
    'treats preview env %j as published (strict equality to "true")',
    async (val) => {
      process.env[TOKEN_KEY] = 'tk-banner';
      process.env[PREVIEW_KEY] = val;
      mockApiGet.mockResolvedValue(SAMPLE_STORY);
      const fetchTopBanner = await loadAction();

      await fetchTopBanner({ locale: 'en' });

      expect(mockApiGet).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ version: 'published' }));
    },
  );

  it('memoises the storyblokInit accessor across fetches for the same token (no re-init per fetch)', async () => {
    process.env[TOKEN_KEY] = 'tk-banner';
    mockApiGet.mockResolvedValue(SAMPLE_STORY);
    const fetchTopBanner = await loadAction();

    await fetchTopBanner({ locale: 'en' });
    await fetchTopBanner({ locale: 'de' });

    // The SDK is init'd once; only the per-request `api.get` repeats.
    expect(mockStoryblokInit).toHaveBeenCalledTimes(1);
    expect(mockApiGet).toHaveBeenCalledTimes(2);
  });

  it('passes the locale argument through as the language param', async () => {
    process.env[TOKEN_KEY] = 'tk-banner';
    mockApiGet.mockResolvedValue(SAMPLE_STORY);
    const fetchTopBanner = await loadAction();

    await fetchTopBanner({ locale: 'de' });

    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(mockApiGet).toHaveBeenCalledWith(
      'cdn/stories/top-banner-announcement',
      expect.objectContaining({ language: 'de' }),
    );
  });
});

describe('fetchTopBanner — failure mode', () => {
  it('returns null and warn-logs when the underlying api.get rejects', async () => {
    process.env[TOKEN_KEY] = 'tk-banner';
    mockApiGet.mockRejectedValue(new Error('CDN down'));
    const fetchTopBanner = await loadAction();

    await expect(fetchTopBanner({ locale: 'en' })).resolves.toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
    // Pin the pino-style structured-log shape: first arg is the context
    // bag `{ err }`, second arg is the message. A swap to `console.warn`
    // or a string-only log would lose the structured `err` context and
    // break our log-grep on `storyblok` in ops.
    expect(mockLoggerWarn).toHaveBeenCalledWith({ err: expect.any(Error) }, expect.stringContaining('storyblok'));
  });
});
