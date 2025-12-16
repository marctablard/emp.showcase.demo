import { RequestCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { cookies } from 'next/headers';
import { inject } from 'inversify';
import { omit } from 'lodash';
import { injectable } from '@/platform/core/di/injectable';
import { StoredToken } from '@/platform/integrations/types/auth';
import { EmporixCustomerTokenResponse } from '../../model/oauth';
import type { EmporixOAuthApi } from '../../oauth/EmporixOAuthApi';
import { TokenStore } from './EmporixTokenManagerAbstract';
import { EmporixTokenManagerAbstract } from './EmporixTokenManagerAbstract';

@injectable('EmporixTokenManager', 'Singleton')
class EmporixTokenManagerSSR extends EmporixTokenManagerAbstract {
  protected ssrToken: Record<string, TokenStore> = {};

  constructor(@inject('EmporixOAuthApi') oauthApi: EmporixOAuthApi) {
    super(oauthApi);
  }

  public clearTokens(tenant: string): void {
    this.ssrToken[tenant] = {};
  }

  public async getSessionToken(
    tenant: string,
    clientId: string,
  ): Promise<{ accessToken: string; saasToken?: string; sessionId: string }> {
    const customerToken = await this.readToken<StoredToken<EmporixCustomerTokenResponse>, EmporixCustomerTokenResponse>(
      'customer',
      tenant,
    );
    // first check client's customer token
    if (this.checkAccessToken(customerToken)) {
      return { accessToken: customerToken!.token.access_token, sessionId: customerToken!.token.session_id };
    }
    // otherwise check their anonymous token
    const anonymousToken = await this.readToken<
      StoredToken<EmporixCustomerTokenResponse>,
      EmporixCustomerTokenResponse
    >('anonymous', tenant);
    if (this.checkAccessToken(anonymousToken)) {
      return { accessToken: anonymousToken!.token.access_token, sessionId: anonymousToken!.token.session_id };
    }
    // otherwise we use our own token
    const ssrAnonymousToken = this.ssrToken[tenant]?.anonymousToken;
    if (!this.checkAccessToken(ssrAnonymousToken)) {
      const freshSsrAnonymousToken = await this.fetchAnonymousToken(ssrAnonymousToken, tenant, clientId);
      // ...and store it globally, so it can be reused
      if (!this.ssrToken[tenant]) {
        this.ssrToken[tenant] = {};
      }
      this.ssrToken[tenant].anonymousToken = freshSsrAnonymousToken;
    }
    return {
      accessToken: this.ssrToken[tenant].anonymousToken!.token.access_token,
      sessionId: this.ssrToken[tenant].anonymousToken!.token.session_id,
    };
  }

  protected createCustomerToken(
    _tenant: string,
    _clientId: string,
    _credentials: { username: string; password: string },
  ): Promise<{
    token: {
      sessionId: string;
      saas_token: string;
      session_id: string;
      access_token: string;
      token_type: string;
      expires_in: number;
      scope: string;
      refresh_token?: string;
      refresh_token_expires_in?: number;
    };
    expiryAt: number;
    refreshExpiryAt: number | undefined;
  }> {
    throw new Error("Customer authentication is not allowed, since SSR-Context can't provide Cookies in Response");
  }

  protected fetchCustomerToken(
    _customerToken: StoredToken<EmporixCustomerTokenResponse> | undefined,
    _tenant: string,
    _username: string | undefined,
    _password: string | undefined,
    _clientId: string,
  ): Promise<StoredToken<EmporixCustomerTokenResponse>> {
    throw new Error("Customer authentication is not allowed, since SSR-Context can't provide Cookies in Response");
  }

  protected async writeTokens(tokens: TokenStore, tenant: string): Promise<void> {
    // strip customer Token, since that will be from the the SSR Clients cookie
    tokens = omit(tokens, ['customerToken']);
    this.ssrToken[tenant] = tokens;
  }
  protected async readTokens(tenant: string): Promise<TokenStore> {
    const cookieStore = await cookies();
    const tokenCookie: RequestCookie | undefined = cookieStore.get(this.buildStorageKey(tenant));
    if (!tokenCookie) {
      // Clear the in-memory cache when cookie is missing (e.g., after logout)
      if (this.ssrToken[tenant]) {
        this.ssrToken[tenant] = {};
      }
      return {};
    }
    const b64Token = tokenCookie.value;
    const tokens: TokenStore = JSON.parse(Buffer.from(b64Token, 'base64').toString('utf-8'));
    return tokens;
  }
}
export default EmporixTokenManagerSSR;
