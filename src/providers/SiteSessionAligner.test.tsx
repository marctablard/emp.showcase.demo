import type { ReactNode } from 'react';
import { act, render } from '@testing-library/react';
import { performSiteSwitch } from '@/lib/client/site-switch';
import { SiteContext } from '@/providers/SiteProvider';
import { SiteSessionAligner } from '@/providers/SiteSessionAligner';
import { CartStoreContext, SessionStoreContext, SiteStoreContext } from '@/providers/StoreProvider';
import { createCartStore } from '@/stores/cart-store';
import { createSessionStore } from '@/stores/session-store-context';
import { createSiteStore } from '@/stores/site-store';

jest.mock('@/lib/client/site-switch', () => ({
  performSiteSwitch: jest.fn().mockResolvedValue({ success: true }),
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

const mockedPerformSiteSwitch = performSiteSwitch as jest.Mock;

function buildWrapper(
  urlSiteCode: string,
  sessionStore: ReturnType<typeof createSessionStore>,
  siteStore: ReturnType<typeof createSiteStore>,
  cartStore: ReturnType<typeof createCartStore>,
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SiteContext.Provider value={urlSiteCode}>
        <SessionStoreContext.Provider value={sessionStore}>
          <SiteStoreContext.Provider value={siteStore}>
            <CartStoreContext.Provider value={cartStore}>{children}</CartStoreContext.Provider>
          </SiteStoreContext.Provider>
        </SessionStoreContext.Provider>
      </SiteContext.Provider>
    );
  };
}

describe('SiteSessionAligner', () => {
  beforeEach(() => {
    mockedPerformSiteSwitch.mockClear();
    mockedPerformSiteSwitch.mockResolvedValue({ success: true });
  });

  it('does not run performSiteSwitch when URL and session sites already match', () => {
    const sessionStore = createSessionStore({
      session: { siteCode: 'main', currency: 'EUR' } as never,
      loading: false,
    });
    const siteStore = createSiteStore();
    const cartStore = createCartStore();

    const Wrapper = buildWrapper('main', sessionStore, siteStore, cartStore);
    render(
      <Wrapper>
        <SiteSessionAligner />
      </Wrapper>,
    );

    expect(mockedPerformSiteSwitch).not.toHaveBeenCalled();
  });

  it('runs performSiteSwitch when session is already loaded with a mismatched site on mount', () => {
    const sessionStore = createSessionStore({
      session: { siteCode: 'us-branch', currency: 'USD' } as never,
      loading: false,
    });
    const siteStore = createSiteStore();
    const cartStore = createCartStore();

    const Wrapper = buildWrapper('main', sessionStore, siteStore, cartStore);
    render(
      <Wrapper>
        <SiteSessionAligner />
      </Wrapper>,
    );

    expect(mockedPerformSiteSwitch).toHaveBeenCalledTimes(1);
    expect(mockedPerformSiteSwitch).toHaveBeenCalledWith(
      'main',
      expect.objectContaining({ sessionStore, siteStore, cartStore }),
      expect.objectContaining({ source: 'deep-link' }),
    );
  });

  it('reacts to a late-arriving session (SSR-seeded null, client-side fetch resolves mismatched site)', () => {
    // Regression: on cold-start the SSR layer cannot fetch Emporix's anonymous session
    // (no session-id cookie yet), so the session store seeds `null`. The client-side
    // /api/session call then resolves a session whose siteCode differs from the URL.
    // A plain useEffect with stable-ref deps would bail out once and never re-run.
    const sessionStore = createSessionStore({ session: null, loading: false });
    const siteStore = createSiteStore();
    const cartStore = createCartStore();

    const Wrapper = buildWrapper('main', sessionStore, siteStore, cartStore);
    render(
      <Wrapper>
        <SiteSessionAligner />
      </Wrapper>,
    );

    expect(mockedPerformSiteSwitch).not.toHaveBeenCalled();

    act(() => {
      sessionStore.setState({
        session: { siteCode: 'us-branch', currency: 'USD' } as never,
        loading: false,
      });
    });

    expect(mockedPerformSiteSwitch).toHaveBeenCalledTimes(1);
    expect(mockedPerformSiteSwitch).toHaveBeenCalledWith(
      'main',
      expect.objectContaining({ sessionStore, siteStore, cartStore }),
      expect.objectContaining({ source: 'deep-link' }),
    );
  });

  it('does not double-fire while a pipeline is already in flight', async () => {
    let resolveSwitch: (value: { success: true }) => void = () => undefined;
    mockedPerformSiteSwitch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSwitch = resolve;
        }),
    );

    const sessionStore = createSessionStore({ session: null, loading: false });
    const siteStore = createSiteStore();
    const cartStore = createCartStore();

    const Wrapper = buildWrapper('main', sessionStore, siteStore, cartStore);
    render(
      <Wrapper>
        <SiteSessionAligner />
      </Wrapper>,
    );

    act(() => {
      sessionStore.setState({
        session: { siteCode: 'us-branch', currency: 'USD' } as never,
        loading: false,
      });
    });
    expect(mockedPerformSiteSwitch).toHaveBeenCalledTimes(1);

    // Store emits more updates while the pipeline is still running — must be ignored.
    act(() => {
      sessionStore.setState({
        session: { siteCode: 'brand1', currency: 'CHF' } as never,
        loading: false,
      });
    });
    expect(mockedPerformSiteSwitch).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSwitch({ success: true });
      await Promise.resolve();
    });
  });

  it('does not fire while the session is still loading', () => {
    const sessionStore = createSessionStore({
      session: { siteCode: 'us-branch', currency: 'USD' } as never,
      loading: true,
    });
    const siteStore = createSiteStore();
    const cartStore = createCartStore();

    const Wrapper = buildWrapper('main', sessionStore, siteStore, cartStore);
    render(
      <Wrapper>
        <SiteSessionAligner />
      </Wrapper>,
    );

    expect(mockedPerformSiteSwitch).not.toHaveBeenCalled();

    act(() => {
      sessionStore.setState({ loading: false });
    });

    expect(mockedPerformSiteSwitch).toHaveBeenCalledTimes(1);
  });

  it('does not fire while a session mutation lock is held', () => {
    const sessionStore = createSessionStore({
      session: { siteCode: 'us-branch', currency: 'USD' } as never,
      loading: false,
    });
    sessionStore.getState().tryAcquireMutationLock();
    const siteStore = createSiteStore();
    const cartStore = createCartStore();

    const Wrapper = buildWrapper('main', sessionStore, siteStore, cartStore);
    render(
      <Wrapper>
        <SiteSessionAligner />
      </Wrapper>,
    );

    expect(mockedPerformSiteSwitch).not.toHaveBeenCalled();
  });
});
