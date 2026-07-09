import {
  buildAssistedBuyingProcessUrl,
  buildAssistedBuyingReturnUrl,
  consumeAssistedBuyingSignInPending,
  hasAssistedBuyingTokenParams,
  isAssistedBuyingSignInPending,
  markAssistedBuyingSignInPending,
  parseAssistedBuyingTokenParams,
} from '@/lib/common/assisted-buying';

describe('assisted-buying helpers', () => {
  it('parses canonical Management Dashboard query params', () => {
    const params = new URLSearchParams({
      customerToken: 'access-abc',
      customerTokenExpiresIn: '3600',
      saasToken: 'saas-xyz',
      tenant: 'demo',
    });

    expect(hasAssistedBuyingTokenParams(params)).toBe(true);
    expect(parseAssistedBuyingTokenParams(params)).toEqual({
      accessToken: 'access-abc',
      expiresIn: 3600,
      saasToken: 'saas-xyz',
    });
  });

  it('parses alternate accessToken / expiresIn param names', () => {
    const params = new URLSearchParams({
      accessToken: 'access-abc',
      expiresIn: '3600',
      saasToken: 'saas-xyz',
    });

    expect(parseAssistedBuyingTokenParams(params)).toEqual({
      accessToken: 'access-abc',
      expiresIn: 3600,
      saasToken: 'saas-xyz',
    });
  });

  it('builds the server process URL with returnPath', () => {
    const params = new URLSearchParams({
      customerToken: 'token',
      customerTokenExpiresIn: '3600',
      saasToken: 'saas',
      tenant: 'demo',
    });

    const url = buildAssistedBuyingProcessUrl('http://localhost:3000', params, '/hasco/en');
    expect(url.pathname).toBe('/api/auth/assisted-buying/process');
    expect(url.searchParams.get('customerToken')).toBe('token');
    expect(url.searchParams.get('returnPath')).toBe('/hasco/en');
    expect(url.searchParams.get('tenant')).toBe('demo');
  });

  it('builds a clean return URL without token params', () => {
    const params = new URLSearchParams({
      customerToken: 'token',
      customerTokenExpiresIn: '3600',
      saasToken: 'saas',
      tenant: 'demo',
    });

    const url = buildAssistedBuyingReturnUrl('http://localhost:3000', '/', params);
    expect(url.pathname).toBe('/');
    expect(url.searchParams.has('customerToken')).toBe(false);
    expect(url.searchParams.get('tenant')).toBe('demo');
    expect(url.searchParams.has('abSignIn')).toBe(false);
  });

  it('adds abSignIn when client fallback is required', () => {
    const params = new URLSearchParams({
      customerToken: 'token',
      customerTokenExpiresIn: '3600',
      saasToken: 'saas',
    });

    const url = buildAssistedBuyingReturnUrl('http://localhost:3000', '/', params, {
      requireClientSignIn: true,
    });
    expect(url.searchParams.get('abSignIn')).toBe('1');
  });

  it('tracks same-request assisted buying sign-in pending state', () => {
    expect(isAssistedBuyingSignInPending()).toBe(false);
    markAssistedBuyingSignInPending();
    expect(isAssistedBuyingSignInPending()).toBe(true);
    expect(consumeAssistedBuyingSignInPending()).toBe(true);
    expect(isAssistedBuyingSignInPending()).toBe(false);
    expect(consumeAssistedBuyingSignInPending()).toBe(false);
  });
});
