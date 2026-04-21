import { act, renderHook } from '@testing-library/react';
import { useSession } from './useSession';

const mockFetchCurrentSession = jest.fn();
const mockUpdateSessionLanguage = jest.fn();
const mockUpdateSessionCurrency = jest.fn();
const mockUpdateSessionCountry = jest.fn();
const mockUpdateSessionSite = jest.fn();
const mockUpdateSessionRegion = jest.fn();
const mockUseSessionStore = jest.fn();

jest.mock('@/lib/client/session', () => ({
  fetchCurrentSession: (...args: unknown[]) => mockFetchCurrentSession(...args),
  updateSessionLanguage: (...args: unknown[]) => mockUpdateSessionLanguage(...args),
  updateSessionCurrency: (...args: unknown[]) => mockUpdateSessionCurrency(...args),
  updateSessionCountry: (...args: unknown[]) => mockUpdateSessionCountry(...args),
  updateSessionSite: (...args: unknown[]) => mockUpdateSessionSite(...args),
  updateSessionRegion: (...args: unknown[]) => mockUpdateSessionRegion(...args),
}));

jest.mock('@/providers/StoreProvider', () => ({
  useSessionStore: () => mockUseSessionStore(),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve: ((value: T) => void) | undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  if (!resolve) {
    throw new Error('Deferred resolver was not initialized');
  }
  return { promise, resolve };
};

const createMockStore = (overrides: Record<string, unknown> = {}) => {
  let mutationInFlight = false;
  const store: Record<string, unknown> = {
    session: null,
    loading: false,
    setSession: jest.fn((session) => {
      store.session = session;
    }),
    setLoading: jest.fn((loading) => {
      store.loading = loading;
    }),
    fetchSession: jest.fn().mockResolvedValue(null),
    tryAcquireMutationLock: jest.fn(() => {
      if (mutationInFlight) {
        return false;
      }
      mutationInFlight = true;
      return true;
    }),
    releaseMutationLock: jest.fn(() => {
      mutationInFlight = false;
    }),
    ...overrides,
  };
  return store;
};

describe('useSession mutation lock', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const store = createMockStore();

    mockUseSessionStore.mockReturnValue(store);
    mockFetchCurrentSession.mockResolvedValue({ id: 'session-1', siteCode: 'main' });
    mockUpdateSessionLanguage.mockResolvedValue(true);
    mockUpdateSessionCurrency.mockResolvedValue(true);
    mockUpdateSessionCountry.mockResolvedValue(true);
    mockUpdateSessionSite.mockResolvedValue(true);
    mockUpdateSessionRegion.mockResolvedValue(true);
  });

  it('blocks concurrent mutations across hook instances and allows next mutation after release', async () => {
    const currencyDeferred = createDeferred<boolean>();
    mockUpdateSessionCurrency.mockReturnValueOnce(currencyDeferred.promise);

    const hookA = renderHook(() => useSession());
    const hookB = renderHook(() => useSession());

    let firstMutationPromise: Promise<boolean>;
    act(() => {
      firstMutationPromise = hookA.result.current.setCurrency('EUR');
    });

    let blockedResult: boolean;
    await act(async () => {
      blockedResult = await hookB.result.current.setLanguage('de');
    });

    expect(blockedResult!).toBe(false);
    expect(mockUpdateSessionLanguage).not.toHaveBeenCalled();

    await act(async () => {
      currencyDeferred.resolve(true);
      await firstMutationPromise!;
    });

    let thirdResult: boolean;
    await act(async () => {
      thirdResult = await hookB.result.current.setCountry('DE');
    });

    expect(thirdResult!).toBe(true);
    expect(mockUpdateSessionCurrency).toHaveBeenCalledTimes(1);
    expect(mockUpdateSessionCountry).toHaveBeenCalledTimes(1);
  });
});

describe('useSession null-session recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should trigger fetchSession when session is null (SSR failure recovery)', () => {
    const store = createMockStore({ session: null, loading: false });
    mockUseSessionStore.mockReturnValue(store);

    renderHook(() => useSession());

    expect(store.fetchSession).toHaveBeenCalledTimes(1);
  });

  it('should trigger fetchSession when session lacks siteCode', () => {
    const store = createMockStore({
      session: { id: 's1', currency: 'EUR', siteCode: '' },
      loading: false,
    });
    mockUseSessionStore.mockReturnValue(store);

    renderHook(() => useSession());

    expect(store.fetchSession).toHaveBeenCalledTimes(1);
  });

  it('should trigger fetchSession when session lacks currency', () => {
    const store = createMockStore({
      session: { id: 's1', currency: '', siteCode: 'main' },
      loading: false,
    });
    mockUseSessionStore.mockReturnValue(store);

    renderHook(() => useSession());

    expect(store.fetchSession).toHaveBeenCalledTimes(1);
  });

  it('should not retry recovery more than once for the same null session', () => {
    const store = createMockStore({ session: null, loading: false });
    mockUseSessionStore.mockReturnValue(store);

    const { rerender } = renderHook(() => useSession());

    expect(store.fetchSession).toHaveBeenCalledTimes(1);

    rerender();

    expect(store.fetchSession).toHaveBeenCalledTimes(1);
  });

  it('should not attempt recovery while session store is loading', () => {
    const store = createMockStore({ session: null, loading: true });
    mockUseSessionStore.mockReturnValue(store);

    renderHook(() => useSession());

    expect(store.fetchSession).not.toHaveBeenCalled();
  });

  it('should not trigger recovery for a valid session', () => {
    const store = createMockStore({
      session: { id: 's1', currency: 'EUR', siteCode: 'main' },
      loading: false,
    });
    mockUseSessionStore.mockReturnValue(store);

    renderHook(() => useSession());

    expect(store.fetchSession).not.toHaveBeenCalled();
  });
});

describe('useSession fetch resilience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps last known session when mutation refetch returns null', async () => {
    const store = createMockStore({
      session: { id: 'session-existing', currency: 'USD', siteCode: 'main' },
    });

    mockUseSessionStore.mockReturnValue(store);
    mockUpdateSessionCurrency.mockResolvedValue(true);
    mockFetchCurrentSession.mockRejectedValue(new Error('Temporary fetch failure'));

    const { result } = renderHook(() => useSession());
    let mutationResult: boolean;

    await act(async () => {
      mutationResult = await result.current.setCurrency('EUR');
    });

    expect(mutationResult!).toBe(false);
    expect(store.session).toEqual({ id: 'session-existing', currency: 'USD', siteCode: 'main' });
    expect(store.setSession).not.toHaveBeenCalledWith(null);
  });

  it('returns cached session when refresh fetch throws', async () => {
    const store = createMockStore({
      session: { id: 'session-existing', currency: 'USD', siteCode: 'main' },
    });

    mockUseSessionStore.mockReturnValue(store);
    mockFetchCurrentSession.mockRejectedValue(new Error('Temporary fetch failure'));

    const { result } = renderHook(() => useSession());
    let refreshed;
    await act(async () => {
      refreshed = await result.current.refreshSession();
    });

    expect(refreshed).toEqual({ id: 'session-existing', currency: 'USD', siteCode: 'main' });
    expect(store.setSession).not.toHaveBeenCalledWith(null);
  });

  it('clears session when refresh succeeds with explicit null session', async () => {
    const store = createMockStore({
      session: { id: 'session-existing', currency: 'USD', siteCode: 'main' },
    });

    mockUseSessionStore.mockReturnValue(store);
    mockFetchCurrentSession.mockResolvedValue(null);

    const { result } = renderHook(() => useSession());

    await act(async () => {
      await result.current.refreshSession();
    });

    expect(store.setSession).toHaveBeenCalledWith(null);
    expect(store.session).toBeNull();
  });

  it('sets null fallback when refresh fails without cached session', async () => {
    const store = createMockStore({ session: undefined });

    mockUseSessionStore.mockReturnValue(store);
    mockFetchCurrentSession.mockRejectedValue(new Error('Temporary fetch failure'));

    const { result } = renderHook(() => useSession());
    let refreshed;
    await act(async () => {
      refreshed = await result.current.refreshSession();
    });

    expect(refreshed).toBeNull();
    expect(store.setSession).toHaveBeenCalledWith(null);
    expect(store.session).toBeNull();
  });
});
