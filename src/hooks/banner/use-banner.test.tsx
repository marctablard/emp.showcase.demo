/**
 * Token-guard tests for `useBanner`.
 *
 * Behaviour contract:
 * - When `getStoryblokApi()` returns `null` (no Storyblok token configured),
 *   the hook MUST NOT call any Storyblok API. It surfaces `data: null` and
 *   `isLoading: false` and never throws.
 * - When `getStoryblokApi()` returns a real client, the hook fetches the
 *   `top-banner-announcement` story exactly once.
 *
 * Runs in the React Tests Jest project (jsdom). Banner store is module-scoped,
 * so we reset it between tests via its public `reset()` action.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { useBannerStore } from '@/stores/banner-store';
import { getStoryblokApi } from './storyblok-banner-api';
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

// `getStoryblokApi` is re-bound per test via `mockReturnValue` below; the default
// mock here keeps Jest happy at module-eval time.
jest.mock('./storyblok-banner-api', () => ({
  getStoryblokApi: jest.fn(() => null),
}));

const mockedGetStoryblokApi = getStoryblokApi as unknown as jest.MockedFunction<() => unknown>;

const PREVIEW_ENV_KEY = 'NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW';

describe('useBanner', () => {
  // The hook reads `process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW` to pick
  // between 'draft' and 'published'. Hermetic-isolate it so a local `.env`
  // setting cannot flip the default-path tests.
  let originalPreviewEnv: string | undefined;

  beforeEach(() => {
    originalPreviewEnv = process.env[PREVIEW_ENV_KEY];
    delete process.env[PREVIEW_ENV_KEY];
    jest.clearAllMocks();
    useBannerStore.getState().reset();
  });

  afterEach(() => {
    if (originalPreviewEnv === undefined) {
      delete process.env[PREVIEW_ENV_KEY];
    } else {
      process.env[PREVIEW_ENV_KEY] = originalPreviewEnv;
    }
  });

  describe('when no Storyblok token is configured (getStoryblokApi returns null)', () => {
    it('does NOT call any Storyblok API and settles to data:null, isLoading:false', async () => {
      mockedGetStoryblokApi.mockReturnValue(null);

      const { result } = renderHook(() => useBanner());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('does not surface an error — null api is a normal "no banner configured" state', async () => {
      mockedGetStoryblokApi.mockReturnValue(null);

      const { result } = renderHook(() => useBanner());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('when a Storyblok client is available', () => {
    it('fetches the top-banner-announcement story with the expected params (preview off → version:published)', async () => {
      const storyResponse = {
        data: {
          story: { content: { title: 'Sale', link: { id: '1', url: '/sale', target: '_self' }, is_active: true } },
        },
      };
      const apiGet = jest.fn(async () => storyResponse);
      mockedGetStoryblokApi.mockReturnValue({ get: apiGet });

      const { result } = renderHook(() => useBanner());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(apiGet).toHaveBeenCalledTimes(1);
      expect(apiGet).toHaveBeenCalledWith(
        'cdn/stories/top-banner-announcement',
        expect.objectContaining({ language: 'en', version: 'published' }),
      );
      expect(result.current.data).toEqual(storyResponse.data);
    });

    it('requests version:draft when NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW="true"', async () => {
      process.env[PREVIEW_ENV_KEY] = 'true';

      const storyResponse = {
        data: {
          story: { content: { title: 'Sale', link: { id: '1', url: '/sale', target: '_self' }, is_active: true } },
        },
      };
      const apiGet = jest.fn(async () => storyResponse);
      mockedGetStoryblokApi.mockReturnValue({ get: apiGet });

      const { result } = renderHook(() => useBanner());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(apiGet).toHaveBeenCalledTimes(1);
      expect(apiGet).toHaveBeenCalledWith(
        'cdn/stories/top-banner-announcement',
        expect.objectContaining({ language: 'en', version: 'draft' }),
      );
    });

    it('surfaces a rejected fetch as an Error and settles isLoading:false', async () => {
      const apiGet = jest.fn(async () => {
        throw new Error('API down');
      });
      mockedGetStoryblokApi.mockReturnValue({ get: apiGet });

      const { result } = renderHook(() => useBanner());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(apiGet).toHaveBeenCalledTimes(1);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('API down');
    });
  });
});
