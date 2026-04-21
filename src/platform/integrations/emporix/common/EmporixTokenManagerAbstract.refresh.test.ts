import type { StoredToken } from '@platform/integrations/types/auth';
import type { EmporixCustomerTokenResponse } from '../model/oauth';
import type { EmporixOAuthApi } from '../oauth/EmporixOAuthApi';
import { EmporixTestTokenManager } from './impl/EmporixTokenManager.test';
import { EMPORIX_TOKEN_TYPE } from './token-types';

class SeedableTokenManager extends EmporixTestTokenManager {
  public async seedCustomerToken(tenant: string, token: StoredToken<EmporixCustomerTokenResponse>): Promise<void> {
    await this.writeToken(EMPORIX_TOKEN_TYPE.CUSTOMER, token, tenant);
  }
}

function buildStoredCustomerToken(saasToken: string): StoredToken<EmporixCustomerTokenResponse> {
  const now = Date.now();
  return {
    token: {
      access_token: 'expired-access',
      refresh_token: 'valid-refresh',
      expires_in: 3600,
      refresh_token_expires_in: 86_400,
      session_id: 'session-1',
      saas_token: saasToken,
      token_type: 'Bearer',
      scope: 'test',
    },
    expiryAt: now - 60_000,
    refreshExpiryAt: now + 3_600_000,
  };
}

describe('EmporixTokenManagerAbstract customer refresh', () => {
  const tenant = 't1';
  const clientId = 'cid';

  it('preserves saas_token when refresh response omits it', async () => {
    const oauthApi = {
      refreshCustomerToken: jest.fn().mockResolvedValue({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'test',
      }),
    } as unknown as EmporixOAuthApi;

    const tm = new SeedableTokenManager(oauthApi);
    await tm.seedCustomerToken(tenant, buildStoredCustomerToken('saas-from-login'));

    const out = await tm.getCustomerToken(tenant, clientId);

    expect(out?.saasToken).toBe('saas-from-login');
    expect(oauthApi.refreshCustomerToken).toHaveBeenCalled();
  });

  it('preserves saas_token when refresh returns null', async () => {
    const oauthApi = {
      refreshCustomerToken: jest.fn().mockResolvedValue({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'test',
        saas_token: null,
      } as unknown as EmporixCustomerTokenResponse),
    } as unknown as EmporixOAuthApi;

    const tm = new SeedableTokenManager(oauthApi);
    await tm.seedCustomerToken(tenant, buildStoredCustomerToken('saas-persist'));

    const out = await tm.getCustomerToken(tenant, clientId);

    expect(out?.saasToken).toBe('saas-persist');
  });

  it('uses saas_token from refresh when present', async () => {
    const oauthApi = {
      refreshCustomerToken: jest.fn().mockResolvedValue({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'test',
        saas_token: 'saas-from-refresh',
      } as EmporixCustomerTokenResponse),
    } as unknown as EmporixOAuthApi;

    const tm = new SeedableTokenManager(oauthApi);
    await tm.seedCustomerToken(tenant, buildStoredCustomerToken('saas-old'));

    const out = await tm.getCustomerToken(tenant, clientId);

    expect(out?.saasToken).toBe('saas-from-refresh');
  });
});
