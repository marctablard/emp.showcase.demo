import type { StoredToken } from '@platform/integrations/types/auth';
import type { EmporixCustomerTokenResponse } from '../model/oauth';
import { EmporixTokenManagerAbstract } from './impl/EmporixTokenManagerAbstract';
import { EMPORIX_TOKEN_TYPE } from './token-types';

class AssistedBuyingTokenCacheTestManager extends EmporixTokenManagerAbstract {
  private store: Record<string, unknown> = {};

  public clearTokens(_tenant: string): void {
    this.store = {};
  }

  protected async readTokens(_tenant: string) {
    return {};
  }

  protected async writeTokens(_tokens: unknown, tenant: string): Promise<void> {
    this.store[tenant] = _tokens;
  }

  public async seedAssistedBuyingToken(tenant: string, token: StoredToken<EmporixCustomerTokenResponse>) {
    await this.setAssistedBuyingCustomerToken(tenant, {
      accessToken: token.token.access_token,
      expiresIn: token.token.expires_in,
      saasToken: token.token.saas_token,
      sessionId: token.token.session_id,
    });
  }

  public async readCustomerToken(tenant: string) {
    return this.readToken<StoredToken<EmporixCustomerTokenResponse>, EmporixCustomerTokenResponse>(
      EMPORIX_TOKEN_TYPE.CUSTOMER,
      tenant,
    );
  }
}

describe('EmporixTokenManagerAbstract assisted buying token cache', () => {
  const tenant = 'test-tenant';
  let manager: AssistedBuyingTokenCacheTestManager;

  beforeEach(() => {
    manager = new AssistedBuyingTokenCacheTestManager({} as never);
  });

  it('returns assisted-buying customer token from memory before cookie round-trip', async () => {
    await manager.seedAssistedBuyingToken(tenant, {
      token: {
        access_token: 'assisted-access',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'customer',
        saas_token: 'assisted-saas',
        session_id: '',
      },
      expiryAt: Date.now() + 3600_000,
    });

    const read = await manager.readCustomerToken(tenant);
    expect(read?.token.access_token).toBe('assisted-access');
    expect(read?.token.saas_token).toBe('assisted-saas');
  });

  it('clears assisted-buying cache explicitly', async () => {
    await manager.seedAssistedBuyingToken(tenant, {
      token: {
        access_token: 'assisted-access',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'customer',
        saas_token: 'assisted-saas',
        session_id: '',
      },
      expiryAt: Date.now() + 3600_000,
    });

    manager.clearAssistedBuyingCustomerTokenCache(tenant);
    const read = await manager.readCustomerToken(tenant);
    expect(read).toBeUndefined();
  });
});
