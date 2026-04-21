import type { EmporixAccessTokenResponse } from '../model/oauth';
import type { EmporixOAuthApi } from '../oauth/EmporixOAuthApi';
import { EmporixTestTokenManager } from './impl/EmporixTokenManager.test';
import { SERVICE_TOKEN_CACHE_KEY } from './impl/EmporixTokenManagerAbstract';

function buildAccessTokenResponse(accessToken: string, expiresIn = 3600): EmporixAccessTokenResponse {
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    scope: 'test',
  } as EmporixAccessTokenResponse;
}

function resetServiceTokenCache(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  delete g[SERVICE_TOKEN_CACHE_KEY];
}

describe('EmporixTokenManagerAbstract service-token cache', () => {
  const tenant = 'tenant-a';
  const clientId = 'client-a';
  const clientSecret = 'secret-1';

  beforeEach(() => {
    resetServiceTokenCache();
    jest.useRealTimers();
  });

  afterEach(() => {
    resetServiceTokenCache();
    jest.useRealTimers();
  });

  it('serves cached token on repeat call with identical key (single upstream mint)', async () => {
    const oauthApi = {
      getServiceAccessToken: jest.fn().mockResolvedValue(buildAccessTokenResponse('token-1')),
    } as unknown as EmporixOAuthApi;

    const tm = new EmporixTestTokenManager(oauthApi);

    const first = await tm.getServiceAccessToken(tenant, clientId, clientSecret);
    const second = await tm.getServiceAccessToken(tenant, clientId, clientSecret);

    expect(first).toBe('token-1');
    expect(second).toBe('token-1');
    expect(oauthApi.getServiceAccessToken).toHaveBeenCalledTimes(1);
  });

  it('issues a fresh mint when clientSecret rotates', async () => {
    const oauthApi = {
      getServiceAccessToken: jest
        .fn()
        .mockResolvedValueOnce(buildAccessTokenResponse('token-old'))
        .mockResolvedValueOnce(buildAccessTokenResponse('token-new')),
    } as unknown as EmporixOAuthApi;

    const tm = new EmporixTestTokenManager(oauthApi);

    const first = await tm.getServiceAccessToken(tenant, clientId, 'secret-old');
    const second = await tm.getServiceAccessToken(tenant, clientId, 'secret-new');

    expect(first).toBe('token-old');
    expect(second).toBe('token-new');
    expect(oauthApi.getServiceAccessToken).toHaveBeenCalledTimes(2);
  });

  it('dedupes concurrent callers into a single upstream mint', async () => {
    let resolveFn: ((value: EmporixAccessTokenResponse) => void) | undefined;
    const deferred = new Promise<EmporixAccessTokenResponse>((resolve) => {
      resolveFn = resolve;
    });
    const oauthApi = {
      getServiceAccessToken: jest.fn().mockReturnValue(deferred),
    } as unknown as EmporixOAuthApi;

    const tm = new EmporixTestTokenManager(oauthApi);

    const p1 = tm.getServiceAccessToken(tenant, clientId, clientSecret);
    const p2 = tm.getServiceAccessToken(tenant, clientId, clientSecret);

    resolveFn?.(buildAccessTokenResponse('token-shared'));
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toBe('token-shared');
    expect(r2).toBe('token-shared');
    expect(oauthApi.getServiceAccessToken).toHaveBeenCalledTimes(1);
  });

  it('does not poison cache when upstream fetch fails', async () => {
    const error = new Error('upstream 500');
    const oauthApi = {
      getServiceAccessToken: jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(buildAccessTokenResponse('token-after-retry')),
    } as unknown as EmporixOAuthApi;

    const tm = new EmporixTestTokenManager(oauthApi);

    await expect(tm.getServiceAccessToken(tenant, clientId, clientSecret)).rejects.toBe(error);

    const retry = await tm.getServiceAccessToken(tenant, clientId, clientSecret);
    expect(retry).toBe('token-after-retry');
    expect(oauthApi.getServiceAccessToken).toHaveBeenCalledTimes(2);
  });

  it('remints after the cached token expires (TTL - safety margin)', async () => {
    const oauthApi = {
      getServiceAccessToken: jest
        .fn()
        .mockResolvedValueOnce(buildAccessTokenResponse('token-1', 3600))
        .mockResolvedValueOnce(buildAccessTokenResponse('token-2', 3600)),
    } as unknown as EmporixOAuthApi;

    const tm = new EmporixTestTokenManager(oauthApi);

    const realNow = Date.now;
    const nowSpy = jest.spyOn(Date, 'now');
    const t0 = realNow.call(Date);
    nowSpy.mockReturnValue(t0);

    const first = await tm.getServiceAccessToken(tenant, clientId, clientSecret);
    expect(first).toBe('token-1');

    // Advance past expiresAt (expires_in = 3600s, safety margin 60s → 3540s).
    nowSpy.mockReturnValue(t0 + 3541 * 1000);

    const second = await tm.getServiceAccessToken(tenant, clientId, clientSecret);
    expect(second).toBe('token-2');
    expect(oauthApi.getServiceAccessToken).toHaveBeenCalledTimes(2);

    nowSpy.mockRestore();
  });

  it('normalizes scope order so same scopes in different order share an entry', async () => {
    const oauthApi = {
      getServiceAccessToken: jest.fn().mockResolvedValue(buildAccessTokenResponse('token-scoped')),
    } as unknown as EmporixOAuthApi;

    const tm = new EmporixTestTokenManager(oauthApi);

    await tm.getServiceAccessToken(tenant, clientId, clientSecret, ['b', 'a']);
    await tm.getServiceAccessToken(tenant, clientId, clientSecret, ['a', 'b']);

    expect(oauthApi.getServiceAccessToken).toHaveBeenCalledTimes(1);
  });

  it('clearServiceTokenCache forces the next call to mint a new token', async () => {
    const oauthApi = {
      getServiceAccessToken: jest
        .fn()
        .mockResolvedValueOnce(buildAccessTokenResponse('token-1'))
        .mockResolvedValueOnce(buildAccessTokenResponse('token-2')),
    } as unknown as EmporixOAuthApi;

    const tm = new EmporixTestTokenManager(oauthApi);

    const first = await tm.getServiceAccessToken(tenant, clientId, clientSecret);
    tm.clearServiceTokenCache(tenant, clientId, clientSecret);
    const second = await tm.getServiceAccessToken(tenant, clientId, clientSecret);

    expect(first).toBe('token-1');
    expect(second).toBe('token-2');
    expect(oauthApi.getServiceAccessToken).toHaveBeenCalledTimes(2);
  });
});
