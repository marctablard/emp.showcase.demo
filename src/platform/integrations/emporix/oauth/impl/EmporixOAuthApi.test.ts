import { Container } from 'inversify';
import { EmporixTokenManager } from '../../common/EmporixTokenManager';
import { EmporixTestTokenManager } from '../../common/impl/EmporixTokenManager.test';
import { EmporixConfig } from '../../config';
import { EmporixOAuthApi as IEmporixOAuthApi } from '../EmporixOAuthApi';
import EmporixOAuthApi from './EmporixOAuthApi';

// Create a test config implementation
class TestEmporixConfig implements EmporixConfig {
  baseUrl: string = process.env.NEXT_EMPORIX_TEST_BASE_URL || 'https://api.emporix.io';
  tenant: string = process.env.NEXT_EMPORIX_TEST_TENANT || 'showcasetest';
  clientId: string = process.env.NEXT_EMPORIX_TEST_CLIENT_ID || '';
  clientSecret: string = process.env.NEXT_EMPORIX_TEST_CLIENT_SECRET || '';
}

describe('EmporixOAuthApi', () => {
  let container: Container;
  let oauthApi: EmporixOAuthApi;
  let config: TestEmporixConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up the container with our test config
    container = new Container();
    container.bind<EmporixConfig>('EmporixConfig').to(TestEmporixConfig);
    container.bind<IEmporixOAuthApi>('EmporixOAuthApi').to(EmporixOAuthApi);
    container.bind<EmporixTokenManager>('EmporixTokenManager').to(EmporixTestTokenManager).inSingletonScope();

    // Get instances from the container
    oauthApi = container.get<EmporixOAuthApi>('EmporixOAuthApi');
    config = container.get<EmporixConfig>('EmporixConfig') as TestEmporixConfig;
  });

  describe('getAnonymousToken', () => {
    it('should fetch an anonymous token', async () => {
      // Execute
      const result = await oauthApi.getAnonymousToken(config.tenant, config.clientId);

      // Verify the response structure
      expect(result).toBeDefined();
      expect(result.access_token).toBeDefined();
      expect(result.token_type).toBe('Bearer');
      expect(typeof result.expires_in).toBe('number');
      expect(result.scope).toBeDefined();
      expect(result.session_id).toBeDefined();
    });

    it('should handle errors when fetching an anonymous token', async () => {
      // Execute with an invalid client ID
      await expect(oauthApi.getAnonymousToken(config.tenant, 'invalid-client-id')).rejects.toThrow();
    });
  });

  describe('refreshAnonymousToken', () => {
    it('should refresh an anonymous token', async () => {
      // First get an anonymous token
      const anonymousTokenResponse = await oauthApi.getAnonymousToken(config.tenant, config.clientId);
      const refreshToken = anonymousTokenResponse.refresh_token;

      // Skip if no refresh token is available
      if (!refreshToken) {
        console.log('Skipping test: No refresh token available');
        return;
      }

      // Execute with the real refresh token
      const result = await oauthApi.refreshAnonymousToken(config.tenant, refreshToken, config.clientId);

      // Verify the response structure
      expect(result).toBeDefined();
      expect(result.access_token).toBeDefined();
      expect(result.token_type).toBe('Bearer');
      expect(typeof result.expires_in).toBe('number');
      expect(result.scope).toBeDefined();
      expect(result.session_id).toBeDefined();
    });
  });

  describe('getCustomerToken', () => {
    it('should handle customer token request correctly', async () => {
      // Skip test if no client ID is available
      if (!config.clientId) {
        console.log('Skipping test: No client ID available');
        return;
      }

      // First get an anonymous token
      const anonymousTokenResponse = await oauthApi.getAnonymousToken(config.tenant, config.clientId);
      const anonymousToken = anonymousTokenResponse.access_token;

      // We can't test with real credentials, but we can verify the call throws the expected error
      // with invalid credentials
      await expect(
        oauthApi.getCustomerToken(config.tenant, anonymousToken, 'test@example.com', 'invalid-password'),
      ).rejects.toThrow();
    });
  });

  describe('refreshCustomerToken', () => {
    it('should handle customer token refresh request correctly', async () => {
      // We can't test with real refresh tokens, but we can verify the call throws the expected error
      // with an invalid refresh token
      await expect(
        oauthApi.refreshCustomerToken(config.tenant, 'invalid-access-token', 'invalid-refresh-token'),
      ).rejects.toThrow();
    });
  });

  describe('getServiceAccessToken', () => {
    it('should fetch a service access token', async () => {
      // Skip test if no client credentials are available
      if (!config.clientId || !config.clientSecret) {
        console.log('Skipping test: No client credentials available');
        return;
      }

      // Execute with real credentials
      const result = await oauthApi.getServiceAccessToken(config.tenant, config.clientId, config.clientSecret);

      // Verify the response structure
      expect(result).toBeDefined();
      expect(result.access_token).toBeDefined();
      expect(result.token_type).toBe('Bearer');
      expect(typeof result.expires_in).toBe('number');
      expect(result.scope).toBeDefined();
    });

    it('should handle errors with invalid credentials', async () => {
      await expect(
        oauthApi.getServiceAccessToken(config.tenant, 'invalid-client-id', 'invalid-client-secret'),
      ).rejects.toThrow();
    });
  });
});
