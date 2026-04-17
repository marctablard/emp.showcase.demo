import type { StoredToken } from '@platform/integrations/types/auth';
import { inject } from 'inversify';
import 'server-only';
import type {
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

export abstract class EmporixTokenManagerAbstract implements IEmporixTokenManager {
  constructor(@inject('EmporixOAuthApi') protected oauthApi: EmporixOAuthApi) {}
  abstract clearTokens(tenant: string): void;

  async getPublicToken(tenant: string, clientId: string): Promise<{ accessToken: string }> {
    // this token should already be a cached one.
    const publicToken = await this.oauthApi.getPublicToken(tenant, clientId);
    return { accessToken: publicToken.access_token };
  }

  async getAnonymousToken(tenant: string, clientId: string): Promise<{ accessToken: string; sessionId: string }> {
    let anonymousToken = await this.readToken<
      StoredToken<EmporixAnonymousTokenResponse>,
      EmporixAnonymousTokenResponse
    >(EMPORIX_TOKEN_TYPE.ANONYMOUS, tenant);
    // Check if token is expired or about to expire (within 5 minutes)
    if (!this.checkAccessToken(anonymousToken)) {
      anonymousToken = await this.fetchAnonymousToken(anonymousToken, tenant, clientId);
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
  ) {
    const now = Date.now();
    let response;
    // Try refresh token
    if (anonymousToken && checkTokenValidity(anonymousToken.token.refresh_token, anonymousToken.refreshExpiryAt)) {
      try {
        response = await this.oauthApi.refreshAnonymousToken(tenant, anonymousToken.token.refresh_token!, clientId);
      } catch (_error) {
        response = undefined;
      }
    }
    // final resort, we have to get a new token
    if (!response) {
      response = await this.oauthApi.getAnonymousToken(tenant, clientId);
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
        customerToken = await this.refreshCustomerToken(customerToken, tenant);
        await this.writeToken<StoredToken<EmporixCustomerTokenResponse>, EmporixCustomerTokenResponse>(
          EMPORIX_TOKEN_TYPE.CUSTOMER,
          customerToken,
          tenant,
        );
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
      customerToken = {
        token: {
          ...response,
          session_id: customerToken!.token.session_id,
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
    return this.writeToken(EMPORIX_TOKEN_TYPE.CUSTOMER, undefined, tenant);
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
    const response = await this.oauthApi.getServiceAccessToken(tenant, clientId, clientSecret, scopes);
    return response.access_token;
  }

  protected async readToken<T extends StoredToken<K>, K>(
    type: EmporixTokenType,
    tenant: string,
  ): Promise<T | undefined> {
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
