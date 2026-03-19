import { isCartMergeFallback, stripAuthNotificationQueryParams } from './auth-notification-utils';

describe('auth-notification-utils', () => {
  it('removes login query param and keeps site-prefixed canonical path', () => {
    const result = stripAuthNotificationQueryParams('http://localhost:3000/us-branch/account?login=success');
    expect(result).toBe('/us-branch/account');
  });

  it('removes auth query params but preserves unrelated params and hash', () => {
    const result = stripAuthNotificationQueryParams(
      'http://localhost:3000/account?foo=1&login=success&error=CredentialsSignin#section-2',
    );
    expect(result).toBe('/account?foo=1#section-2');
  });

  it('returns true only for fallback cart merge status', () => {
    expect(isCartMergeFallback('FALLBACK')).toBe(true);
    expect(isCartMergeFallback('MERGED')).toBe(false);
    expect(isCartMergeFallback(undefined)).toBe(false);
  });
});
