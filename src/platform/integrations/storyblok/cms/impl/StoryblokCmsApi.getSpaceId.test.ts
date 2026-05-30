/**
 * Acceptance tests for `StoryblokCmsApi.getSpaceId()` (EMP-15 §5).
 *
 * The preview adapter compares the signed `_storyblok_tk[space_id]` against
 * the configured space id. `getSpaceId()` exposes that id, sourced purely from
 * `NEXT_PUBLIC_STORYBLOK_SPACE_ID`:
 *   - configured (after trimming) → the trimmed value.
 *   - unset / blank / whitespace-only → `null` (adapter then SKIPS the
 *     space-id check; documented residual risk, FU-004).
 *
 * The Content-Delivery SDK is jest-mocked so the constructor never touches the
 * network — we are exercising the env read only.
 */
import type { LoggerService } from '@/platform/services/logger/LoggerService';

jest.mock('@storyblok/react/rsc', () => ({
  __esModule: true,
  apiPlugin: { plugin: 'api' },
  storyblokInit: jest.fn(() => () => ({ getStory: jest.fn() })),
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

const ENV_KEY = 'NEXT_PUBLIC_STORYBLOK_SPACE_ID';
const original = process.env[ENV_KEY];

afterAll(() => {
  if (original === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = original;
  }
});

beforeEach(() => {
  delete process.env[ENV_KEY];
});

describe('StoryblokCmsApi.getSpaceId()', () => {
  it('returns the configured space id', async () => {
    process.env[ENV_KEY] = '295018';
    const { StoryblokCmsApi } = await import('./StoryblokCmsApi');
    const api = new StoryblokCmsApi(silentLogger());

    expect(api.getSpaceId()).toBe('295018');
  });

  it('trims surrounding whitespace from the configured space id', async () => {
    process.env[ENV_KEY] = '  295018  ';
    const { StoryblokCmsApi } = await import('./StoryblokCmsApi');
    const api = new StoryblokCmsApi(silentLogger());

    expect(api.getSpaceId()).toBe('295018');
  });

  it('returns null when the space id is unset', async () => {
    const { StoryblokCmsApi } = await import('./StoryblokCmsApi');
    const api = new StoryblokCmsApi(silentLogger());

    expect(api.getSpaceId()).toBeNull();
  });

  it('returns null for a blank / whitespace-only space id', async () => {
    process.env[ENV_KEY] = '   ';
    const { StoryblokCmsApi } = await import('./StoryblokCmsApi');
    const api = new StoryblokCmsApi(silentLogger());

    expect(api.getSpaceId()).toBeNull();
  });
});
