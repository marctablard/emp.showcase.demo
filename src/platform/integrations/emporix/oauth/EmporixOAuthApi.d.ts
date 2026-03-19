import {
  EmporixAccessTokenResponse,
  EmporixAnonymousTokenResponse,
  EmporixCustomerTokenResponse,
} from '../model/oauth';

/**
 * OAuth API Interface for Emporix
 * Based on the OAuth Service OpenAPI specification
 */
export interface EmporixOAuthApi {
  /**
   * Get an anonymous token
   * Used by the storefront to access public resources with a reading scope.
   * It allows customers and bots to browse products, view prices or add products to cart.
   * (Technically this is an anonymous token that is being reused.)
   *
   * @param tenant The tenant ID
   * @param clientId Client ID for anonymous access
   * @returns Promise with the anonymous token response
   */
  getPublicToken(tenant: string, clientId: string): Promise<EmporixAnonymousTokenResponse>;

  /**
   * Get an anonymous token that can be used in session context of a customer
   * Used by the storefront to access public resources with a reading scope.
   * It allows customers to browse products, view prices or add products to cart.
   *
   * @param tenant The tenant ID
   * @param clientId Client ID for anonymous access
   * @returns Promise with the anonymous token response
   */
  getAnonymousToken(tenant: string, clientId: string): Promise<EmporixAnonymousTokenResponse>;

  /**
   * Refresh an anonymous token
   * Sends an authentication request and returns new anonymous token with same session ID attached.
   *
   * @param tenant The tenant ID
   * @param refreshToken Refresh token from the original anonymous token response
   * @param clientId Client ID for anonymous access
   * @returns Promise with the refreshed anonymous token response
   */
  refreshAnonymousToken(tenant: string, refreshToken: string, clientId: string): Promise<EmporixAnonymousTokenResponse>;

  /**
   * Get a customer token (SaaS token)
   * A JSON Web Token (JWT) which contains encrypted customer data.
   * The SaaS token works similarly to the anonymous token, but it is associated with a specific customer.
   *
   * @param tenant The tenant ID
   * @param anonymousToken The anonymous token
   * @param username Customer username/email
   * @param password Customer password
   * @returns Promise with the customer token response
   */
  getCustomerToken(
    tenant: string,
    anonymousToken: string,
    username: string,
    password: string,
  ): Promise<EmporixCustomerTokenResponse>;

  /**
   * Refresh a customer token
   * Sends an authentication request and returns a refreshed customer token.
   *
   * @param tenant The tenant ID
   * @param accessToken Current access token
   * @param refreshToken Refresh token from the original customer token response
   * @param legalEntityId Optional legal entity ID
   * @returns Promise with the refreshed customer token response
   */
  refreshCustomerToken(
    tenant: string,
    accessToken: string,
    refreshToken: string,
    legalEntityId?: string,
  ): Promise<EmporixCustomerTokenResponse>;

  /**
   * Get a service access token
   * Needed to access the Emporix services such as adding new products, managing categories or modifying prices.
   *
   * @param tenant The tenant ID
   * @param clientId Client ID for service access
   * @param clientSecret Client secret for service access
   * @returns Promise with the service access token response
   */
  getServiceAccessToken(
    tenant: string,
    clientId: string,
    clientSecret: string,
    scopes?: string[],
  ): Promise<EmporixAccessTokenResponse>;
}
