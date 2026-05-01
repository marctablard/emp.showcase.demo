import { Container } from 'inversify';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { EmporixTokenManager as TokenManager } from '../../common/EmporixTokenManager';
import EmporixApiInvoker from '../../common/impl/EmporixApiInvoker';
import { EmporixTestTokenManager } from '../../common/impl/EmporixTokenManager.test';
import { EmporixConfig } from '../../config';
import EmporixCustomerApi from '../../customer/impl/EmporixCustomerApi';
import { EmporixContextAttribute, EmporixSessionContext } from '../../model/session-context';
import EmporixOAuthApi from '../../oauth/impl/EmporixOAuthApi';
import EmporixSessionContextApi from './EmporixSessionContextApi';

// Create a test config implementation
class TestEmporixConfig implements EmporixConfig {
  baseUrl: string = process.env.NEXT_EMPORIX_TEST_BASE_URL || 'https://api.emporix.io';
  tenant: string = process.env.NEXT_EMPORIX_TEST_TENANT || 'showcasetest';
  clientId: string = process.env.NEXT_EMPORIX_TEST_CLIENT_ID || '';
  clientSecret: string = process.env.NEXT_EMPORIX_TEST_CLIENT_SECRET || '';
  serverClientId: string = process.env.NEXT_EMPORIX_TEST_SERVER_CLIENT_ID || '';
  serverClientSecret: string = process.env.NEXT_EMPORIX_TEST_SERVER_CLIENT_SECRET || '';
}

// Generate a timestamp to make test data unique
const timestamp = Date.now();

// Function to create a test session context
const createTestSessionContext = (sessionId: string): EmporixSessionContext => ({
  sessionId,
  siteCode: 'test',
  currency: 'EUR',
  targetLocation: 'DE',
});

// Function to create a test context attribute
const createTestAttribute = (key: string): EmporixContextAttribute => ({
  key,
  value: `test-value-${timestamp}`,
});

describe('EmporixSessionContextApi', () => {
  let container: Container;
  let sessionContextApi: EmporixSessionContextApi;
  let apiInvoker: EmporixApiInvoker;
  let tokenManager: TokenManager;
  let customerApi: EmporixCustomerApi;
  let config: EmporixConfig;

  // Generate a unique session ID for testing
  const testSessionId = `test-session-${Date.now()}`;

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the globalThis-based session context cache between tests
    delete (globalThis as Record<string, unknown>)['__emporix_session_ctx_cache'];

    // Set up the container with our test config
    container = new Container();
    container.bind<EmporixConfig>('EmporixConfig').to(TestEmporixConfig);
    container.bind<EmporixOAuthApi>('EmporixOAuthApi').to(EmporixOAuthApi);
    container.bind<TokenManager>('EmporixTokenManager').to(EmporixTestTokenManager).inSingletonScope();
    container.bind<EmporixCustomerApi>('EmporixCustomerApi').to(EmporixCustomerApi);
    container
      .bind<EmporixApiInvoker>('EmporixApiInvoker')
      .toDynamicValue(
        (ctx) =>
          new EmporixApiInvoker(ctx.get<EmporixConfig>('EmporixConfig'), ctx.get<TokenManager>('EmporixTokenManager')),
      )
      .inSingletonScope();
    container.bind<LoggerService>('LoggerService').toConstantValue({
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    } as unknown as LoggerService);
    container.bind<EmporixSessionContextApi>('EmporixSessionContextApi').to(EmporixSessionContextApi);
    // enable for debug output as curl
    // container.bind<boolean>('debugCurl').toConstantValue(true);

    // Get instances from the container
    apiInvoker = container.get<EmporixApiInvoker>('EmporixApiInvoker');
    sessionContextApi = container.get<EmporixSessionContextApi>('EmporixSessionContextApi');
    customerApi = container.get<EmporixCustomerApi>('EmporixCustomerApi');
    tokenManager = container.get<TokenManager>('EmporixTokenManager');
    config = container.get<EmporixConfig>('EmporixConfig');
    // Spy on the authenticatedFetch method to verify calls
    jest.spyOn(apiInvoker, 'authenticatedFetch');
  });
  describe('getSessionContext', () => {
    it('should fetch a session context by ID', async () => {
      const tokenManager = container.get<TokenManager>('EmporixTokenManager');
      const { accessToken: _token, sessionId } = await tokenManager.getAnonymousToken(config.tenant, config.clientId);

      // Now fetch it
      const result = await sessionContextApi.getSessionContext(sessionId);

      expect(apiInvoker.authenticatedFetch).toHaveBeenCalledWith(
        `/session-context/${config.tenant}/context/${sessionId}`,
        expect.objectContaining({ method: 'GET' }),
        'service',
        undefined,
        expect.anything(),
      );

      expect(result).toBeDefined();
      expect(result?.sessionId).toEqual(sessionId);
    });

    it('should return undefined when session context is not found', async () => {
      const nonExistentSessionId = 'non-existent-session-' + Date.now();

      const result = await sessionContextApi.getSessionContext(nonExistentSessionId);

      expect(apiInvoker.authenticatedFetch).toHaveBeenCalledWith(
        `/session-context/${config.tenant}/context/${nonExistentSessionId}`,
        expect.objectContaining({ method: 'GET' }),
        'service',
        undefined,
        expect.anything(),
      );

      expect(result).toBeUndefined();
    });
  });

  describe('updateSessionContext', () => {
    it('should reject updateSessionContext without required saas-token header', async () => {
      // Create a session context to update

      const tokenManager = container.get<TokenManager>('EmporixTokenManager');
      const { accessToken: _token, sessionId } = await tokenManager.getAnonymousToken(config.tenant, config.clientId);

      const sessionToUpdate = createTestSessionContext(sessionId);
      sessionToUpdate.currency = 'USD';

      await expect(sessionContextApi.updateSessionContext(sessionId, sessionToUpdate, true)).rejects.toThrow(
        'Required Header [saas-token]',
      );

      expect(apiInvoker.authenticatedFetch).toHaveBeenCalledWith(
        `/session-context/${config.tenant}/context/${sessionId}?upsert=true`,
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sessionToUpdate),
        }),
        'service',
        { scopes: ['sessioncontext.context_manage'] },
        expect.anything(),
      );
    });
  });

  describe('addSessionContextAttribute', () => {
    it('should add an attribute to a session context', async () => {
      const tokenManager = container.get<TokenManager>('EmporixTokenManager');
      const { accessToken: _token, sessionId } = await tokenManager.getAnonymousToken(config.tenant, config.clientId);

      const attributeKey = `test-attribute-${Date.now()}`;
      const attributeToAdd = createTestAttribute(attributeKey);

      await sessionContextApi.addSessionContextAttribute(sessionId, attributeToAdd);

      expect(apiInvoker.authenticatedFetch).toHaveBeenCalledWith(
        `/session-context/${config.tenant}/context/${sessionId}/attributes`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(attributeToAdd),
        }),
        'service',
        { scopes: ['sessioncontext.context_manage'] },
        expect.anything(),
      );

      // Verify the attribute was added by fetching the session
      const updatedSession = await sessionContextApi.getSessionContext(sessionId);
      expect(updatedSession?.context?.[attributeKey]).toBeDefined();
    });
  });

  describe('removeSessionContextAttribute', () => {
    it('should remove an attribute from a session context', async () => {
      const tokenManager = container.get<TokenManager>('EmporixTokenManager');
      const { accessToken: _token, sessionId } = await tokenManager.getAnonymousToken(config.tenant, config.clientId);

      // First add an attribute
      const attributeKey = `test-attribute-to-remove-${Date.now()}`;
      const attributeToAdd = createTestAttribute(attributeKey);

      await sessionContextApi.addSessionContextAttribute(sessionId, attributeToAdd);

      // Now remove it
      await sessionContextApi.removeSessionContextAttribute(sessionId, attributeKey);

      expect(apiInvoker.authenticatedFetch).toHaveBeenLastCalledWith(
        `/session-context/${config.tenant}/context/${sessionId}/attributes/${attributeKey}`,
        expect.objectContaining({ method: 'DELETE' }),
        'service',
        { scopes: ['sessioncontext.context_manage'] },
        expect.anything(),
      );

      // Verify the attribute was removed by fetching the session
      const updatedSession = await sessionContextApi.getSessionContext(sessionId);
      expect(updatedSession?.context?.[attributeKey]).toBeUndefined();
    });
  });

  describe('getOwnSessionContext', () => {
    it('should fetch the current session context', async () => {
      const result = await sessionContextApi.getOwnSessionContext();

      expect(result).toBeDefined();
    });
  });

  // Customer checkout tests with real credentials
  describe('Customer Session Operations', () => {
    // Helper function to set up customer token
    const username = 'forrest.gump@alaba.ma';
    async function setupCustomerToken() {
      try {
        await apiInvoker.clearTokens();
        // Login with test customer credentials
        const password = 'Test1234';

        // Use the customer API to login
        await customerApi.login(username, password);
      } catch (error) {
        console.error('Error setting up customer token:', error);
        throw error;
      }
    }
    let customerCartId: string;

    beforeEach(async () => {
      // Set up a customer token with test user credentials
      await setupCustomerToken();
    }, 15000);

    it('should get a session context with customerId', async () => {
      // Perform the checkout
      const response = await sessionContextApi.getOwnSessionContext();
      // Verify the checkout response
      expect(response).toBeDefined();
      expect(response?.customerId).toBe('00632699');
    }, 20000);
  });

  describe('updateOwnSessionContext', () => {
    it('should update the current session context', async () => {
      // First get the existing context to obtain the correct version
      const existingContext = await sessionContextApi.getOwnSessionContext();

      const partialContext: Partial<EmporixSessionContext> = {
        siteCode: 'test-site',
        currency: 'USD',
        targetLocation: 'US',
        metadata: existingContext?.metadata ?? {},
      };

      await sessionContextApi.updateOwnSessionContext(partialContext);
      const context = await sessionContextApi.getOwnSessionContext();
      expect(context).toBeDefined();
      expect(context?.siteCode).toEqual(partialContext.siteCode);
      expect(context?.currency).toEqual(partialContext.currency);
      expect(context?.targetLocation).toEqual(partialContext.targetLocation);
    });
  });

  const testAttribute = createTestAttribute(`own-context-attribute-${timestamp}`);
  describe('addOwnSessionContextAttribute', () => {
    it('should add an attribute to the current session context', async () => {
      await sessionContextApi.addOwnSessionContextAttribute(testAttribute);

      const response = await sessionContextApi.getOwnSessionContext();
      expect(response).toBeDefined();
      expect(response?.context).toHaveProperty(testAttribute.key, testAttribute.value);
    });

    describe('removeOwnSessionContextAttribute', () => {
      it('should remove an attribute from the current session context', async () => {
        await sessionContextApi.removeOwnSessionContextAttribute(testAttribute.key);

        const response = await sessionContextApi.getOwnSessionContext();
        expect(response).toBeDefined();
        expect(response?.context).not.toBeDefined();
      });
    });
  });
});
