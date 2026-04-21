import type { AnonymousTokenSessionParams } from '../model/oauth';

/**
 * TokenManager for handling Emporix API tokens
 * Manages token caching and refreshing
 */
export interface EmporixTokenManager {
  /**
   * Get a valid anonymous token, that can be shared across users for public / non-session-bound requests
   * @param tenant The tenant ID
   * @returns Promise with the token
   */
  getPublicToken(tenant: string, clientId: string): Promise<{ accessToken: string }>;

  /**
   * Get a valid anonymous token, refreshing if necessary
   * @param tenant The tenant ID
   * @param sessionParams Optional session context values to pre-seed the new session (COP-5047)
   * @returns Promise with the token
   */
  getAnonymousToken(
    tenant: string,
    clientId: string,
    sessionParams?: AnonymousTokenSessionParams,
  ): Promise<{ accessToken: string; sessionId: string }>;

  /**
   * Clear the anonymous token for the given tenant
   * @param tenant The tenant ID
   */
  clearAnonymousToken(tenant: string): Promise<void>;

  /**
   * Get a valid anonymous token, refreshing if necessary
   * @param tenant The tenant ID
   * @returns Promise with the token
   */
  getCustomerToken(
    tenant: string,
    clientId: string,
    credentials?: { username: string; password: string },
  ): Promise<{ accessToken: string; saasToken?: string; sessionId: string } | null>;

  /**
   * Clear the customer token for the given tenant
   * @param tenant The tenant ID
   */
  clearCustomerToken(tenant: string): Promise<void>;

  /**
   * Get a Session Token, either the current Anonymous Token or a Customer Token
   * - A new one is created if credentials are being supplied
   * @param tenant The tenant ID
   * @param credentials Optional customer credentials (username and password)
   * @returns Promise with the token string and SaaS
   */
  getSessionToken(
    tenant: string,
    clientId: string,
    credentials?: { username: string; password: string },
  ): Promise<{ accessToken: string; saasToken?: string; sessionId: string }>;

  /**
   * Get a valid service access token, refreshing if necessary
   * @param tenant The tenant ID
   * @param clientId Client ID for service access
   * @param clientSecret Client secret for service access
   * @returns Promise with the token string
   */
  getServiceAccessToken(tenant: string, clientId: string, clientSecret: string, scopes?: string[]): Promise<string>;

  /**
   * Refresh customer token with a specific legal entity ID
   * Used when switching companies in B2B context
   * @param tenant The tenant ID
   * @param legalEntityId The legal entity ID to switch to
   * @returns Promise with the refreshed token
   */
  refreshCustomerTokenWithLegalEntity(
    tenant: string,
    legalEntityId: string,
  ): Promise<{ accessToken: string; saasToken?: string; sessionId: string } | null>;

  /**
   * Clear the in-process public token cache for the given tenant+clientId.
   * Used by invokers to force a fresh token on 401 retry.
   */
  clearPublicTokenCache(tenant: string, clientId: string): void;

  /**
   * Clear all stored tokens
   */
  clearTokens(tenant: string): void;
}
