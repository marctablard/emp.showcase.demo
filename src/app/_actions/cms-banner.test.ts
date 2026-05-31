export {}; // mark this file as a TS module — the sibling _actions test file
// declares overlapping top-level consts; without this directive both files
// share the global script scope and tsc reports "Cannot redeclare".

/**
 * Acceptance contract for the `fetchTopBanner` server action.
 *
 * The action is the server-only gateway for the client-side top-banner hook.
 * The Storyblok access token never leaves the server: the client gets only
 * the resolved story payload, the env value stays in the action.
 *
 *  - returns `null` when the access token env is unset or whitespace-only,
 *  - returns `null` when the Storyblok SDK init returns null (defensive),
 *  - requests `version: 'published'` unless the preview env is exactly
 *    `'true'` (strict case — `'TRUE'` does NOT enable preview),
 *  - requests `version: 'draft'` when the preview env equals `'true'`,
 *  - passes the `locale` argument through as the `language` param,
 *  - returns `null` and warn-logs when the underlying `api.get` rejects.
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

const ORIGINAL_TOKEN = process.env[TOKEN_KEY];
const ORIGINAL_PREVIEW = process.env[PREVIEW_KEY];

beforeEach(() => {
  mockApiGet.mockReset();
  mockStoryblokInit.mockReset();
  mockLoggerWarn.mockReset();
  mockLoggerInfo.mockReset();
  mockLoggerDebug.mockReset();
  mockLoggerError.mockReset();

  // Default: a fresh storyblok client whose `get` is the file-local spy.
  // Each test that needs a different shape (null, throwing get) overrides
  // this explicitly. Re-prime here because the platform setup runs
  // `jest.resetAllMocks()` in `afterEach`, which would otherwise strip
  // both the module-mock implementation and the spy default.
  mockStoryblokInit.mockReturnValue({ get: mockApiGet });

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
});

async function loadAction() {
  // Defer the import so each test sees the env state set in its own setup.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- defer module-load until after env reset
  const mod = require('./cms-banner') as typeof import('./cms-banner');
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
  });

  it('returns null when the configured token is whitespace-only', async () => {
    process.env[TOKEN_KEY] = '   ';
    const fetchTopBanner = await loadAction();

    await expect(fetchTopBanner({ locale: 'en' })).resolves.toBeNull();
    expect(mockStoryblokInit).not.toHaveBeenCalled();
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('returns null when storyblokInit returns null (defensive: SDK refused to bootstrap)', async () => {
    process.env[TOKEN_KEY] = 'tk-banner';
    mockStoryblokInit.mockReturnValue(null);
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
  });
});
