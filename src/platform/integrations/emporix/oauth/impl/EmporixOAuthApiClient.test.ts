import EmporixOAuthApiClient from './EmporixOAuthApiClient';

describe('EmporixOAuthApiClient', () => {
  let api: EmporixOAuthApiClient;

  beforeEach(() => {
    api = new EmporixOAuthApiClient();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockJsonResponse = (data: unknown, ok = true, statusText = 'OK') => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok,
      statusText,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    });
  };

  describe('getPublicToken', () => {
    it('should call correct URL and return token response', async () => {
      const mockResponse = {
        access_token: 'anon-token',
        token_type: 'bearer',
        expires_in: 3600,
        scope: 'read',
        session_id: 'session-1',
      };
      mockJsonResponse(mockResponse);

      const result = await api.getPublicToken('test-tenant', 'client-123');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/customerlogin/auth/anonymous/login?tenant=test-tenant&client_id=client-123'),
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw on non-OK response', async () => {
      mockJsonResponse('Unauthorized', false, 'Unauthorized');

      await expect(api.getPublicToken('t', 'c')).rejects.toThrow('Failed to get public token');
    });
  });

  describe('getAnonymousToken', () => {
    it('should call correct URL without session params', async () => {
      const mockResponse = {
        access_token: 'anon-token',
        token_type: 'bearer',
        expires_in: 3600,
        scope: 'read',
        session_id: 'session-1',
      };
      mockJsonResponse(mockResponse);

      await api.getAnonymousToken('tenant', 'client-id');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/customerlogin/auth/anonymous/login?tenant=tenant&client_id=client-id'),
        expect.anything(),
      );
    });

    it('should append session params as query parameters', async () => {
      mockJsonResponse({
        access_token: 'token',
        token_type: 'bearer',
        expires_in: 3600,
        scope: 'read',
        session_id: 'sid',
      });

      await api.getAnonymousToken('tenant', 'cid', {
        siteCode: 'PL',
        currency: 'EUR',
        language: 'en',
        targetLocation: 'DE',
      });

      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('siteCode=PL');
      expect(calledUrl).toContain('currency=EUR');
      expect(calledUrl).toContain('language=en');
      expect(calledUrl).toContain('targetLocation=DE');
    });

    it('should encode special characters in session params', async () => {
      mockJsonResponse({
        access_token: 'token',
        token_type: 'bearer',
        expires_in: 3600,
        scope: 'read',
        session_id: 'sid',
      });

      await api.getAnonymousToken('tenant', 'cid', {
        siteCode: 'site with spaces',
      });

      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('siteCode=site+with+spaces');
    });
  });

  describe('refreshAnonymousToken', () => {
    it('should call correct URL', async () => {
      mockJsonResponse({
        access_token: 'refreshed',
        token_type: 'bearer',
        expires_in: 3600,
        scope: 'read',
        session_id: 'sid',
      });

      await api.refreshAnonymousToken('tenant', 'refresh-tok', 'cid');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          '/customerlogin/auth/anonymous/refresh?tenant=tenant&refresh_token=refresh-tok&client_id=cid',
        ),
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });

  describe('getCustomerToken', () => {
    it('should POST with auth header and credentials', async () => {
      const mockResponse = {
        access_token: 'customer-token',
        token_type: 'bearer',
        expires_in: 3600,
        scope: 'read',
        session_id: 'sid',
        saas_token: 'saas-jwt',
      };
      mockJsonResponse(mockResponse);

      const result = await api.getCustomerToken('tenant', 'anon-token', 'user@test.com', 'pass123');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/customer/tenant/login'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer anon-token',
          }),
          body: JSON.stringify({ email: 'user@test.com', password: 'pass123' }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('refreshCustomerToken', () => {
    it('should call correct URL with auth header', async () => {
      mockJsonResponse({
        access_token: 'refreshed',
        token_type: 'bearer',
        expires_in: 3600,
        scope: 'read',
        session_id: 'sid',
        saas_token: 'saas',
      });

      await api.refreshCustomerToken('tenant', 'access-tok', 'refresh-tok');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/customer/tenant/refreshauthtoken?refreshToken=refresh-tok'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer access-tok',
          }),
        }),
      );
    });

    it('should include legalEntityId when provided', async () => {
      mockJsonResponse({
        access_token: 'refreshed',
        token_type: 'bearer',
        expires_in: 3600,
        scope: 'read',
        session_id: 'sid',
        saas_token: 'saas',
      });

      await api.refreshCustomerToken('tenant', 'access', 'refresh', 'legal-entity-1');

      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('legalEntityId=legal-entity-1');
    });
  });

  describe('getServiceAccessToken', () => {
    it('should throw with browser context error', async () => {
      await expect(api.getServiceAccessToken('t', 'c', 's')).rejects.toThrow('not available in the browser context');
    });
  });
});
