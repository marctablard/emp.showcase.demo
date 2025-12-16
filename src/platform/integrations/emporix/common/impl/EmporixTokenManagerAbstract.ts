import { StoredToken } from '@platform/integrations/types/auth';
import { inject } from 'inversify';
import type {
  EmporixAccessTokenResponse,
  EmporixAnonymousTokenResponse,
  EmporixCustomerTokenResponse,
} from '../../model/oauth';
import type { EmporixOAuthApi } from '../../oauth/EmporixOAuthApi';
import { EmporixTokenManager as IEmporixTokenManager } from '../EmporixTokenManager';
import { checkTokenValidity } from '../util/common';

// TODO configurable
const STORAGE_PREFIX = 'emporix-token';

export interface TokenStore {
  anonymousToken?: StoredToken<EmporixAnonymousTokenResponse>;
  customerToken?: StoredToken<EmporixCustomerTokenResponse>;
  serviceToken?: StoredToken<EmporixAccessTokenResponse>;
}

export abstract class EmporixTokenManagerAbstract implements IEmporixTokenManager {
  constructor(@inject('EmporixOAuthApi') protected oauthApi: EmporixOAuthApi) {}
  abstract clearTokens(tenant: string): void;
  async getAnonymousToken(tenant: string, clientId: string): Promise<{ accessToken: string; sessionId: string }> {
    let anonymousToken = await this.readToken<
      StoredToken<EmporixAnonymousTokenResponse>,
      EmporixAnonymousTokenResponse
    >('anonymous', tenant);
    // Check if token is expired or about to expire (within 5 minutes)
    if (!this.checkAccessToken(anonymousToken)) {
      anonymousToken = await this.fetchAnonymousToken(anonymousToken, tenant, clientId);
      await this.writeToken<StoredToken<EmporixAnonymousTokenResponse>, EmporixAnonymousTokenResponse>(
        'anonymous',
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
    return this.writeToken('anonymous', undefined, tenant);
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
        'customer',
        customerToken,
        tenant,
      );
    } else {
      customerToken = await this.readToken<StoredToken<EmporixCustomerTokenResponse>, EmporixCustomerTokenResponse>(
        'customer',
        tenant,
      );
      // Check if token is expired or about to expire (within 5 minutes)
      if (!this.checkAccessToken(customerToken)) {
        customerToken = await this.refreshCustomerToken(customerToken, tenant);
        await this.writeToken<StoredToken<EmporixCustomerTokenResponse>, EmporixCustomerTokenResponse>(
          'customer',
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
  ) {
    let response;
    // try refresh token first
    if (customerToken && checkTokenValidity(customerToken.token.refresh_token, customerToken.refreshExpiryAt)) {
      response = await this.oauthApi.refreshCustomerToken(
        tenant,
        customerToken.token.access_token,
        customerToken.token.refresh_token!,
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
    return this.writeToken('customer', undefined, tenant);
  }

  public async getServiceAccessToken(
    tenant: string,
    clientId: string,
    clientSecret: string,
    scopes?: string[],
  ): Promise<string> {
    let serviceToken = await this.readToken<StoredToken<EmporixAccessTokenResponse>, EmporixAccessTokenResponse>(
      'service',
      tenant,
    );
    // Check if token is expired or about to expire (within 5 minutes)
    if (!this.checkAccessToken(serviceToken)) {
      const response = await this.oauthApi.getServiceAccessToken(tenant, clientId, clientSecret, scopes);
      serviceToken = {
        token: response,
        expiryAt: Date.now() + response.expires_in * 1000,
      };
      await this.writeToken<StoredToken<EmporixAccessTokenResponse>, EmporixAccessTokenResponse>(
        'service',
        serviceToken,
        tenant,
      );
    }
    return serviceToken!.token.access_token;
  }

  protected async readToken<T extends StoredToken<K>, K>(
    type: 'anonymous' | 'customer' | 'service',
    tenant: string,
  ): Promise<T | undefined> {
    const tokens = await this.readTokens(tenant);
    switch (type) {
      case 'anonymous':
        return tokens.anonymousToken as T;
      case 'customer':
        return tokens.customerToken as T;
      case 'service':
        return tokens.serviceToken as T;
    }
  }

  protected async writeToken<T extends StoredToken<K>, K>(
    type: 'anonymous' | 'customer' | 'service',
    token: T | undefined,
    tenant: string,
  ): Promise<void> {
    const tokenStore: TokenStore = await this.readTokens(tenant);
    switch (type) {
      case 'anonymous':
        tokenStore.anonymousToken = token as StoredToken<EmporixAnonymousTokenResponse>;
        break;
      case 'customer':
        tokenStore.customerToken = token as StoredToken<EmporixCustomerTokenResponse>;
        break;
      case 'service':
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
