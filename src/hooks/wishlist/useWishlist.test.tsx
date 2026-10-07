import { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { fetchCurrentWishlist } from '@/lib/client/wishlist';
import type { Session } from '@/platform/services/model/session/session';
import type { Wishlist } from '@/platform/services/model/wishlist/wishlist';
import { StoreProvider } from '@/providers/StoreProvider';
import { useWishlist } from './useWishlist';

const mockUseAuthSession = jest.fn();

jest.mock('next-auth/react', () => ({
  useSession: (...args: unknown[]) => mockUseAuthSession(...args),
}));

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

jest.mock('@/lib/client/wishlist', () => ({
  ...jest.requireActual('@/lib/client/wishlist'),
  fetchCurrentWishlist: jest.fn(),
}));

const defaultTestShopSession: Session = {
  id: 'jest-session',
  siteCode: 'main',
  currency: 'USD',
  customerId: 'ANONYMOUS',
};

const mockWishlist: Wishlist = {
  id: 'wl-1',
  name: 'Wishlist',
  type: 'wishlist',
  currency: 'USD',
  siteCode: 'main',
  items: [],
  totalQuantity: 0,
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider shopSession={defaultTestShopSession}>{children}</StoreProvider>
);

const mockedFetchCurrentWishlist = fetchCurrentWishlist as jest.MockedFunction<typeof fetchCurrentWishlist>;

describe('useWishlist hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFetchCurrentWishlist.mockResolvedValue(mockWishlist);
  });

  test('does not fetch while next-auth is loading and keeps wishlist undefined', async () => {
    mockUseAuthSession.mockReturnValue({ status: 'loading', data: null });

    const { result } = renderHook(() => useWishlist(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedFetchCurrentWishlist).toHaveBeenCalledTimes(0);
    expect(result.current.wishlist).toBeUndefined();
  });

  test('does not fetch while next-auth is unauthenticated and clears wishlist to null', async () => {
    mockUseAuthSession.mockReturnValue({ status: 'unauthenticated', data: null });

    const { result } = renderHook(() => useWishlist(), { wrapper });

    await waitFor(() => {
      expect(result.current.wishlist).toBeNull();
    });

    expect(mockedFetchCurrentWishlist).toHaveBeenCalledTimes(0);
  });

  test('fetches the wishlist when next-auth is authenticated', async () => {
    mockUseAuthSession.mockReturnValue({ status: 'authenticated', data: { user: { email: 'user@example.com' } } });

    const { result } = renderHook(() => useWishlist(), { wrapper });

    await waitFor(() => {
      expect(mockedFetchCurrentWishlist).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(result.current.wishlist).toEqual(mockWishlist);
    });
  });

  test('transition from loading to unauthenticated never fetches', async () => {
    mockUseAuthSession.mockReturnValue({ status: 'loading', data: null });

    const { result, rerender } = renderHook(() => useWishlist(), { wrapper });

    expect(mockedFetchCurrentWishlist).toHaveBeenCalledTimes(0);
    expect(result.current.wishlist).toBeUndefined();

    mockUseAuthSession.mockReturnValue({ status: 'unauthenticated', data: null });
    rerender();

    await waitFor(() => {
      expect(result.current.wishlist).toBeNull();
    });

    expect(mockedFetchCurrentWishlist).toHaveBeenCalledTimes(0);
  });

  test('transition from loading to authenticated fetches after auth', async () => {
    mockUseAuthSession.mockReturnValue({ status: 'loading', data: null });

    const { result, rerender } = renderHook(() => useWishlist(), { wrapper });

    expect(mockedFetchCurrentWishlist).toHaveBeenCalledTimes(0);
    expect(result.current.wishlist).toBeUndefined();

    mockUseAuthSession.mockReturnValue({ status: 'authenticated', data: { user: { email: 'user@example.com' } } });
    rerender();

    await waitFor(() => {
      expect(mockedFetchCurrentWishlist).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(result.current.wishlist).toEqual(mockWishlist);
    });
  });

  test('refetch while loading does not call fetchCurrentWishlist', async () => {
    mockUseAuthSession.mockReturnValue({ status: 'loading', data: null });

    const { result } = renderHook(() => useWishlist(), { wrapper });

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockedFetchCurrentWishlist).toHaveBeenCalledTimes(0);
    expect(result.current.wishlist).toBeUndefined();
  });

  test('refetch while unauthenticated does not call fetchCurrentWishlist', async () => {
    mockUseAuthSession.mockReturnValue({ status: 'unauthenticated', data: null });

    const { result } = renderHook(() => useWishlist(), { wrapper });

    await waitFor(() => {
      expect(result.current.wishlist).toBeNull();
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockedFetchCurrentWishlist).toHaveBeenCalledTimes(0);
  });
});
