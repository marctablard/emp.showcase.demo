import { act, renderHook } from '@testing-library/react';
import { type SetCurrencyResult, useSession } from './useSession';

const mockFetchCurrentSession = jest.fn();
const mockUpdateSessionLanguage = jest.fn();
const mockUpdateSessionCurrency = jest.fn();
const mockUpdateSessionCountry = jest.fn();
const mockUpdateSessionSite = jest.fn();
const mockUpdateSessionRegion = jest.fn();
const mockUpdateSessionCompany = jest.fn();
const mockUseSessionStore = jest.fn();
const mockUseCartStore = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('@/lib/client/session', () => ({
  fetchCurrentSession: (...args: unknown[]) => mockFetchCurrentSession(...args),
  updateSessionLanguage: (...args: unknown[]) => mockUpdateSessionLanguage(...args),
  updateSessionCurrency: (...args: unknown[]) => mockUpdateSessionCurrency(...args),
  updateSessionCountry: (...args: unknown[]) => mockUpdateSessionCountry(...args),
  updateSessionSite: (...args: unknown[]) => mockUpdateSessionSite(...args),
  updateSessionRegion: (...args: unknown[]) => mockUpdateSessionRegion(...args),
  updateSessionCompany: (...args: unknown[]) => mockUpdateSessionCompany(...args),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  }),
}));

jest.mock('@/providers/StoreProvider', () => ({
  useSessionStore: () => mockUseSessionStore(),
  useCartStore: () => mockUseCartStore(),
}));

const createMockCartStore = () => ({
  setCurrentCart: jest.fn(),
  validateLegalEntity: jest.fn().mockResolvedValue(undefined),
});

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
    mockUseCartStore.mockReturnValue(createMockCartStore());
    mockFetchCurrentSession.mockResolvedValue({ id: 'session-1', siteCode: 'main' });
    mockUpdateSessionLanguage.mockResolvedValue(true);
    mockUpdateSessionCurrency.mockResolvedValue({ success: true });
    mockUpdateSessionCountry.mockResolvedValue(true);
    mockUpdateSessionSite.mockResolvedValue(true);
    mockUpdateSessionRegion.mockResolvedValue(true);
    mockUpdateSessionCompany.mockResolvedValue(true);
  });

  it('blocks concurrent mutations across hook instances and allows next mutation after release', async () => {
    const currencyDeferred = createDeferred<{ success: boolean }>();
    mockUpdateSessionCurrency.mockReturnValueOnce(currencyDeferred.promise);

    const hookA = renderHook(() => useSession());
    const hookB = renderHook(() => useSession());

    let firstMutationPromise: Promise<SetCurrencyResult>;
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
      currencyDeferred.resolve({ success: true });
      const currencyResult = await firstMutationPromise!;
      expect(currencyResult.success).toBe(true);
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
    mockUseCartStore.mockReturnValue(createMockCartStore());
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
    mockUseCartStore.mockReturnValue(createMockCartStore());
  });

  it('keeps last known session when mutation refetch returns null', async () => {
    const store = createMockStore({
      session: { id: 'session-existing', currency: 'USD', siteCode: 'main' },
    });

    mockUseSessionStore.mockReturnValue(store);
    mockUpdateSessionCurrency.mockResolvedValue({ success: true });
    mockFetchCurrentSession.mockRejectedValue(new Error('Temporary fetch failure'));

    const { result } = renderHook(() => useSession());
    let mutationResult: SetCurrencyResult;

    await act(async () => {
      mutationResult = await result.current.setCurrency('EUR');
    });

    expect(mutationResult!.success).toBe(false);
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

describe('useSession setCurrency cart reconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchCurrentSession.mockResolvedValue({ id: 'session-1', currency: 'USD', siteCode: 'us-branch' });
  });

  it('pushes the server-reconciled cart into the cart store after a successful currency change', async () => {
    const store = createMockStore({
      session: { id: 's1', currency: 'CHF', siteCode: 'us-branch' },
    });
    const cartStore = createMockCartStore();
    const reconciledCart = {
      id: 'cart-1',
      site: 'us-branch',
      currency: 'USD',
      totalPrice: { amount: 105.7, currency: 'USD' },
    };

    mockUseSessionStore.mockReturnValue(store);
    mockUseCartStore.mockReturnValue(cartStore);
    mockUpdateSessionCurrency.mockResolvedValue({ success: true, cart: reconciledCart });

    const { result } = renderHook(() => useSession());
    let success: SetCurrencyResult;
    await act(async () => {
      success = await result.current.setCurrency('USD');
    });

    expect(success!.success).toBe(true);
    expect(cartStore.setCurrentCart).toHaveBeenCalledTimes(1);
    expect(cartStore.setCurrentCart).toHaveBeenCalledWith(reconciledCart);
  });

  it('clears the cart store when the response payload carries `cart: null`', async () => {
    const store = createMockStore({
      session: { id: 's1', currency: 'CHF', siteCode: 'us-branch' },
    });
    const cartStore = createMockCartStore();

    mockUseSessionStore.mockReturnValue(store);
    mockUseCartStore.mockReturnValue(cartStore);
    mockUpdateSessionCurrency.mockResolvedValue({ success: true, cart: null });

    const { result } = renderHook(() => useSession());
    await act(async () => {
      await result.current.setCurrency('USD');
    });

    expect(cartStore.setCurrentCart).toHaveBeenCalledWith(null);
  });

  it('does not touch the cart store when the response omits `cart`', async () => {
    const store = createMockStore({
      session: { id: 's1', currency: 'CHF', siteCode: 'us-branch' },
    });
    const cartStore = createMockCartStore();

    mockUseSessionStore.mockReturnValue(store);
    mockUseCartStore.mockReturnValue(cartStore);
    mockUpdateSessionCurrency.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useSession());
    await act(async () => {
      await result.current.setCurrency('USD');
    });

    expect(cartStore.setCurrentCart).not.toHaveBeenCalled();
  });

  it('does not touch the cart store when the mutation fails', async () => {
    const store = createMockStore({
      session: { id: 's1', currency: 'CHF', siteCode: 'us-branch' },
    });
    const cartStore = createMockCartStore();

    mockUseSessionStore.mockReturnValue(store);
    mockUseCartStore.mockReturnValue(cartStore);
    mockUpdateSessionCurrency.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useSession());
    let success: SetCurrencyResult;
    await act(async () => {
      success = await result.current.setCurrency('USD');
    });

    expect(success!.success).toBe(false);
    expect(cartStore.setCurrentCart).not.toHaveBeenCalled();
  });

  it('returns cartCurrencyBlocked when the currency API rejects cart repricing', async () => {
    const store = createMockStore({
      session: { id: 's1', currency: 'CHF', siteCode: 'us-branch' },
    });
    const cartStore = createMockCartStore();

    mockUseSessionStore.mockReturnValue(store);
    mockUseCartStore.mockReturnValue(cartStore);
    mockUpdateSessionCurrency.mockResolvedValue({ success: false, cartCurrencyBlocked: true });

    const { result } = renderHook(() => useSession());
    let out: SetCurrencyResult;
    await act(async () => {
      out = await result.current.setCurrency('USD');
    });

    expect(out!.success).toBe(false);
    expect(out!.cartCurrencyBlocked).toBe(true);
    expect(cartStore.setCurrentCart).not.toHaveBeenCalled();
  });
});

describe('useSession setCompany cart reconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateSessionCompany.mockResolvedValue(true);
  });

  it('runs validateLegalEntity with the session-refetched legalEntityId under the mutation lock', async () => {
    const store = createMockStore({
      session: { id: 's1', siteCode: 'main', currency: 'USD', legalEntityId: 'old-entity' },
    });
    const cartStore = createMockCartStore();

    mockUseSessionStore.mockReturnValue(store);
    mockUseCartStore.mockReturnValue(cartStore);
    // Server-returned session carries padded whitespace to exercise the trim normalization path.
    mockFetchCurrentSession.mockResolvedValue({
      id: 's1',
      siteCode: 'main',
      currency: 'USD',
      legalEntityId: '  6995aedcb216a9070488dc71  ',
    });

    const { result } = renderHook(() => useSession());
    let success: boolean;
    await act(async () => {
      success = await result.current.setCompany('6995aedcb216a9070488dc71');
    });

    expect(success!).toBe(true);
    expect(mockUpdateSessionCompany).toHaveBeenCalledWith('6995aedcb216a9070488dc71');
    expect(cartStore.validateLegalEntity).toHaveBeenCalledTimes(1);
    expect(cartStore.validateLegalEntity).toHaveBeenCalledWith('6995aedcb216a9070488dc71');

    // afterCommit must run after setSession and before releaseMutationLock so that the cart
    // write stays within the orchestrator's mutation-lock window (mirrors performSiteSwitch).
    const setSessionOrder = (store.setSession as jest.Mock).mock.invocationCallOrder[0];
    const validateOrder = cartStore.validateLegalEntity.mock.invocationCallOrder[0];
    const releaseOrder = (store.releaseMutationLock as jest.Mock).mock.invocationCallOrder[0];
    expect(setSessionOrder).toBeLessThan(validateOrder);
    expect(validateOrder).toBeLessThan(releaseOrder);
  });

  it('returns false and skips validateLegalEntity when the mutation lock is already held', async () => {
    // Pre-hold the lock so tryAcquireMutationLock returns false.
    const deferred = createDeferred<{ success: boolean }>();
    mockUpdateSessionCurrency.mockReturnValueOnce(deferred.promise);

    const store = createMockStore({
      session: { id: 's1', siteCode: 'main', currency: 'USD' },
    });
    const cartStore = createMockCartStore();
    mockUseSessionStore.mockReturnValue(store);
    mockUseCartStore.mockReturnValue(cartStore);

    const { result } = renderHook(() => useSession());

    let first: Promise<SetCurrencyResult> | undefined;
    act(() => {
      first = result.current.setCurrency('USD');
    });

    let blocked: boolean;
    await act(async () => {
      blocked = await result.current.setCompany('new-entity');
    });

    expect(blocked!).toBe(false);
    expect(mockUpdateSessionCompany).not.toHaveBeenCalled();
    expect(cartStore.validateLegalEntity).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve({ success: true });
      await first!;
    });
  });

  it('does not refetch the cart when updateSessionCompany fails', async () => {
    mockUpdateSessionCompany.mockResolvedValueOnce(false);
    const store = createMockStore({
      session: { id: 's1', siteCode: 'main', currency: 'USD' },
    });
    const cartStore = createMockCartStore();
    mockUseSessionStore.mockReturnValue(store);
    mockUseCartStore.mockReturnValue(cartStore);

    const { result } = renderHook(() => useSession());
    let success: boolean;
    await act(async () => {
      success = await result.current.setCompany('new-entity');
    });

    expect(success!).toBe(false);
    expect(mockFetchCurrentSession).not.toHaveBeenCalled();
    expect(cartStore.validateLegalEntity).not.toHaveBeenCalled();
    expect(store.releaseMutationLock).toHaveBeenCalledTimes(1);
  });

  it('swallows validateLegalEntity errors so the session mutation still succeeds and releases the lock', async () => {
    const store = createMockStore({
      session: { id: 's1', siteCode: 'main', currency: 'USD', legalEntityId: 'old' },
    });
    const cartStore = createMockCartStore();
    cartStore.validateLegalEntity.mockRejectedValueOnce(new Error('boom'));
    mockUseSessionStore.mockReturnValue(store);
    mockUseCartStore.mockReturnValue(cartStore);
    mockFetchCurrentSession.mockResolvedValue({
      id: 's1',
      siteCode: 'main',
      currency: 'USD',
      legalEntityId: 'new',
    });

    const { result } = renderHook(() => useSession());
    let success: boolean;
    await act(async () => {
      success = await result.current.setCompany('new');
    });

    expect(success!).toBe(true);
    expect(cartStore.validateLegalEntity).toHaveBeenCalledWith('new');
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
    expect(mockLoggerError.mock.calls[0][1]).toBe('Session mutation afterCommit failed');
    expect(store.releaseMutationLock).toHaveBeenCalledTimes(1);
  });

  it('normalizes an empty/whitespace legalEntityId to undefined when passing to validateLegalEntity', async () => {
    const store = createMockStore({
      session: { id: 's1', siteCode: 'main', currency: 'USD' },
    });
    const cartStore = createMockCartStore();
    mockUseSessionStore.mockReturnValue(store);
    mockUseCartStore.mockReturnValue(cartStore);
    mockFetchCurrentSession.mockResolvedValue({
      id: 's1',
      siteCode: 'main',
      currency: 'USD',
      legalEntityId: '   ',
    });

    const { result } = renderHook(() => useSession());
    await act(async () => {
      await result.current.setCompany('whatever');
    });

    expect(cartStore.validateLegalEntity).toHaveBeenCalledTimes(1);
    expect(cartStore.validateLegalEntity).toHaveBeenCalledWith(undefined);
  });
});
