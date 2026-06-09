import { injectable } from '@/platform/core/di/injectable';
import type {
  AnonymousTokenSessionParams,
  EmporixAccessTokenResponse,
  EmporixAnonymousTokenResponse,
  EmporixCustomerTokenResponse,
} from '../../model/oauth';
import type { EmporixOAuthApi as IEmporixOAuthApi } from '../EmporixOAuthApi';

/**
 * Browser-safe OAuth API client for Emporix.
 * Uses the global `fetch` API directly — no debug-utils, no pino, no metrics.
 * Intended for the client-side DI container (CMS live-editing and similar use cases).
 */
@injectable('EmporixOAuthApi', 'Singleton')
class EmporixOAuthApiClient implements IEmporixOAuthApi {
  private readonly baseUrl: string = process.env.NEXT_PUBLIC_EMPORIX_BASE_URL || 'https://api.emporix.io';

  async getPublicToken(tenant: string, clientId: string): Promise<EmporixAnonymousTokenResponse> {
    const params = new URLSearchParams({ tenant, client_id: clientId });
    const url = `${this.baseUrl}/customerlogin/auth/anonymous/login?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to get public token: ${response.statusText} - ${message}`);
    }

    return (await response.json()) as EmporixAnonymousTokenResponse;
  }

  async getAnonymousToken(
    tenant: string,
    clientId: string,
    sessionParams?: AnonymousTokenSessionParams,
  ): Promise<EmporixAnonymousTokenResponse> {
    const params = new URLSearchParams({ tenant, client_id: clientId });
    if (sessionParams) {
      if (sessionParams.siteCode) params.set('siteCode', sessionParams.siteCode);
      if (sessionParams.currency) params.set('currency', sessionParams.currency);
      if (sessionParams.language) params.set('language', sessionParams.language);
      if (sessionParams.targetLocation) params.set('targetLocation', sessionParams.targetLocation);
    }
    const url = `${this.baseUrl}/customerlogin/auth/anonymous/login?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to get anonymous token: ${response.statusText} - ${message}`);
    }

    return (await response.json()) as EmporixAnonymousTokenResponse;
  }

  async refreshAnonymousToken(
    tenant: string,
    refreshToken: string,
    clientId: string,
  ): Promise<EmporixAnonymousTokenResponse> {
    const params = new URLSearchParams({ tenant, refresh_token: refreshToken, client_id: clientId });
    const url = `${this.baseUrl}/customerlogin/auth/anonymous/refresh?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to refresh anonymous token: ${response.statusText} - ${message}`);
    }

    return (await response.json()) as EmporixAnonymousTokenResponse;
  }

  async getCustomerToken(
    tenant: string,
    anonymousToken: string,
    username: string,
    password: string,
  ): Promise<EmporixCustomerTokenResponse> {
    const url = `${this.baseUrl}/customer/${encodeURIComponent(tenant)}/login`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonymousToken}`,
      },
      body: JSON.stringify({ email: username, password }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to get customer token: ${response.statusText} - ${message}`);
    }

    return (await response.json()) as EmporixCustomerTokenResponse;
  }

  async refreshCustomerToken(
    tenant: string,
    accessToken: string,
    refreshToken: string,
    legalEntityId?: string,
  ): Promise<EmporixCustomerTokenResponse> {
    const params = new URLSearchParams({ refreshToken });
    if (legalEntityId) {
      params.set('legalEntityId', legalEntityId);
    }
    const url = `${this.baseUrl}/customer/${encodeURIComponent(tenant)}/refreshauthtoken?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to refresh customer token: ${response.statusText} - ${message}`);
    }

    return (await response.json()) as EmporixCustomerTokenResponse;
  }

  async getServiceAccessToken(
    _tenant: string,
    _clientId: string,
    _clientSecret: string,
    _scopes?: string[],
  ): Promise<EmporixAccessTokenResponse> {
    throw new Error(
      'getServiceAccessToken is not available in the browser context. ' +
        'Server credentials must not be exposed client-side.',
    );
  }
}

export default EmporixOAuthApiClient;
