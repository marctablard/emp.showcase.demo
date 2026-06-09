import { injectable } from '@/platform/core/di/injectable';
import { decryptOrParseLegacy, encryptClientPayload } from '../util/token-encryption-client';
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
    const tokenStoreString: string | null = localStorage.getItem(this.buildStorageKey(tenant));
    if (!tokenStoreString) {
      return {};
    }
    try {
      const decrypted = await decryptOrParseLegacy(tokenStoreString, tenant);
      const tokenStore: TokenStore = JSON.parse(decrypted);
      return tokenStore;
    } catch {
      return {};
    }
  }

  protected async writeTokens(tokens: TokenStore, tenant: string): Promise<void> {
    const encrypted = await encryptClientPayload(JSON.stringify(tokens), tenant);
    localStorage.setItem(this.buildStorageKey(tenant), encrypted);
  }

  /**
   * Clear all stored tokens
   */
  clearTokens(tenant: string): void {
    localStorage.removeItem(this.buildStorageKey(tenant));
  }
}
export default EmporixTokenManagerClient;
