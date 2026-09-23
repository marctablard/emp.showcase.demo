import { NextResponse } from 'next/server';
import { CURRENCY_COOKIE_NAME } from '@/lib/common/cookie-names';
import { CURRENCY_PREFERENCE_MAX_AGE_SECONDS, syncCurrencyCookie, writeCurrencyCookie } from './currency-cookie';

describe('currency cookie', () => {
  it('writes the session currency onto next-currency', () => {
    const response = NextResponse.json({ ok: true });
    writeCurrencyCookie(response, 'usd');

    const cookie = response.cookies.get(CURRENCY_COOKIE_NAME);
    expect(cookie?.value).toBe('USD');
    expect(cookie?.maxAge).toBe(CURRENCY_PREFERENCE_MAX_AGE_SECONDS);
    expect(cookie?.httpOnly).toBe(false);
    expect(cookie?.path).toBe('/');
  });

  it('rewrites a cookie that disagrees with the session', () => {
    const response = NextResponse.json({ ok: true });
    syncCurrencyCookie(response, 'EUR', 'USD');

    expect(response.cookies.get(CURRENCY_COOKIE_NAME)?.value).toBe('EUR');
  });

  it('leaves a cookie that already matches the session', () => {
    const response = NextResponse.json({ ok: true });
    syncCurrencyCookie(response, 'eur', 'EUR');

    expect(response.cookies.get(CURRENCY_COOKIE_NAME)).toBeUndefined();
  });

  it('does not write a cookie when the session has no currency', () => {
    const response = NextResponse.json({ ok: true });
    syncCurrencyCookie(response, undefined, 'USD');

    expect(response.cookies.get(CURRENCY_COOKIE_NAME)).toBeUndefined();
  });
});
