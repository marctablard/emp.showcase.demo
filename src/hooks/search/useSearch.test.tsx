import { act, renderHook } from '@testing-library/react';
import { useSiteCode } from '@/hooks/site/useSiteCode';
import { USE_SEARCH_CLIENT_ERROR, useSearch } from './useSearch';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/browse',
}));

jest.mock('@/hooks/history/useHistory', () => ({
  __esModule: true,
  default: () => ({ addSearchQuery: jest.fn() }),
}));

jest.mock('@/providers/StoreProvider', () => ({
  useSessionStore: () => ({ session: { currency: 'EUR' } }),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({ warn: jest.fn(), error: jest.fn() }),
}));

jest.mock('@/hooks/site/useSiteCode', () => ({
  useSiteCode: jest.fn(),
}));

describe('useSearch', () => {
  const mockedUseSiteCode = useSiteCode as jest.MockedFunction<typeof useSiteCode>;

  beforeEach(() => {
    mockedUseSiteCode.mockReturnValue('main');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        total: 0,
        page: 0,
        pageSize: 12,
        availableFilters: [],
      }),
    });
  });

  it('exposes MISSING_SITE and does not fetch when site code is missing', async () => {
    mockedUseSiteCode.mockReturnValue(undefined);
    const { result } = renderHook(() => useSearch());

    await act(async () => {
      await result.current.search({ page: 0, size: 12 });
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.error).toBe(USE_SEARCH_CLIENT_ERROR.MISSING_SITE);
  });

  it('clears error and fetches when site is present', async () => {
    const { result } = renderHook(() => useSearch());

    await act(async () => {
      await result.current.search({ page: 0, size: 12 });
    });

    expect(global.fetch).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });
});
