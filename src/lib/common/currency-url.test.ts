import {
  copyStorefrontCurrencyParam,
  isCurrencyAllowedOnSite,
  parseCurrencyQueryParam,
  replaceCurrencySearchParam,
  storefrontCurrencyHrefAfterSwitch,
} from './currency-url';

describe('parseCurrencyQueryParam', () => {
  it('returns an uppercase ISO code', () => {
    expect(parseCurrencyQueryParam('usd')).toBe('USD');
    expect(parseCurrencyQueryParam(' EUR ')).toBe('EUR');
  });

  it('rejects missing or non-ISO values', () => {
    expect(parseCurrencyQueryParam(null)).toBeUndefined();
    expect(parseCurrencyQueryParam('')).toBeUndefined();
    expect(parseCurrencyQueryParam('US')).toBeUndefined();
    expect(parseCurrencyQueryParam('EURO')).toBeUndefined();
    expect(parseCurrencyQueryParam('12$')).toBeUndefined();
  });
});

describe('isCurrencyAllowedOnSite', () => {
  const site = {
    defaultCurrency: { id: 'EUR', code: 'EUR' },
    currencies: [{ id: 'EUR' }, { id: 'USD', code: 'USD' }],
  };

  it('accepts listed id or code', () => {
    expect(isCurrencyAllowedOnSite(site, 'EUR')).toBe(true);
    expect(isCurrencyAllowedOnSite(site, 'USD')).toBe(true);
  });

  it('rejects currencies the site does not list', () => {
    expect(isCurrencyAllowedOnSite(site, 'GBP')).toBe(false);
  });

  it('allows any code when the site has no currency metadata', () => {
    expect(isCurrencyAllowedOnSite({}, 'GBP')).toBe(true);
    expect(isCurrencyAllowedOnSite(undefined, 'GBP')).toBe(true);
  });
});

describe('replaceCurrencySearchParam', () => {
  it('sets currency and keeps other params', () => {
    expect(replaceCurrencySearchParam('/browse', 'q=solar&currency=EUR', 'USD')).toBe('/browse?q=solar&currency=USD');
  });

  it('adds currency when missing', () => {
    expect(replaceCurrencySearchParam('/browse', 'q=solar', 'USD')).toBe('/browse?q=solar&currency=USD');
  });

  it('removes currency when value is null', () => {
    expect(replaceCurrencySearchParam('/browse', '?q=solar&currency=EUR', null)).toBe('/browse?q=solar');
    expect(replaceCurrencySearchParam('/browse', 'currency=EUR', null)).toBe('/browse');
  });
});

describe('copyStorefrontCurrencyParam', () => {
  it('copies an existing currency and ignores absence', () => {
    const to = new URLSearchParams('q=solar');
    copyStorefrontCurrencyParam(new URLSearchParams('currency=USD&q=old'), to);
    expect(to.get('currency')).toBe('USD');
    expect(to.get('q')).toBe('solar');

    const empty = new URLSearchParams('q=solar');
    copyStorefrontCurrencyParam(new URLSearchParams('q=old'), empty);
    expect(empty.get('currency')).toBeNull();
  });
});

describe('storefrontCurrencyHrefAfterSwitch', () => {
  it('returns null when the URL has no currency or already matches', () => {
    expect(storefrontCurrencyHrefAfterSwitch('/browse', 'q=solar', 'USD')).toBeNull();
    expect(storefrontCurrencyHrefAfterSwitch('/browse', 'currency=USD', 'USD')).toBeNull();
  });

  it('rewrites a mismatched storefront currency', () => {
    expect(storefrontCurrencyHrefAfterSwitch('/browse', 'q=solar&currency=EUR', 'USD')).toBe(
      '/browse?q=solar&currency=USD',
    );
  });
});
