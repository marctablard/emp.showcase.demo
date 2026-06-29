import { CUSTOMER_ID } from '@/lib/common/customer-identity';
import { LocalAuthSyncBootstrapService } from './LocalAuthSyncBootstrapService';

describe('LocalAuthSyncBootstrapService', () => {
  const originalSecret = process.env.NEXT_SSO_PASSWORD_SECRET;

  const createLogger = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    trace: jest.fn(),
  });

  const createAuthService = () => ({
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
    getCurrentSession: jest.fn(),
  });

  const createCustomerService = () => ({
    getCustomer: jest.fn(),
    updateCustomerProfile: jest.fn(),
  });

  beforeEach(() => {
    process.env.NEXT_SSO_PASSWORD_SECRET = 'test-secret';
  });

  afterEach(() => {
    process.env.NEXT_SSO_PASSWORD_SECRET = originalSecret;
  });

  it('returns authenticated bootstrap metadata for an existing fixture customer', async () => {
    const authService = createAuthService();
    const customerService = createCustomerService();
    const logger = createLogger();

    authService.login.mockResolvedValue({ customerId: 'customer-1', siteCode: 'us-branch', currency: 'USD' });
    authService.getCurrentSession.mockResolvedValue({
      customerId: 'customer-1',
      siteCode: 'us-branch',
      currency: 'USD',
    });
    customerService.getCustomer.mockResolvedValue({ firstName: 'Local', lastName: 'Auth Sync' });

    const service = new LocalAuthSyncBootstrapService(authService as never, customerService as never, logger as never);

    await expect(service.bootstrap()).resolves.toEqual({ authenticated: true, siteCode: 'us-branch', currency: 'USD' });
    expect(authService.logout).toHaveBeenCalled();
    expect(authService.register).not.toHaveBeenCalled();
    expect(customerService.updateCustomerProfile).not.toHaveBeenCalled();
  });

  it('lazily provisions the fixture when login fails and repairs mismatched profile fields', async () => {
    const authService = createAuthService();
    const customerService = createCustomerService();
    const logger = createLogger();

    authService.login.mockRejectedValue(new Error('login failed'));
    authService.register.mockResolvedValue({ customerId: 'customer-2', siteCode: 'main', currency: 'EUR' });
    authService.getCurrentSession.mockResolvedValue({ customerId: 'customer-2', siteCode: 'main', currency: 'EUR' });
    customerService.getCustomer.mockResolvedValue({ firstName: 'Wrong', lastName: 'Name' });
    customerService.updateCustomerProfile.mockResolvedValue({ firstName: 'Local', lastName: 'Auth Sync' });

    const service = new LocalAuthSyncBootstrapService(authService as never, customerService as never, logger as never);

    await expect(service.bootstrap()).resolves.toEqual({ authenticated: true, siteCode: 'main', currency: 'EUR' });
    expect(authService.register).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: expect.objectContaining({ username: 'local.auth.sync@emporix-showcase.invalid' }),
      }),
    );
    expect(customerService.updateCustomerProfile).toHaveBeenCalledWith({
      firstName: 'Local',
      lastName: 'Auth Sync',
    });
  });

  it('fails when registration is needed but NEXT_SSO_PASSWORD_SECRET is missing', async () => {
    const authService = createAuthService();
    const customerService = createCustomerService();
    const logger = createLogger();

    delete process.env.NEXT_SSO_PASSWORD_SECRET;
    authService.login.mockRejectedValue(new Error('login failed'));

    const service = new LocalAuthSyncBootstrapService(authService as never, customerService as never, logger as never);

    await expect(service.bootstrap()).rejects.toThrow(
      'NEXT_SSO_PASSWORD_SECRET environment variable is not configured',
    );
    expect(authService.register).not.toHaveBeenCalled();
  });

  it('fails when the resulting session stays anonymous', async () => {
    const authService = createAuthService();
    const customerService = createCustomerService();
    const logger = createLogger();

    authService.login.mockResolvedValue({
      customerId: CUSTOMER_ID.SESSION_ANONYMOUS,
      siteCode: 'main',
      currency: 'EUR',
    });
    authService.getCurrentSession.mockResolvedValue({
      customerId: CUSTOMER_ID.SESSION_ANONYMOUS,
      siteCode: 'main',
      currency: 'EUR',
    });
    customerService.getCustomer.mockResolvedValue({ firstName: 'Local', lastName: 'Auth Sync' });

    const service = new LocalAuthSyncBootstrapService(authService as never, customerService as never, logger as never);

    await expect(service.bootstrap()).rejects.toThrow('Auth bootstrap did not create an authenticated shopper session');
  });
});
