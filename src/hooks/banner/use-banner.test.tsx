/**
 * Acceptance contract for `useBanner` against the server-action surface.
 *
 * Behaviour contract:
 * - The hook drives the banner fetch through the `fetchTopBanner` server
 *   action. The Storyblok token never crosses a browser-side env read.
 * - When the action resolves `null` (no token configured, blank token,
 *   defensive null from the SDK), the hook MUST NOT throw and MUST settle
 *   to `data: null`, `isLoading: false`, `error: null`.
 * - When the action resolves a banner payload, the hook surfaces it on
 *   `data` and settles `isLoading: false`.
 * - The action is called exactly once per mount with the active locale.
 * - When the action rejects, the hook surfaces the error and settles.
 *
 * Runs in the React Tests Jest project (jsdom). Banner store is module-
 * scoped, so we reset it between tests via its public `reset()` action.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fetchTopBanner } from '@/app/_actions/cms-banner';
import { useBannerStore } from '@/stores/banner-store';
import { useBanner } from './use-banner';

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  }),
}));

// `fetchTopBanner` is re-bound per test via `mockResolvedValue` /
// `mockRejectedValue`. The default no-op resolution keeps Jest happy at
// module-eval time; per-test setup overrides it explicitly.
jest.mock('@/app/_actions/cms-banner', () => ({
  __esModule: true,
  fetchTopBanner: jest.fn(async () => null),
}));

const mockFetchTopBanner = fetchTopBanner as jest.MockedFunction<typeof fetchTopBanner>;

describe('useBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The global `afterEach(jest.resetAllMocks())` in `jest.react.setup.js`
    // strips the factory's default implementation between tests, so each
    // case must re-seed an explicit return value. Default to "no banner".
    mockFetchTopBanner.mockResolvedValue(null);
    useBannerStore.getState().reset();
  });

  describe('when the server action resolves null (no banner configured)', () => {
    it('does NOT throw and settles to data:null, isLoading:false', async () => {
      mockFetchTopBanner.mockResolvedValue(null);

      const { result } = renderHook(() => useBanner());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('calls the server action exactly once with the active locale', async () => {
      mockFetchTopBanner.mockResolvedValue(null);

      const { result } = renderHook(() => useBanner());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetchTopBanner).toHaveBeenCalledTimes(1);
      expect(mockFetchTopBanner).toHaveBeenCalledWith({ locale: 'en' });
    });
  });

  describe('when the server action resolves a banner payload', () => {
    it('surfaces the payload on data and settles isLoading:false', async () => {
      const payload = {
        story: {
          content: {
            title: 'Sale',
            link: { id: '1', url: '/sale', target: '_self' },
            is_active: true,
          },
        },
      };
      mockFetchTopBanner.mockResolvedValue(payload);

      const { result } = renderHook(() => useBanner());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetchTopBanner).toHaveBeenCalledTimes(1);
      expect(mockFetchTopBanner).toHaveBeenCalledWith({ locale: 'en' });
      expect(result.current.data).toEqual(payload);
      expect(result.current.error).toBeNull();
    });
  });

  describe('when the server action rejects', () => {
    it('surfaces the rejection as an Error and settles isLoading:false', async () => {
      mockFetchTopBanner.mockRejectedValue(new Error('API down'));

      const { result } = renderHook(() => useBanner());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetchTopBanner).toHaveBeenCalledTimes(1);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('API down');
    });
  });
});

describe('useBanner — source-text invariants', () => {
  // Source-text audit pins the env-migration: the hook is a browser-side
  // module and MUST NOT read the Storyblok preview env directly. The env
  // read lives server-side in `fetchTopBanner` (`@/app/_actions/cms-banner`),
  // so any reappearance of `process.env.NEXT_*STORYBLOK_ACCESS_PREVIEW` here
  // re-leaks the contract.
  const HOOK_PATH = resolve(__dirname, './use-banner.ts');

  it('does not read process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW (env-read is server-side now)', () => {
    const source = readFileSync(HOOK_PATH, 'utf8');
    expect(source).not.toMatch(/process\.env\.NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW/);
  });

  it('does not read process.env.NEXT_STORYBLOK_ACCESS_PREVIEW (env-read is server-side now)', () => {
    const source = readFileSync(HOOK_PATH, 'utf8');
    expect(source).not.toMatch(/process\.env\.NEXT_STORYBLOK_ACCESS_PREVIEW/);
  });
});

describe('storyblok-banner-api removal guard', () => {
  // Deletion-guard: the browser-side Storyblok client accessor must not
  // exist any more — the only consumer (`useBanner`) now goes through the
  // server action. `require.resolve` (not a static import) keeps this test
  // file compilable both before AND after the dev deletes the module
  // (see memory: deletion-guard-pattern).
  it('storyblok-banner-api module is removed (no Storyblok client lives in the browser bundle)', () => {
    expect(() => require.resolve('./storyblok-banner-api')).toThrow();
  });
});
