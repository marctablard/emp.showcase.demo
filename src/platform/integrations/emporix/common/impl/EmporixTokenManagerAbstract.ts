import type { StoredToken } from '@platform/integrations/types/auth';
import { inject } from 'inversify';
import type {
  AnonymousTokenSessionParams,
  EmporixAccessTokenResponse,
  EmporixAnonymousTokenResponse,
  EmporixCustomerTokenResponse,
} from '../../model/oauth';
import type { EmporixOAuthApi } from '../../oauth/EmporixOAuthApi';
import type { EmporixTokenManager as IEmporixTokenManager } from '../EmporixTokenManager';
import { EMPORIX_TOKEN_TYPE, type EmporixTokenType } from '../token-types';
import { checkTokenValidity } from '../util/common';

// TODO configurable
const STORAGE_PREFIX = 'emporix-token';

export interface TokenStore {
  publicToken?: StoredToken<EmporixAnonymousTokenResponse>;
  anonymousToken?: StoredToken<EmporixAnonymousTokenResponse>;
  customerToken?: StoredToken<EmporixCustomerTokenResponse>;
  serviceToken?: StoredToken<EmporixAccessTokenResponse>;
}

interface PublicTokenCache {
  entries: Map<string, { accessToken: string; expiresAt: number }>;
  inflight: Map<string, Promise<{ accessToken: string }>>;
}

const PUBLIC_TOKEN_CACHE_KEY = '__emporix_public_token_cache' as const;
const PUBLIC_TOKEN_SAFETY_MARGIN_MS = 60_000;

function getPublicTokenCache(): PublicTokenCache {
  const g = globalThis as unknown as Record<string, PublicTokenCache>;
  if (!g[PUBLIC_TOKEN_CACHE_KEY]) {
    g[PUBLIC_TOKEN_CACHE_KEY] = { entries: new Map(), inflight: new Map() };
  }
  return g[PUBLIC_TOKEN_CACHE_KEY];
}

interface ServiceTokenCache {
  entries: Map<string, { accessToken: string; expiresAt: number }>;
  inflight: Map<string, Promise<string>>;
}

export const SERVICE_TOKEN_CACHE_KEY = '__emporix_service_token_cache' as const;
const SERVICE_TOKEN_SAFETY_MARGIN_MS = 60_000;

function getServiceTokenCache(): ServiceTokenCache {
  const g = globalThis as unknown as Record<string, ServiceTokenCache>;
  if (!g[SERVICE_TOKEN_CACHE_KEY]) {
    g[SERVICE_TOKEN_CACHE_KEY] = { entries: new Map(), inflight: new Map() };
  }
  return g[SERVICE_TOKEN_CACHE_KEY];
}

function buildServiceTokenCacheKey(tenant: string, clientId: string, clientSecret: string, scopes?: string[]): string {
  // Include clientSecret in the key so rotation of NEXT_EMPORIX_CLIENT_SECRET
  // invalidates the cache automatically without needing an explicit flush.
  // scopes are normalized (sorted, space-joined) so callers passing the same
  // scopes in different order still share an entry.
  const normalizedScopes = scopes && scopes.length > 0 ? [...scopes].sort().join(' ') : '';
  return `${tenant}:${clientId}:${clientSecret}:${normalizedScopes}`;
}

export abstract class EmporixTokenManagerAbstract implements IEmporixTokenManager {
  private static readonly ANON_TOKEN_DEDUP_GRACE_MS = 2_000;
  private _anonymousTokenInflight = new Map<string, Promise<StoredToken<EmporixAnonymousTokenResponse>>>();
  /** Same-request cache: Next.js may not expose freshly-set cookies until the next request. */
  private assistedBuyingCustomerTokenCache = new Map<string, StoredToken<EmporixCustomerTokenResponse>>();

  constructor(@inject('EmporixOAuthApi') protected oauthApi: EmporixOAuthApi) {}
  abstract clearTokens(tenant: string): void;

  async getPublicToken(tenant: string, clientId: string): Promise<{ accessToken: string }> {
    const cacheKey = `${tenant}:${clientId}`;
    const cache = getPublicTokenCache();

    const cached = cache.entries.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return { accessToken: cached.accessToken };
    }

    const inflight = cache.inflight.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const promise = (async () => {
      const response = await this.oauthApi.getPublicToken(tenant, clientId);
      const expiresAt = Date.now() + response.expires_in * 1000 - PUBLIC_TOKEN_SAFETY_MARGIN_MS;
      cache.entries.set(cacheKey, { accessToken: response.access_token, expiresAt });
      return { accessToken: response.access_token };
    })();

    cache.inflight.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      cache.inflight.delete(cacheKey);
    }
  }

  clearPublicTokenCache(tenant: string, clientId: string): void {
    const cacheKey = `${tenant}:${clientId}`;
    const cache = getPublicTokenCache();
    cache.entries.delete(cacheKey);
    cache.inflight.delete(cacheKey);
  }

  async getAnonymousToken(
    tenant: string,
    clientId: string,
    sessionParams?: AnonymousTokenSessionParams,
  ): Promise<{ accessToken: string; sessionId: string }> {
    let anonymousToken = await this.readToken<
      StoredToken<EmporixAnonymousTokenResponse>,
      EmporixAnonymousTokenResponse
    >(EMPORIX_TOKEN_TYPE.ANONYMOUS, tenant);
    if (!this.checkAccessToken(anonymousToken)) {
      // Deduplicate concurrent token creation requests (thundering herd prevention).
      // When multiple API route handlers fire simultaneously without a stored token,
      // they all share a single upstream call instead of each creating a new token.
      // Key includes siteCode so requests for different sites get separate tokens.
      const dedupeKey = `${tenant}:${sessionParams?.siteCode ?? ''}`;
      const inflight = this._anonymousTokenInflight.get(dedupeKey);
      if (inflight) {
        anonymousToken = await inflight;
      } else {
        const promise = this.fetchAnonymousToken(anonymousToken, tenant, clientId, sessionParams);
        this._anonymousTokenInflight.set(dedupeKey, promise);
        try {
          anonymousToken = await promise;
        } finally {
          // Keep the resolved promise in the map for a grace period so sequential
          // callers (arriving after the first completes but before the cookie is
          // readable) still coalesce instead of creating a new token.
          const ref = promise;
          setTimeout(() => {
            if (this._anonymousTokenInflight.get(dedupeKey) === ref) {
              this._anonymousTokenInflight.delete(dedupeKey);
            }
          }, EmporixTokenManagerAbstract.ANON_TOKEN_DEDUP_GRACE_MS);
        }
      }
      await this.writeToken<StoredToken<EmporixAnonymousTokenResponse>, EmporixAnonymousTokenResponse>(
        EMPORIX_TOKEN_TYPE.ANONYMOUS,
        anonymousToken,
        tenant,
      );
    }
    return { accessToken: anonymousToken!.token.access_token, sessionId: anonymousToken!.token.session_id };
  }

  protected async fetchAnonymousToken(
    anonymousToken: StoredToken<EmporixAnonymousTokenResponse> | undefined,
    tenant: string,
    clientId: string,
    sessionParams?: AnonymousTokenSessionParams,
  ) {
    const now = Date.now();
    let response;
    // Try refresh token — session params are NOT passed on refresh (only on new creation)
    if (anonymousToken && checkTokenValidity(anonymousToken.token.refresh_token, anonymousToken.refreshExpiryAt)) {
      try {
        response = await this.oauthApi.refreshAnonymousToken(tenant, anonymousToken.token.refresh_token!, clientId);
      } catch (_error) {
        response = undefined;
      }
    }
    if (!response) {
      response = await this.oauthApi.getAnonymousToken(tenant, clientId, sessionParams);
    }
    anonymousToken = {
      token: response,
      expiryAt: now + response.expires_in * 1000,
      refreshExpiryAt: response.refresh_token_expires_in ? now + response.refresh_token_expires_in * 1000 : undefined,
    };
    return anonymousToken;
  }

  public async getSessionToken(
    tenant: string,
    clientId: string,
    credentials?: { username: string; password: string },
  ): Promise<{ accessToken: string; saasToken?: string; sessionId: string }> {
    // When recieving credentials we MUST recreate a new Token
    const customerToken = await this.getCustomerToken(tenant, clientId, credentials);
    if (customerToken) {
      return customerToken;
    } else {
      return this.getAnonymousToken(tenant, clientId);
    }
  }

  public async clearAnonymousToken(tenant: string): Promise<void> {
    return this.writeToken(EMPORIX_TOKEN_TYPE.ANONYMOUS, undefined, tenant);
  }

  public async getCustomerToken(
    tenant: string,
    clientId: string,
    credentials?: { username: string; password: string },
  ): Promise<{ accessToken: string; saasToken?: string; sessionId: string } | null> {
    // When recieving credentials we MUST recreate a new Token
    let customerToken;
    if (credentials) {
      customerToken = await this.createCustomerToken(tenant, clientId, credentials);
      await this.writeToken<StoredToken<EmporixCustomerTokenResponse>, EmporixCustomerTokenResponse>(
        EMPORIX_TOKEN_TYPE.CUSTOMER,
        customerToken,
        tenant,
      );
    } else {
      customerToken = await this.readToken<StoredToken<EmporixCustomerTokenResponse>, EmporixCustomerTokenResponse>(
        EMPORIX_TOKEN_TYPE.CUSTOMER,
        tenant,
      );
      // Check if token is expired or about to expire (within 5 minutes)
      if (!this.checkAccessToken(customerToken)) {
        const refreshedToken = await this.refreshCustomerToken(customerToken, tenant);
        if (refreshedToken) {
          customerToken = refreshedToken;
          await this.writeToken<StoredToken<EmporixCustomerTokenResponse>, EmporixCustomerTokenResponse>(
            EMPORIX_TOKEN_TYPE.CUSTOMER,
            customerToken,
            tenant,
          );
        }
      }
    }
    if (customerToken?.token) {
      return {
        accessToken: customerToken.token.access_token,
        saasToken: customerToken.token.saas_token,
        sessionId: customerToken.token.session_id,
      };
    } else {
      return null;
    }
  }

  protected async createCustomerToken(
    tenant: string,
    clientId: string,
    credentials: { username: string; password: string },
  ) {
    const anonymousToken = await this.getAnonymousToken(tenant, clientId);
    const response = await this.oauthApi.getCustomerToken(
      tenant,
      anonymousToken.accessToken,
      credentials.username,
      credentials.password,
    );
    const now = Date.now();
    return {
      token: response,
      expiryAt: now + response.expires_in * 1000,
      refreshExpiryAt: response.refresh_token_expires_in ? now + response.refresh_token_expires_in * 1000 : undefined,
    };
  }

  protected async refreshCustomerToken(
    customerToken: StoredToken<EmporixCustomerTokenResponse> | undefined,
    tenant: string,
    legalEntityId?: string,
  ) {
    let response;
    // try refresh token first
    if (customerToken && checkTokenValidity(customerToken.token.refresh_token, customerToken.refreshExpiryAt)) {
      response = await this.oauthApi.refreshCustomerToken(
        tenant,
        customerToken.token.access_token!,
        customerToken.token.refresh_token!,
        legalEntityId,
      );
    }
    if (response) {
      const now = Date.now();
      const previous = customerToken!.token;
      const saasTokenFromRefresh = response.saas_token;
      const saasToken =
        saasTokenFromRefresh != null && saasTokenFromRefresh !== '' ? saasTokenFromRefresh : previous.saas_token;
      customerToken = {
        token: {
          ...response,
          session_id: previous.session_id,
          saas_token: saasToken,
        },
        expiryAt: now + response.expires_in * 1000,
        refreshExpiryAt: response.refresh_token_expires_in ? now + response.refresh_token_expires_in * 1000 : undefined,
      };
      return customerToken;
    } else {
      return undefined;
    }
  }

  public async clearCustomerToken(tenant: string): Promise<void> {
    this.assistedBuyingCustomerTokenCache.delete(tenant);
    return this.writeToken(EMPORIX_TOKEN_TYPE.CUSTOMER, undefined, tenant);
  }

  public async setAssistedBuyingCustomerToken(
    tenant: string,
    tokens: { accessToken: string; expiresIn: number; saasToken: string; sessionId?: string },
  ): Promise<void> {
    const now = Date.now();
    const storedToken: StoredToken<EmporixCustomerTokenResponse> = {
      token: {
        access_token: tokens.accessToken,
        token_type: 'Bearer',
        expires_in: tokens.expiresIn,
        scope: 'customer',
        saas_token: tokens.saasToken,
        session_id: tokens.sessionId ?? '',
      },
      expiryAt: now + tokens.expiresIn * 1000,
    };
    this.assistedBuyingCustomerTokenCache.set(tenant, storedToken);
    await this.writeToken<StoredToken<EmporixCustomerTokenResponse>, EmporixCustomerTokenResponse>(
      EMPORIX_TOKEN_TYPE.CUSTOMER,
      storedToken,
      tenant,
    );
  }

  public clearAssistedBuyingCustomerTokenCache(tenant: string): void {
    this.assistedBuyingCustomerTokenCache.delete(tenant);
  }

  public async updateCustomerTokenSessionId(tenant: string, sessionId: string): Promise<void> {
    const cached = this.assistedBuyingCustomerTokenCache.get(tenant);
    if (cached) {
      cached.token.session_id = sessionId;
      this.assistedBuyingCustomerTokenCache.set(tenant, cached);
    }
    const customerToken = await this.readToken<StoredToken<EmporixCustomerTokenResponse>, EmporixCustomerTokenResponse>(
      EMPORIX_TOKEN_TYPE.CUSTOMER,
      tenant,
    );
    if (!customerToken) {
      return;
    }
    customerToken.token.session_id = sessionId;
    await this.writeToken<StoredToken<EmporixCustomerTokenResponse>, EmporixCustomerTokenResponse>(
      EMPORIX_TOKEN_TYPE.CUSTOMER,
      customerToken,
      tenant,
    );
  }

  public async refreshCustomerTokenWithLegalEntity(
    tenant: string,
    legalEntityId: string,
  ): Promise<{ accessToken: string; saasToken?: string; sessionId: string } | null> {
    const customerToken = await this.readToken<StoredToken<EmporixCustomerTokenResponse>, EmporixCustomerTokenResponse>(
      'customer',
      tenant,
    );

    if (!customerToken) {
      return null;
    }

    const refreshedToken = await this.refreshCustomerToken(customerToken, tenant, legalEntityId);

    if (refreshedToken) {
      await this.writeToken<StoredToken<EmporixCustomerTokenResponse>, EmporixCustomerTokenResponse>(
        'customer',
        refreshedToken,
        tenant,
      );

      return {
        accessToken: refreshedToken.token.access_token,
        saasToken: refreshedToken.token.saas_token,
        sessionId: refreshedToken.token.session_id,
      };
    }

    return null;
  }

  public async getServiceAccessToken(
    tenant: string,
    clientId: string,
    clientSecret: string,
    scopes?: string[],
  ): Promise<string> {
    const cacheKey = buildServiceTokenCacheKey(tenant, clientId, clientSecret, scopes);
    const cache = getServiceTokenCache();

    const cached = cache.entries.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.accessToken;
    }

    const inflight = cache.inflight.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const promise = (async () => {
      const response = await this.oauthApi.getServiceAccessToken(tenant, clientId, clientSecret, scopes);
      // Only cache entries that are meaningfully useful — tokens that expire in
      // less than the safety margin would cause immediate re-fetch storms.
      const effectiveTtlMs = response.expires_in * 1000 - SERVICE_TOKEN_SAFETY_MARGIN_MS;
      if (effectiveTtlMs > 0) {
        cache.entries.set(cacheKey, {
          accessToken: response.access_token,
          expiresAt: Date.now() + effectiveTtlMs,
        });
      }
      return response.access_token;
    })();

    cache.inflight.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      cache.inflight.delete(cacheKey);
    }
  }

  public clearServiceTokenCache(tenant: string, clientId: string, clientSecret: string, scopes?: string[]): void {
    const cacheKey = buildServiceTokenCacheKey(tenant, clientId, clientSecret, scopes);
    const cache = getServiceTokenCache();
    cache.entries.delete(cacheKey);
    cache.inflight.delete(cacheKey);
  }

  protected async readToken<T extends StoredToken<K>, K>(
    type: EmporixTokenType,
    tenant: string,
  ): Promise<T | undefined> {
    if (type === EMPORIX_TOKEN_TYPE.CUSTOMER) {
      const cached = this.assistedBuyingCustomerTokenCache.get(tenant);
      if (cached) {
        return cached as T;
      }
    }

    const tokens = await this.readTokens(tenant);
    switch (type) {
      case EMPORIX_TOKEN_TYPE.ANONYMOUS:
        return tokens.anonymousToken as T;
      case EMPORIX_TOKEN_TYPE.CUSTOMER:
        return tokens.customerToken as T;
      case EMPORIX_TOKEN_TYPE.SERVICE:
        return tokens.serviceToken as T;
    }
  }

  protected async writeToken<T extends StoredToken<K>, K>(
    type: EmporixTokenType,
    token: T | undefined,
    tenant: string,
  ): Promise<void> {
    const tokenStore: TokenStore = await this.readTokens(tenant);
    switch (type) {
      case EMPORIX_TOKEN_TYPE.ANONYMOUS:
        tokenStore.anonymousToken = token as StoredToken<EmporixAnonymousTokenResponse>;
        break;
      case EMPORIX_TOKEN_TYPE.CUSTOMER:
        tokenStore.customerToken = token as StoredToken<EmporixCustomerTokenResponse>;
        break;
      case EMPORIX_TOKEN_TYPE.SERVICE:
        tokenStore.serviceToken = token as StoredToken<EmporixAccessTokenResponse>;
        break;
    }
    return this.writeTokens(tokenStore, tenant);
  }

  protected checkAccessToken(storedToken?: StoredToken<EmporixAccessTokenResponse> | undefined): boolean {
    if (!storedToken) {
      return false;
    }
    return storedToken.token && checkTokenValidity(storedToken.token.access_token, storedToken.expiryAt);
  }

  buildStorageKey(tenant: string): string {
    return `${STORAGE_PREFIX}_${tenant}`;
  }

  protected abstract readTokens(tenant: string): Promise<TokenStore>;
  protected abstract writeTokens(tokens: TokenStore, tenant: string): Promise<void>;
}
