/**
 * Acceptance contract for the `getStoryblokBridgeConfig` server action.
 *
 * The action is the server-only gateway that hands a Storyblok bridge token
 * to client-side code embedded in the Visual Editor. It must:
 *
 *  - return `null` when the token env is unset or whitespace-only,
 *  - return `null` when the referer is missing or its pathname is not
 *    under `/preview/`, and warn-log the deny,
 *  - return `{ accessToken }` only when the referer pathname starts with
 *    `/preview/`, regardless of trailing query/hash.
 *
 * The token is intentionally kept on the server. The bridge component must
 * resolve it through this action; reading the env from the client is not a
 * supported path.
 */

const mockHeadersGet = jest.fn<string | null, [string]>();
const mockLoggerWarn = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerDebug = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('next/headers', () => ({
  __esModule: true,
  headers: jest.fn(async () => ({
    get: (name: string) => mockHeadersGet(name),
  })),
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

const ORIGINAL_TOKEN = process.env.NEXT_STORYBLOK_ACCESS_TOKEN;
const ORIGINAL_LEGACY_TOKEN = process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN;

beforeEach(() => {
  mockHeadersGet.mockReset();
  mockLoggerWarn.mockReset();
  mockLoggerInfo.mockReset();
  mockLoggerDebug.mockReset();
  mockLoggerError.mockReset();

  // Re-prime the headers mock implementation: the shared platform setup runs
  // `jest.resetAllMocks()` in `afterEach`, which would otherwise clear the
  // factory implementation between cases.
  const nextHeaders = jest.requireMock('next/headers') as {
    headers: jest.Mock;
  };
  nextHeaders.headers.mockImplementation(async () => ({
    get: (name: string) => mockHeadersGet(name),
  }));

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

  delete process.env.NEXT_STORYBLOK_ACCESS_TOKEN;
  delete process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN;
});

afterAll(() => {
  if (ORIGINAL_TOKEN === undefined) {
    delete process.env.NEXT_STORYBLOK_ACCESS_TOKEN;
  } else {
    process.env.NEXT_STORYBLOK_ACCESS_TOKEN = ORIGINAL_TOKEN;
  }
  if (ORIGINAL_LEGACY_TOKEN === undefined) {
    delete process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN;
  } else {
    process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN = ORIGINAL_LEGACY_TOKEN;
  }
});

async function loadAction() {
  // Defer the import so each test sees the env state set in its own setup.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- defer module-load until after env reset
  const mod = require('./storyblok-bridge') as typeof import('./storyblok-bridge');
  return mod.getStoryblokBridgeConfig;
}

describe('getStoryblokBridgeConfig — token guard', () => {
  it('returns null when NEXT_STORYBLOK_ACCESS_TOKEN is unset', async () => {
    mockHeadersGet.mockImplementation((name) => (name === 'referer' ? 'http://localhost:3000/preview/main/en' : null));

    const getStoryblokBridgeConfig = await loadAction();

    await expect(getStoryblokBridgeConfig()).resolves.toBeNull();
  });

  it('returns null when the configured token is whitespace-only', async () => {
    process.env.NEXT_STORYBLOK_ACCESS_TOKEN = '   ';
    mockHeadersGet.mockImplementation((name) => (name === 'referer' ? 'http://localhost:3000/preview/main/en' : null));

    const getStoryblokBridgeConfig = await loadAction();

    await expect(getStoryblokBridgeConfig()).resolves.toBeNull();
  });
});

describe('getStoryblokBridgeConfig — referer access check', () => {
  it('returns null and warn-logs when the referer header is missing', async () => {
    process.env.NEXT_STORYBLOK_ACCESS_TOKEN = 'tk-bridge';
    mockHeadersGet.mockReturnValue(null);

    const getStoryblokBridgeConfig = await loadAction();

    await expect(getStoryblokBridgeConfig()).resolves.toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
  });

  it('returns null and warn-logs when the referer pathname is not under /preview/', async () => {
    process.env.NEXT_STORYBLOK_ACCESS_TOKEN = 'tk-bridge';
    mockHeadersGet.mockImplementation((name) =>
      name === 'referer' ? 'http://localhost:3000/main/en/some-page' : null,
    );

    const getStoryblokBridgeConfig = await loadAction();

    await expect(getStoryblokBridgeConfig()).resolves.toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
  });

  it('returns null and warn-logs when the referer is not a parsable URL', async () => {
    process.env.NEXT_STORYBLOK_ACCESS_TOKEN = 'tk-bridge';
    mockHeadersGet.mockImplementation((name) => (name === 'referer' ? 'not-a-url' : null));

    const getStoryblokBridgeConfig = await loadAction();

    await expect(getStoryblokBridgeConfig()).resolves.toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
  });
});

describe('getStoryblokBridgeConfig — allowed callers', () => {
  it('returns { accessToken } when the referer pathname starts with /preview/ and the token is set', async () => {
    process.env.NEXT_STORYBLOK_ACCESS_TOKEN = 'tk-bridge';
    mockHeadersGet.mockImplementation((name) => (name === 'referer' ? 'http://localhost:3000/preview/main/en' : null));

    const getStoryblokBridgeConfig = await loadAction();

    await expect(getStoryblokBridgeConfig()).resolves.toEqual({ accessToken: 'tk-bridge' });
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  it('returns { accessToken } when the referer carries query/hash and the pathname is under /preview/', async () => {
    process.env.NEXT_STORYBLOK_ACCESS_TOKEN = 'tk-bridge';
    mockHeadersGet.mockImplementation((name) =>
      name === 'referer' ? 'http://localhost:3000/preview/main/en?_storyblok=42&_storyblok_tk=abc#anchor' : null,
    );

    const getStoryblokBridgeConfig = await loadAction();

    await expect(getStoryblokBridgeConfig()).resolves.toEqual({ accessToken: 'tk-bridge' });
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });
});
