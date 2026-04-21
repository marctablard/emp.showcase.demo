import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { CartStoreContext, SessionStoreContext, SiteStoreContext } from '@/providers/StoreProvider';
import { createCartStore } from '@/stores/cart-store';
import { createSessionStore } from '@/stores/session-store-context';
import { createSiteStore } from '@/stores/site-store';
import { useGlobalSyncReady } from './useGlobalSyncReady';

type SessionStoreApi = ReturnType<typeof createSessionStore>;
type SiteStoreApi = ReturnType<typeof createSiteStore>;
type CartStoreApi = ReturnType<typeof createCartStore>;

function buildWrapper(sessionStore: SessionStoreApi, siteStore: SiteStoreApi, cartStore: CartStoreApi) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SessionStoreContext.Provider value={sessionStore}>
        <SiteStoreContext.Provider value={siteStore}>
          <CartStoreContext.Provider value={cartStore}>{children}</CartStoreContext.Provider>
        </SiteStoreContext.Provider>
      </SessionStoreContext.Provider>
    );
  };
}

function createStores() {
  return {
    sessionStore: createSessionStore(),
    siteStore: createSiteStore(),
    cartStore: createCartStore(),
  };
}

describe('useGlobalSyncReady', () => {
  it('returns ready=true when all stores are idle and aligned', () => {
    const { sessionStore, siteStore, cartStore } = createStores();

    act(() => {
      sessionStore.setState({
        session: { siteCode: 'main', currency: 'EUR' } as never,
        loading: false,
      });
      siteStore.setState({ site: { code: 'main' } as never, loading: false });
      cartStore.setState({ currentCart: { site: 'main' } as never, loading: false });
    });

    const { result } = renderHook(() => useGlobalSyncReady(), {
      wrapper: buildWrapper(sessionStore, siteStore, cartStore),
    });

    expect(result.current).toEqual({ ready: true });
  });

  it('reports session-mutation first when mutation lock is held', () => {
    const { sessionStore, siteStore, cartStore } = createStores();

    act(() => {
      sessionStore.getState().tryAcquireMutationLock();
      sessionStore.setState({ loading: true });
      siteStore.setState({ site: { code: 'main' } as never, loading: true });
      cartStore.setState({ loading: true });
    });

    const { result } = renderHook(() => useGlobalSyncReady(), {
      wrapper: buildWrapper(sessionStore, siteStore, cartStore),
    });

    expect(result.current).toEqual({ ready: false, reason: 'session-mutation' });
  });

  it('reports session-loading when the session store is loading', () => {
    const { sessionStore, siteStore, cartStore } = createStores();

    act(() => {
      sessionStore.setState({ loading: true });
      siteStore.setState({ site: { code: 'main' } as never });
      cartStore.setState({});
    });

    const { result } = renderHook(() => useGlobalSyncReady(), {
      wrapper: buildWrapper(sessionStore, siteStore, cartStore),
    });

    expect(result.current).toEqual({ ready: false, reason: 'session-loading' });
  });

  it('reports site-loading when the site store is loading and session is idle', () => {
    const { sessionStore, siteStore, cartStore } = createStores();

    act(() => {
      sessionStore.setState({ session: { siteCode: 'main' } as never, loading: false });
      siteStore.setState({ loading: true });
      cartStore.setState({ loading: false });
    });

    const { result } = renderHook(() => useGlobalSyncReady(), {
      wrapper: buildWrapper(sessionStore, siteStore, cartStore),
    });

    expect(result.current).toEqual({ ready: false, reason: 'site-loading' });
  });

  it('reports site-mismatch when session.siteCode diverges from active site', () => {
    const { sessionStore, siteStore, cartStore } = createStores();

    act(() => {
      sessionStore.setState({ session: { siteCode: 'us' } as never, loading: false });
      siteStore.setState({ site: { code: 'main' } as never, loading: false });
      cartStore.setState({ loading: false });
    });

    const { result } = renderHook(() => useGlobalSyncReady(), {
      wrapper: buildWrapper(sessionStore, siteStore, cartStore),
    });

    expect(result.current).toEqual({ ready: false, reason: 'site-mismatch' });
  });

  it('reports cart-loading when session/site are aligned and cart is fetching', () => {
    const { sessionStore, siteStore, cartStore } = createStores();

    act(() => {
      sessionStore.setState({ session: { siteCode: 'main' } as never, loading: false });
      siteStore.setState({ site: { code: 'main' } as never, loading: false });
      cartStore.setState({ loading: true });
    });

    const { result } = renderHook(() => useGlobalSyncReady(), {
      wrapper: buildWrapper(sessionStore, siteStore, cartStore),
    });

    expect(result.current).toEqual({ ready: false, reason: 'cart-loading' });
  });

  it('reports cart-mismatch when the loaded cart belongs to a different site', () => {
    const { sessionStore, siteStore, cartStore } = createStores();

    act(() => {
      sessionStore.setState({ session: { siteCode: 'main' } as never, loading: false });
      siteStore.setState({ site: { code: 'main' } as never, loading: false });
      cartStore.setState({ currentCart: { site: 'us' } as never, loading: false });
    });

    const { result } = renderHook(() => useGlobalSyncReady(), {
      wrapper: buildWrapper(sessionStore, siteStore, cartStore),
    });

    expect(result.current).toEqual({ ready: false, reason: 'cart-mismatch' });
  });

  it('returns stable ready object between renders when nothing changes', () => {
    const { sessionStore, siteStore, cartStore } = createStores();

    act(() => {
      sessionStore.setState({ session: { siteCode: 'main' } as never, loading: false });
      siteStore.setState({ site: { code: 'main' } as never, loading: false });
      cartStore.setState({ currentCart: { site: 'main' } as never, loading: false });
    });

    const { result, rerender } = renderHook(() => useGlobalSyncReady(), {
      wrapper: buildWrapper(sessionStore, siteStore, cartStore),
    });

    const first = result.current;
    rerender();
    const second = result.current;

    expect(first).toBe(second);
    expect(first).toEqual({ ready: true });
  });

  it('ignores availableSites changes (no re-render trigger for the hook result)', () => {
    const { sessionStore, siteStore, cartStore } = createStores();

    act(() => {
      sessionStore.setState({ session: { siteCode: 'main' } as never, loading: false });
      siteStore.setState({
        site: { code: 'main' } as never,
        availableSites: [{ code: 'main' } as never],
        loading: false,
      });
      cartStore.setState({ currentCart: { site: 'main' } as never, loading: false });
    });

    const { result } = renderHook(() => useGlobalSyncReady(), {
      wrapper: buildWrapper(sessionStore, siteStore, cartStore),
    });

    const first = result.current;

    act(() => {
      siteStore.setState({
        availableSites: [{ code: 'main' } as never, { code: 'us' } as never],
      });
    });

    expect(result.current).toBe(first);
    expect(result.current).toEqual({ ready: true });
  });

  it('throws when used outside of StoreProvider', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => renderHook(() => useGlobalSyncReady())).toThrow(
        /useGlobalSyncReady must be used within StoreProvider/,
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
