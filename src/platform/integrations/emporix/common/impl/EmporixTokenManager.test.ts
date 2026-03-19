import { inject } from 'inversify';
import type { EmporixOAuthApi as OAuthApi } from '../../oauth/EmporixOAuthApi';
import { EmporixTokenManagerAbstract, TokenStore } from './EmporixTokenManagerAbstract';

/**
 * A reusable test implementation of EmporixTokenManager for testing purposes.
 * This class provides a simple in-memory token store and can be used across all tests
 * that require a TokenManager implementation.
 */
export class EmporixTestTokenManager extends EmporixTokenManagerAbstract {
  private tenantStores: Map<string, TokenStore> = new Map();

  constructor(@inject('EmporixOAuthApi') oauthApi: OAuthApi) {
    super(oauthApi);
  }

  protected async readTokens(tenant: string): Promise<TokenStore> {
    return this.tenantStores.get(tenant) || {};
  }

  protected async writeTokens(tokens: TokenStore, tenant: string): Promise<void> {
    this.tenantStores.set(tenant, tokens);
  }

  // Helper method to clear the token store (useful for test cleanup)
  public clearTokens(): void {
    this.tenantStores.clear();
  }
}
