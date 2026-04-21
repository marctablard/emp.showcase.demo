import { act, renderHook } from '@testing-library/react';
import { useShopContextReady } from './useShopContextReady';

const mockUseSession = jest.fn();
const mockUseSite = jest.fn();
const mockUseCartStore = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock('@/hooks/session/useSession', () => ({
  useSession: () => mockUseSession(),
}));

jest.mock('@/hooks/site/useSite', () => ({
  useSite: () => mockUseSite(),
}));

jest.mock('@/providers/StoreProvider', () => ({
  useCartStore: () => mockUseCartStore(),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({ warn: mockLoggerWarn, info: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

describe('useShopContextReady', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCartStore.mockReturnValue({ loading: false });
  });

  it('returns ready=true when session and site are aligned', () => {
    mockUseSession.mockReturnValue({
      session: { siteCode: 'main', currency: 'EUR' },
      loading: false,
    });
    mockUseSite.mockReturnValue({ site: { code: 'main' } });

    const { result } = renderHook(() => useShopContextReady());

    expect(result.current.ready).toBe(true);
    expect(result.current.sessionReady).toBe(true);
    expect(result.current.siteAligned).toBe(true);
    expect(result.current.cartSettled).toBe(true);
  });

  it('returns ready=false when session is null', () => {
    mockUseSession.mockReturnValue({ session: null, loading: false });
    mockUseSite.mockReturnValue({ site: { code: 'main' } });

    const { result } = renderHook(() => useShopContextReady());

    expect(result.current.ready).toBe(false);
    expect(result.current.sessionReady).toBe(false);
  });

  it('returns ready=false when session is undefined', () => {
    mockUseSession.mockReturnValue({ session: undefined, loading: false });
    mockUseSite.mockReturnValue({ site: { code: 'main' } });

    const { result } = renderHook(() => useShopContextReady());

    expect(result.current.ready).toBe(false);
    expect(result.current.sessionReady).toBe(false);
  });

  it('returns ready=false when session is loading', () => {
    mockUseSession.mockReturnValue({
      session: { siteCode: 'main', currency: 'EUR' },
      loading: true,
    });
    mockUseSite.mockReturnValue({ site: { code: 'main' } });

    const { result } = renderHook(() => useShopContextReady());

    expect(result.current.ready).toBe(false);
    expect(result.current.sessionReady).toBe(false);
  });

  it('returns ready=false when session.siteCode is missing', () => {
    mockUseSession.mockReturnValue({
      session: { siteCode: '', currency: 'EUR' },
      loading: false,
    });
    mockUseSite.mockReturnValue({ site: { code: 'main' } });

    const { result } = renderHook(() => useShopContextReady());

    expect(result.current.ready).toBe(false);
    expect(result.current.sessionReady).toBe(false);
  });

  it('returns ready=false when session.currency is missing', () => {
    mockUseSession.mockReturnValue({
      session: { siteCode: 'main', currency: '' },
      loading: false,
    });
    mockUseSite.mockReturnValue({ site: { code: 'main' } });

    const { result } = renderHook(() => useShopContextReady());

    expect(result.current.ready).toBe(false);
    expect(result.current.sessionReady).toBe(false);
  });

  it('returns siteAligned=false when site.code does not match session.siteCode', () => {
    mockUseSession.mockReturnValue({
      session: { siteCode: 'main', currency: 'EUR' },
      loading: false,
    });
    mockUseSite.mockReturnValue({ site: { code: 'us-branch' } });

    const { result } = renderHook(() => useShopContextReady());

    expect(result.current.ready).toBe(false);
    expect(result.current.sessionReady).toBe(true);
    expect(result.current.siteAligned).toBe(false);
  });

  it('returns siteAligned=false when site is null', () => {
    mockUseSession.mockReturnValue({
      session: { siteCode: 'main', currency: 'EUR' },
      loading: false,
    });
    mockUseSite.mockReturnValue({ site: null });

    const { result } = renderHook(() => useShopContextReady());

    expect(result.current.ready).toBe(false);
    expect(result.current.siteAligned).toBe(false);
  });

  it('returns cartSettled=true when requireCart is not set', () => {
    mockUseSession.mockReturnValue({
      session: { siteCode: 'main', currency: 'EUR' },
      loading: false,
    });
    mockUseSite.mockReturnValue({ site: { code: 'main' } });
    mockUseCartStore.mockReturnValue({ loading: true });

    const { result } = renderHook(() => useShopContextReady());

    expect(result.current.ready).toBe(true);
    expect(result.current.cartSettled).toBe(true);
  });

  it('returns cartSettled=false when requireCart=true and cart is loading', () => {
    mockUseSession.mockReturnValue({
      session: { siteCode: 'main', currency: 'EUR' },
      loading: false,
    });
    mockUseSite.mockReturnValue({ site: { code: 'main' } });
    mockUseCartStore.mockReturnValue({ loading: true });

    const { result } = renderHook(() => useShopContextReady({ requireCart: true }));

    expect(result.current.ready).toBe(false);
    expect(result.current.cartSettled).toBe(false);
  });

  it('returns ready=true when requireCart=true and cart is not loading', () => {
    mockUseSession.mockReturnValue({
      session: { siteCode: 'main', currency: 'EUR' },
      loading: false,
    });
    mockUseSite.mockReturnValue({ site: { code: 'main' } });
    mockUseCartStore.mockReturnValue({ loading: false });

    const { result } = renderHook(() => useShopContextReady({ requireCart: true }));

    expect(result.current.ready).toBe(true);
    expect(result.current.cartSettled).toBe(true);
  });

  it('forces ready=true after timeout when stuck in not-ready state', () => {
    jest.useFakeTimers();
    mockUseSession.mockReturnValue({ session: null, loading: true });
    mockUseSite.mockReturnValue({ site: null });
    mockUseCartStore.mockReturnValue({ loading: true });

    const { result } = renderHook(() => useShopContextReady({ requireCart: true }));

    expect(result.current.ready).toBe(false);

    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    expect(result.current.ready).toBe(true);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ sessionReady: false }),
      expect.stringContaining('forcing ready after timeout'),
    );

    jest.useRealTimers();
  });

  it('does not fire timeout when ready resolves naturally', () => {
    jest.useFakeTimers();
    mockUseSession.mockReturnValue({
      session: { siteCode: 'main', currency: 'EUR' },
      loading: false,
    });
    mockUseSite.mockReturnValue({ site: { code: 'main' } });
    mockUseCartStore.mockReturnValue({ loading: false });

    const { result } = renderHook(() => useShopContextReady());

    expect(result.current.ready).toBe(true);

    act(() => {
      jest.advanceTimersByTime(15_000);
    });

    expect(mockLoggerWarn).not.toHaveBeenCalled();

    jest.useRealTimers();
  });
});
