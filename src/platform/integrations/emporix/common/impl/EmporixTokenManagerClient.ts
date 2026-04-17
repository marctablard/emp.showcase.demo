import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type { TokenStore } from './EmporixTokenManagerAbstract';
import { EmporixTokenManagerAbstract } from './EmporixTokenManagerAbstract';

/**
 * TokenManager for handling Emporix API tokens
 * Manages token caching and refreshing
 */
@injectable('EmporixTokenManager', 'Singleton')
class EmporixTokenManagerClient extends EmporixTokenManagerAbstract {
  protected async customerAuthAllowed(): Promise<boolean> {
    return true;
  }

  protected async readTokens(tenant: string): Promise<TokenStore> {
    const tokenStoreString: string | null = this.buildStorageKey(tenant);
    if (!tokenStoreString) {
      return Promise.resolve({});
    }
    const tokenStore: TokenStore = JSON.parse(tokenStoreString);
    return tokenStore;
  }

  protected async writeTokens(tokens: TokenStore, tenant: string): Promise<void> {
    localStorage.setItem(this.buildStorageKey(tenant), JSON.stringify(tokens));
  }

  /**
   * Clear all stored tokens
   */
  clearTokens(tenant: string): void {
    localStorage.removeItem(this.buildStorageKey(tenant));
  }
}
export default EmporixTokenManagerClient;
