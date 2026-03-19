import { RequestCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { cookies } from 'next/headers';
import { inject } from 'inversify';
import { omit } from 'lodash';
import { injectable } from '@/platform/core/di/injectable';
import { StoredToken } from '@/platform/integrations/types/auth';
import { EmporixAccessTokenResponse } from '../../model/oauth';
import type { EmporixOAuthApi } from '../../oauth/EmporixOAuthApi';
import { EmporixTokenManagerAbstract, TokenStore } from './EmporixTokenManagerAbstract';

@injectable('EmporixTokenManager', 'Singleton')
class EmporixTokenManagerServer extends EmporixTokenManagerAbstract {
  protected serviceToken: StoredToken<EmporixAccessTokenResponse> | undefined;

  constructor(@inject('EmporixOAuthApi') oauthApi: EmporixOAuthApi) {
    super(oauthApi);
  }

  public clearTokens(tenant: string): void {
    this.writeTokens({}, tenant);
  }

  protected async readTokens(tenant: string): Promise<TokenStore> {
    const cookieStore = await cookies();
    const tokenCookie: RequestCookie | undefined = cookieStore.get(this.buildStorageKey(tenant));
    if (!tokenCookie) {
      return {};
    }
    const b64Token = tokenCookie.value;
    const tokens: TokenStore = JSON.parse(Buffer.from(b64Token, 'base64').toString('utf-8'));
    // we grab the service token from memory if possible because we don't want to store it in cookies for security reasons
    tokens.serviceToken = this.serviceToken;
    return tokens;
  }

  protected async writeTokens(tokens: TokenStore, tenant: string): Promise<void> {
    // omit service token from cookies so it doesn't get leaked to client-side code
    const clientTokens = omit(tokens, ['serviceToken']);
    const b64Token = Buffer.from(JSON.stringify(clientTokens)).toString('base64');
    const cookieStore = await cookies();
    cookieStore.set(this.buildStorageKey(tenant), b64Token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    this.serviceToken = tokens.serviceToken;
  }
}

export default EmporixTokenManagerServer;
