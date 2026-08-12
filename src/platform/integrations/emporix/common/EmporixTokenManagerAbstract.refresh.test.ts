import type { StoredToken } from '@platform/integrations/types/auth';
import type { EmporixAnonymousTokenResponse, EmporixCustomerTokenResponse } from '../model/oauth';
import type { EmporixOAuthApi } from '../oauth/EmporixOAuthApi';
import { EmporixTestTokenManager } from './impl/EmporixTokenManager.test';
import { EMPORIX_TOKEN_TYPE } from './token-types';

class SeedableTokenManager extends EmporixTestTokenManager {
  public async seedCustomerToken(tenant: string, token: StoredToken<EmporixCustomerTokenResponse>): Promise<void> {
    await this.writeToken(EMPORIX_TOKEN_TYPE.CUSTOMER, token, tenant);
  }

  public async seedAnonymousToken(tenant: string, token: StoredToken<EmporixAnonymousTokenResponse>): Promise<void> {
    await this.writeToken(EMPORIX_TOKEN_TYPE.ANONYMOUS, token, tenant);
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

function buildStoredAnonymousToken(accessToken = 'anon-access'): StoredToken<EmporixAnonymousTokenResponse> {
  const now = Date.now();
  return {
    token: {
      access_token: accessToken,
      refresh_token: 'anon-refresh',
      expires_in: 3600,
      refresh_token_expires_in: 86_400,
      session_id: 'anon-session',
      token_type: 'Bearer',
      scope: 'test',
    },
    expiryAt: now + 3_600_000,
    refreshExpiryAt: now + 3_600_000,
  };
}

describe('EmporixTokenManagerAbstract customer refresh', () => {
  const tenant = 't1';
  const clientId = 'cid';

  function buildOauthApi(
    refreshResult: Partial<EmporixCustomerTokenResponse> & {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    },
  ): EmporixOAuthApi {
    return {
      getAnonymousToken: jest.fn().mockResolvedValue({
        access_token: 'anon-from-oauth',
        refresh_token: 'anon-refresh',
        expires_in: 3600,
        session_id: 'anon-session',
        token_type: 'Bearer',
        scope: 'test',
      }),
      refreshAnonymousToken: jest.fn(),
      refreshCustomerToken: jest.fn().mockResolvedValue({
        token_type: 'Bearer',
        scope: 'test',
        ...refreshResult,
      }),
    } as unknown as EmporixOAuthApi;
  }

  it('preserves saas_token when refresh response omits it', async () => {
    const oauthApi = buildOauthApi({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600,
    });

    const tm = new SeedableTokenManager(oauthApi);
    await tm.seedAnonymousToken(tenant, buildStoredAnonymousToken());
    await tm.seedCustomerToken(tenant, buildStoredCustomerToken('saas-from-login'));

    const out = await tm.getCustomerToken(tenant, clientId);

    expect(out?.saasToken).toBe('saas-from-login');
    expect(oauthApi.refreshCustomerToken).toHaveBeenCalledWith(tenant, 'anon-access', 'valid-refresh', undefined);
  });

  it('preserves saas_token when refresh returns null', async () => {
    const oauthApi = buildOauthApi({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600,
      saas_token: null,
    } as unknown as Partial<EmporixCustomerTokenResponse> & {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    });

    const tm = new SeedableTokenManager(oauthApi);
    await tm.seedAnonymousToken(tenant, buildStoredAnonymousToken());
    await tm.seedCustomerToken(tenant, buildStoredCustomerToken('saas-persist'));

    const out = await tm.getCustomerToken(tenant, clientId);

    expect(out?.saasToken).toBe('saas-persist');
  });

  it('uses saas_token from refresh when present', async () => {
    const oauthApi = buildOauthApi({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600,
      saas_token: 'saas-from-refresh',
    });

    const tm = new SeedableTokenManager(oauthApi);
    await tm.seedAnonymousToken(tenant, buildStoredAnonymousToken());
    await tm.seedCustomerToken(tenant, buildStoredCustomerToken('saas-old'));

    const out = await tm.getCustomerToken(tenant, clientId);

    expect(out?.saasToken).toBe('saas-from-refresh');
  });

  it('authorizes refreshauthtoken with anonymous access token, not expired customer access', async () => {
    const oauthApi = buildOauthApi({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600,
    });

    const tm = new SeedableTokenManager(oauthApi);
    await tm.seedAnonymousToken(tenant, buildStoredAnonymousToken('fresh-anon'));
    await tm.seedCustomerToken(tenant, buildStoredCustomerToken('saas'));

    await tm.getCustomerToken(tenant, clientId);

    expect(oauthApi.refreshCustomerToken).toHaveBeenCalledWith(tenant, 'fresh-anon', 'valid-refresh', undefined);
    expect(oauthApi.refreshCustomerToken).not.toHaveBeenCalledWith(
      tenant,
      'expired-access',
      expect.anything(),
      expect.anything(),
    );
  });

  it('forceRefreshSessionToken remints anonymous then refreshes customer', async () => {
    const oauthApi = {
      getAnonymousToken: jest.fn().mockResolvedValue({
        access_token: 'anon-reminted',
        refresh_token: 'anon-refresh-2',
        expires_in: 3600,
        session_id: 'anon-session-2',
        token_type: 'Bearer',
        scope: 'test',
      }),
      refreshAnonymousToken: jest.fn().mockResolvedValue({
        access_token: 'anon-refreshed',
        refresh_token: 'anon-refresh-2',
        expires_in: 3600,
        session_id: 'anon-session',
        token_type: 'Bearer',
        scope: 'test',
      }),
      refreshCustomerToken: jest.fn().mockResolvedValue({
        access_token: 'customer-refreshed',
        refresh_token: 'customer-refresh-2',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'test',
        saas_token: 'saas-refreshed',
      }),
    } as unknown as EmporixOAuthApi;

    const tm = new SeedableTokenManager(oauthApi);
    const stillValidCustomer = buildStoredCustomerToken('saas');
    stillValidCustomer.expiryAt = Date.now() + 3_600_000;
    stillValidCustomer.token.access_token = 'still-cached-customer';
    await tm.seedAnonymousToken(tenant, buildStoredAnonymousToken('stale-anon'));
    await tm.seedCustomerToken(tenant, stillValidCustomer);

    const out = await tm.forceRefreshSessionToken(tenant, clientId);

    expect(out.accessToken).toBe('customer-refreshed');
    expect(out.saasToken).toBe('saas-refreshed');
    expect(oauthApi.refreshAnonymousToken).toHaveBeenCalled();
    expect(oauthApi.refreshCustomerToken).toHaveBeenCalledWith(tenant, 'anon-refreshed', 'valid-refresh', undefined);
  });
});
