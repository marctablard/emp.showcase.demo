import { cartTaxCountryWrite, readCartTaxCountry } from './cart-tax-country';

describe('cart-tax-country', () => {
  it('normalizes cart tax country to uppercase trimmed ISO codes', () => {
    expect(readCartTaxCountry({ countryCode: ' de ' })).toBe('DE');
    expect(readCartTaxCountry({})).toBe('');
    expect(readCartTaxCountry({ countryCode: undefined })).toBe('');
  });

  it('writes countryCode for cart create/PATCH payloads', () => {
    expect(cartTaxCountryWrite('CH')).toEqual({ countryCode: 'CH' });
  });
});
