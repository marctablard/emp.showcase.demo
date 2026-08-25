import { CUSTOMER_ID } from '@/lib/common/customer-identity';
import { redirectToLoginSuccess } from './auth-login-success-redirect';

const mockGetPathname = jest.fn();
const mockFetchCurrentSession = jest.fn();
const mockLoggerWarn = jest.fn();

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

describe('redirectToLoginSuccess', () => {
  const originalLocation = globalThis.location;
  let location: { href: string };

  beforeEach(() => {
    jest.clearAllMocks();
    location = { href: '' };
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      writable: true,
      value: location,
    });
    mockGetPathname.mockImplementation(
      ({ href, site }: { href: string; site: string }) => `/${site}${href.startsWith('/') ? href : `/${href}`}`,
    );
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it('assigns canonical /?login=success href for the home path', async () => {
    mockFetchCurrentSession.mockResolvedValue({ siteCode: 'main', customerId: '01964559' });

    await redirectToLoginSuccess('/', 'en');

    expect(mockGetPathname).toHaveBeenCalledWith({
      href: '/?login=success',
      locale: 'en',
      site: 'main',
      forcePrefix: true,
    });
    expect(location.href).toBe('/main/?login=success');
    expect(mockFetchCurrentSession).toHaveBeenCalledWith(true);
  });

  it('retries canonical fetch and uses fresh site once available', async () => {
    mockFetchCurrentSession
      .mockRejectedValueOnce(new Error('network-failure'))
      .mockResolvedValueOnce({ siteCode: 'main', customerId: '01964559' });

    await redirectToLoginSuccess('/', 'en');

    expect(mockFetchCurrentSession).toHaveBeenCalledTimes(2);
    expect(mockGetPathname).toHaveBeenCalledWith({
      href: '/?login=success',
      locale: 'en',
      site: 'main',
      forcePrefix: true,
    });
    expect(location.href).toBe('/main/?login=success');
  });

  it('ignores anonymous snapshots and waits for authenticated canonical site', async () => {
    mockFetchCurrentSession
      .mockResolvedValueOnce({ siteCode: 'us-branch', customerId: CUSTOMER_ID.SESSION_ANONYMOUS })
      .mockResolvedValueOnce({ siteCode: 'main', customerId: '01964559' });

    await redirectToLoginSuccess('/', 'en');

    expect(mockFetchCurrentSession).toHaveBeenCalledTimes(2);
    expect(mockGetPathname).toHaveBeenCalledWith({
      href: '/?login=success',
      locale: 'en',
      site: 'main',
      forcePrefix: true,
    });
  });

  it('falls back to default site when canonical session fetch fails repeatedly', async () => {
    mockFetchCurrentSession.mockRejectedValue(new Error('network-failure'));

    await redirectToLoginSuccess('/', 'en');

    expect(mockLoggerWarn).toHaveBeenCalled();
    expect(mockGetPathname).toHaveBeenCalledWith({
      href: '/?login=success',
      locale: 'en',
      site: 'main',
      forcePrefix: true,
    });
    expect(mockFetchCurrentSession).toHaveBeenCalledTimes(3);
  });

  it('merges login=success into an existing query string', async () => {
    mockFetchCurrentSession.mockResolvedValue({ siteCode: 'main', customerId: '01964559' });

    await redirectToLoginSuccess('/account?tab=orders', 'en');

    expect(mockGetPathname).toHaveBeenCalledWith({
      href: '/account?tab=orders&login=success',
      locale: 'en',
      site: 'main',
      forcePrefix: true,
    });
  });
});
