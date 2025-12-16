import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import { buildAndLogCurl, logResponse } from '@/platform/core/utils/debug-utils';
import type { EmporixConfig } from '../../config';
import type { EmporixTokenManager } from '../EmporixTokenManager';

/**
 * Main client for interacting with Emporix APIs
 * Handles authentication and provides access to various API endpoints
 */
@injectable('EmporixApiInvoker', 'Singleton')
class EmporixApiInvoker {
  protected config: EmporixConfig;
  protected tokenManager: EmporixTokenManager;

  constructor(
    @inject('EmporixConfig') config: EmporixConfig,
    @inject('EmporixTokenManager') tokenManager: EmporixTokenManager,
  ) {
    this.config = config;
    this.tokenManager = tokenManager;
  }

  /**
   * Get an anonymous token for accessing public resources
   * @returns Promise with the token string
   */
  async getAnonymousToken(): Promise<{ accessToken: string; sessionId: string }> {
    return this.tokenManager.getAnonymousToken(this.config.tenant, this.config.clientId);
  }

  /**
   * Get a service access token for administrative operations
   * @param scopes Optional cscopes (uses config value if not provided)
   * @returns Promise with the token string
   */
  async getServiceAccessToken(scopes?: string[]): Promise<string> {
    if (!this.config.serverClientId || !this.config.serverClientSecret) {
      throw new Error('Service Credentials not available');
    }
    return this.tokenManager.getServiceAccessToken(
      this.config.tenant,
      this.config.serverClientId,
      this.config.serverClientSecret,
      scopes,
    );
  }

  /**
   * Create a fetch request with the appropriate authentication headers
   * @param url API endpoint URL
   * @param options Fetch options
   * @param tokenType Type of token to use for authentication
   * @param authOptions Optional authOptions for customer (username/password)
   * @returns Promise with the fetch response
   */
  async authenticatedFetch(
    url: string,
    options: RequestInit = {},
    tokenType: 'public' | 'session' | 'customer-saas' | 'ai' | 'service' = 'public',
    authOptions?: {
      credentials?: { username: string; password: string };
      scopes?: string[];
    },
  ): Promise<Response> {
    let token: string;

    // Add authorization header to the request
    let headers = {
      ...options.headers,
    };
    // Get the appropriate token based on the token type
    switch (tokenType) {
      case 'public':
        const anonymousToken = await this.tokenManager.getAnonymousToken(this.config.tenant, this.config.clientId);
        token = anonymousToken.accessToken;
        headers = {
          ...headers,
          ...this.addPublicHeaders(anonymousToken),
        };
        break;
      case 'customer-saas':
      case 'session':
      case 'ai':
        const sessionToken = await this.tokenManager.getSessionToken(
          this.config.tenant,
          this.config.clientId,
          authOptions?.credentials,
        );
        token = sessionToken.accessToken;
        if (tokenType === 'customer-saas' || tokenType === 'ai') {
          if (sessionToken.saasToken) {
            headers = {
              ...headers,
              ...this.addCustomerHeaders(sessionToken),
            };
          } else {
            throw new Error('No SaaS token available');
          }
          if (tokenType === 'ai') {
            const headersObj = headers as Record<string, string>;
            if (!headersObj['session-id']) {
              headers = {
                ...headers,
                'session-id': `${sessionToken.sessionId}`,
              };
            }
          }
        } else {
          headers = {
            ...headers,
            ...this.addSessionHeaders(sessionToken),
          };
        }
        break;
      case 'service':
        if (!this.config.serverClientId || !this.config.serverClientSecret) {
          throw new Error('Service Credentials not available');
        }
        token = await this.tokenManager.getServiceAccessToken(
          this.config.tenant,
          this.config.serverClientId,
          this.config.serverClientSecret,
        );
        break;
      default:
        throw new Error(`Unknown token type: ${tokenType}`);
    }

    // Add authorization header to the request
    headers = {
      ...headers,
      Authorization: `Bearer ${token}`,
    };

    if (url.startsWith('/')) {
      url = url.substring(1);
    }

    return this.fetch(url, { ...options, headers });
  }

  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    url = `${this.config.baseUrl}/${url}`;
    const prefix = buildAndLogCurl(url, options);
    const responsePromise = fetch(url, options);
    responsePromise.catch((err) => console.error(`${prefix} [FETCH ERROR] ${url}`, err));
    responsePromise.then((response) => logResponse(response, url, options, prefix));
    return responsePromise;
  }

  /**
   * Clear all stored tokens
   */
  async clearTokens(): Promise<void> {
    this.tokenManager.clearTokens(this.config.tenant);
  }

  /**
   * Returns additional headers for the customer-saas token case.
   * @param sessionToken The session token object, possibly containing a saasToken.
   * @returns An object with the 'saas-token' header if available, otherwise an empty object.
   */
  protected addCustomerHeaders(sessionToken: {
    accessToken: string;
    saasToken?: string;
    sessionId: string;
  }): Record<string, string> {
    if (sessionToken.saasToken) {
      return { 'saas-token': `${sessionToken.saasToken}` };
    }
    return {};
  }

  /**
   * Returns additional headers for the session token case.
   * @param sessionToken The session token object, possibly containing a sessionId.
   * @returns An object with the 'session-id' header if available, otherwise an empty object.
   */
  protected addSessionHeaders(sessionToken: {
    accessToken: string;
    saasToken?: string;
    sessionId: string;
  }): Record<string, string> {
    if (sessionToken.sessionId) {
      return { 'session-id': `${sessionToken.sessionId}` };
    }
    return {};
  }

  /**
   * Returns additional headers for the public token case.
   * @param _anonymousToken The anonymous token object (unused in base implementation, available for subclasses).
   * @returns An empty object (no additional headers for public tokens).
   */
  protected addPublicHeaders(_anonymousToken: { accessToken: string; sessionId: string }): Record<string, string> {
    return {};
  }
}
export default EmporixApiInvoker;
