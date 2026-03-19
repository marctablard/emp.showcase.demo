import { injectable } from '@/platform/core/di/injectable';
import {
  type DebugContext,
  buildAndLogCurl,
  getDebugLogger,
  logRequestPayload,
  logResponse,
} from '@/platform/core/utils/debug-utils';
import {
  EmporixAccessTokenResponse,
  EmporixAnonymousTokenResponse,
  EmporixCustomerTokenResponse,
} from '../../model/oauth';
import { EmporixOAuthApi as IEmporixOAuthApi } from '../EmporixOAuthApi';

/**
 * Implementation of the Emporix OAuth API
 */
@injectable('EmporixOAuthApi', 'Singleton')
class EmporixOAuthApi implements IEmporixOAuthApi {
  protected readonly baseUrl: string = process.env.NEXT_PUBLIC_EMPORIX_BASE_URL || 'https://api.emporix.io';

  /**
   * Gets an anonymous token that will be used for public (shared on ssr and server) requests
   * @param tenant The tenant ID
   * @param clientId Client ID for anonymous access
   * @returns Promise with the anonymous token response
   */
  async getPublicToken(tenant: string, clientId: string): Promise<EmporixAnonymousTokenResponse> {
    const url = `/customerlogin/auth/anonymous/login?tenant=${tenant}&client_id=${clientId}`;

    const response = await this.fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      next: {
        revalidate: 3200,
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to get anonymous token: ${response.statusText} - ${message}`);
    }

    return (await response.json()) as EmporixAnonymousTokenResponse;
  }

  /**
   * Get an anonymous token
   * @param tenant The tenant ID
   * @param clientId Client ID for anonymous access
   * @returns Promise with the anonymous token response
   */
  async getAnonymousToken(tenant: string, clientId: string): Promise<EmporixAnonymousTokenResponse> {
    const url = `/customerlogin/auth/anonymous/login?tenant=${tenant}&client_id=${clientId}`;

    const response = await this.fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to get anonymous token: ${response.statusText} - ${message}`);
    }

    return (await response.json()) as EmporixAnonymousTokenResponse;
  }

  /**
   * Refresh an anonymous token
   * @param tenant The tenant ID
   * @param refreshToken Refresh token from the original anonymous token response
   * @param clientId Client ID for anonymous access
   * @returns Promise with the refreshed anonymous token response
   */
  async refreshAnonymousToken(
    tenant: string,
    refreshToken: string,
    clientId: string,
  ): Promise<EmporixAnonymousTokenResponse> {
    const url = `/customerlogin/auth/anonymous/refresh?tenant=${tenant}&refresh_token=${refreshToken}&client_id=${clientId}`;

    const response = await this.fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to refresh anonymous token: ${response.statusText} - ${message}`);
    }

    return (await response.json()) as EmporixAnonymousTokenResponse;
  }

  /**
   * Get a customer token (and SaaS token)
   * @param tenant The tenant ID
   * @param username Customer username/email
   * @param password Customer password
   * @returns Promise with the customer token response
   */
  async getCustomerToken(
    tenant: string,
    accessToken: string,
    username: string,
    password: string,
  ): Promise<EmporixCustomerTokenResponse> {
    const url = `/customer/${tenant}/login`;
    const response = await this.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        email: username,
        password: password,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to get customer token: ${response.statusText} - ${message}`);
    }

    return (await response.json()) as EmporixCustomerTokenResponse;
  }

  /**
   * Refresh a customer token
   * @param tenant The tenant ID
   * @param refreshToken Refresh token from the original customer token response
   * @returns Promise with the refreshed customer token response
   */
  async refreshCustomerToken(tenant: string, refreshToken: string): Promise<EmporixCustomerTokenResponse> {
    const url = `/customer/${tenant}/refreshauthtoken/refresh?refresh_token=${refreshToken}`;

    const response = await this.fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to refresh customer token: ${response.statusText} - ${message}`);
    }

    return (await response.json()) as EmporixCustomerTokenResponse;
  }

  /**
   * Get a service access token
   * @param tenant The tenant ID
   * @param clientId Client ID for service access
   * @param clientSecret Client secret for service access
   * @returns Promise with the service access token response
   */
  async getServiceAccessToken(
    tenant: string,
    clientId: string,
    clientSecret: string,
    scopes?: string[],
  ): Promise<EmporixAccessTokenResponse> {
    // Create URL-encoded form data for OAuth token request
    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    formData.append('client_id', clientId);
    formData.append('client_secret', clientSecret);
    if (scopes) {
      formData.append('scope', `tenant=${tenant}` + (scopes ? ` ${scopes.join(' ')}` : ''));
    }
    const response = await this.fetch('/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: formData,
      next: {
        revalidate: 3200,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get service access token: ${response.statusText}`);
    }
    return (await response.json()) as EmporixAccessTokenResponse;
  }

  /** TODO this is currently a duplicate of EmporixApiInvoker,
   * but we need to restructure the dependencies, to make it not cyclic when using this
   * Circular dependency : EmporixTokenManager -> EmporixOAuthApi -> EmporixApiInvoker -> EmporixTokenManager
   */
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    url = `${this.baseUrl}${url.startsWith('/') ? url : '/' + url}`;
    const ctx: DebugContext = { callType: 'external' };
    const prefix = buildAndLogCurl(url, options, ctx);
    logRequestPayload(url, options, prefix, ctx);
    const responsePromise = fetch(url, options);
    responsePromise.catch((err) =>
      getDebugLogger().error(
        { url, error: err instanceof Error ? err.message : String(err) },
        `${prefix} [FETCH ERROR]`,
      ),
    );
    responsePromise.then((response) => logResponse(response, url, options, prefix, ctx));
    return responsePromise;
  }
}

export default EmporixOAuthApi;
