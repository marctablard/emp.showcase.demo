import type { RequestCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { cookies } from 'next/headers';
import { inject } from 'inversify';
import { omit } from 'lodash';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type { StoredToken } from '@/platform/integrations/types/auth';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { RequestContextService } from '@/platform/services/request-context/RequestContextService';
import type {
  AnonymousTokenSessionParams,
  EmporixAccessTokenResponse,
  EmporixAnonymousTokenResponse,
} from '../../model/oauth';
import type { EmporixOAuthApi } from '../../oauth/EmporixOAuthApi';
import type { TokenStore } from './EmporixTokenManagerAbstract';
import { EmporixTokenManagerAbstract } from './EmporixTokenManagerAbstract';

@injectable('EmporixTokenManager', 'Singleton')
class EmporixTokenManagerServer extends EmporixTokenManagerAbstract {
  protected serviceToken: StoredToken<EmporixAccessTokenResponse> | undefined;
  private requestContext: RequestContextService;
  private logger: LoggerService;

  constructor(
    @inject('EmporixOAuthApi') oauthApi: EmporixOAuthApi,
    @inject('RequestContextService') requestContext: RequestContextService,
    @inject('LoggerService') logger: LoggerService,
  ) {
    super(oauthApi);
    this.requestContext = requestContext;
    this.logger = logger;
  }

  /**
   * Resolves session params lazily in the cache-miss/refresh path only. Overriding
   * `fetchAnonymousToken` (instead of `getAnonymousToken`) keeps cached-token reads free of
   * `resolveSessionParams` work.
   */
  protected async fetchAnonymousToken(
    anonymousToken: StoredToken<EmporixAnonymousTokenResponse> | undefined,
    tenant: string,
    clientId: string,
    sessionParams?: AnonymousTokenSessionParams,
  ) {
    if (!sessionParams) {
      sessionParams = await this.resolveSessionParams();
    }
    return super.fetchAnonymousToken(anonymousToken, tenant, clientId, sessionParams);
  }

  private async resolveSessionParams(): Promise<AnonymousTokenSessionParams> {
    // Per-field source tracking so the debug log makes it trivial to verify,
    // in a production trace, that the cookies set by the auth/session routes
    // are actually being picked up when a new anonymous token is issued
    // (e.g. right after logout).
    const fallback: Record<string, 'cookie' | 'request-context' | 'env-default'> = {
      siteCode: 'env-default',
      currency: 'env-default',
      language: 'env-default',
      targetLocation: 'env-default',
      region: 'env-default',
    };

    let siteCode: string | undefined;
    try {
      siteCode = await this.requestContext.getSite();
    } catch {
      siteCode = undefined;
    }
    if (siteCode) {
      fallback.siteCode = 'request-context';
    } else {
      siteCode = process.env.NEXT_PUBLIC_DEFAULT_SITE;
    }

    let currency: string | undefined;
    try {
      currency = await this.requestContext.getCurrency();
    } catch {
      currency = undefined;
    }
    if (currency) {
      fallback.currency = 'cookie';
    } else {
      currency = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY;
    }

    let language: string | undefined;
    try {
      language = await this.requestContext.getLanguage();
    } catch {
      language = undefined;
    }
    if (language) {
      fallback.language = 'cookie';
    } else {
      language = process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE;
    }

    const params: AnonymousTokenSessionParams = {
      siteCode,
      currency,
      language,
      targetLocation: process.env.NEXT_PUBLIC_DEFAULT_COUNTRY,
      region: process.env.NEXT_PUBLIC_DEFAULT_REGION,
    };
    this.logger.debug({ ...params, fallback }, 'resolveSessionParams');
    return params;
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
