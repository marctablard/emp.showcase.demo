import { act, renderHook } from '@testing-library/react';
import { CUSTOMER_ID } from '@/lib/common/customer-identity';
import useAuthentication from './useAuthentication';

const mockSignIn = jest.fn();
const mockSignOut = jest.fn();
const mockUseSession = jest.fn();
const mockGetPathname = jest.fn();
const mockFetchCurrentSession = jest.fn();
const mockClearCart = jest.fn();
const mockReset = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  useSession: (...args: unknown[]) => mockUseSession(...args),
}));

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
}));

jest.mock('@/i18n/navigation', () => ({
  getPathname: (...args: unknown[]) => mockGetPathname(...args),
}));

jest.mock('@/lib/client/session', () => ({
  fetchCurrentSession: (...args: unknown[]) => mockFetchCurrentSession(...args),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('@/hooks/site/useSite', () => ({
  useSite: () => ({ site: { code: 'us-branch' } }),
}));

jest.mock('@/hooks/checkout/useCheckout', () => ({
  useCheckout: () => ({ reset: mockReset }),
}));

jest.mock('@/providers/StoreProvider', () => ({
  useCartStore: () => ({ clearCart: mockClearCart }),
}));

describe('useAuthentication canonical post-login redirect', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockUseSession.mockReturnValue({ status: 'unauthenticated' });
    mockSignIn.mockResolvedValue({ error: undefined });
    mockGetPathname.mockImplementation(
      ({ href, site }: { href: string; site: string }) => `/${site}${href.startsWith('/') ? href : `/${href}`}`,
    );
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('uses authoritative main site for post-login redirect path', async () => {
    mockFetchCurrentSession.mockResolvedValue({ siteCode: 'main', customerId: '01964559' });

    const { result } = renderHook(() => useAuthentication());

    await act(async () => {
      const success = await result.current.login('john@example.com', 'secret', '/account');
      expect(success).toBe(true);
    });

    expect(mockGetPathname).toHaveBeenCalledWith({
      href: '/account?login=success',
      locale: 'en',
      site: 'main',
      forcePrefix: true,
    });
    expect(mockFetchCurrentSession).toHaveBeenCalledWith(true);
  });

  it('uses authoritative non-default site for post-login redirect path', async () => {
    mockFetchCurrentSession.mockResolvedValue({ siteCode: 'us-branch', customerId: '01964559' });

    const { result } = renderHook(() => useAuthentication());

    await act(async () => {
      await result.current.login('john@example.com', 'secret', '/account');
    });

    expect(mockGetPathname).toHaveBeenCalledWith({
      href: '/account?login=success',
      locale: 'en',
      site: 'us-branch',
      forcePrefix: true,
    });
    expect(mockFetchCurrentSession).toHaveBeenCalledWith(true);
  });

  it('retries canonical fetch and uses fresh site once available', async () => {
    mockFetchCurrentSession
      .mockRejectedValueOnce(new Error('network-failure'))
      .mockResolvedValueOnce({ siteCode: 'main', customerId: '01964559' });

    const { result } = renderHook(() => useAuthentication());

    await act(async () => {
      await result.current.login('john@example.com', 'secret', '/account');
    });

    expect(mockFetchCurrentSession).toHaveBeenCalledTimes(2);
    expect(mockGetPathname).toHaveBeenCalledWith({
      href: '/account?login=success',
      locale: 'en',
      site: 'main',
      forcePrefix: true,
    });
  });

  it('ignores anonymous snapshots and waits for authenticated canonical site', async () => {
    mockFetchCurrentSession
      .mockResolvedValueOnce({ siteCode: 'us-branch', customerId: CUSTOMER_ID.SESSION_ANONYMOUS })
      .mockResolvedValueOnce({ siteCode: 'main', customerId: '01964559' });

    const { result } = renderHook(() => useAuthentication());

    await act(async () => {
      await result.current.login('john@example.com', 'secret', '/account');
    });

    expect(mockFetchCurrentSession).toHaveBeenCalledTimes(2);
    expect(mockGetPathname).toHaveBeenCalledWith({
      href: '/account?login=success',
      locale: 'en',
      site: 'main',
      forcePrefix: true,
    });
  });

  it('falls back to default site when canonical session fetch fails repeatedly', async () => {
    mockFetchCurrentSession.mockRejectedValue(new Error('network-failure'));

    const { result } = renderHook(() => useAuthentication());

    await act(async () => {
      await result.current.login('john@example.com', 'secret', '/account');
    });

    expect(mockLoggerWarn).toHaveBeenCalled();
    expect(mockGetPathname).toHaveBeenCalledWith({
      href: '/account?login=success',
      locale: 'en',
      site: 'main',
      forcePrefix: true,
    });
    expect(mockFetchCurrentSession).toHaveBeenCalledTimes(3);
  });

  it('uses home path for post-login redirect when callbackUrl is /', async () => {
    mockFetchCurrentSession.mockResolvedValue({ siteCode: 'main', customerId: '01964559' });

    const { result } = renderHook(() => useAuthentication());

    await act(async () => {
      const success = await result.current.login('john@example.com', 'secret', '/');
      expect(success).toBe(true);
    });

    expect(mockGetPathname).toHaveBeenCalledWith({
      href: '/?login=success',
      locale: 'en',
      site: 'main',
      forcePrefix: true,
    });
  });
});
