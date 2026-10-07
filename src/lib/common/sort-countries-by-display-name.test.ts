import type { Country } from '@/platform/services/model/common';
import { sortCountriesByDisplayName } from './sort-countries-by-display-name';

function localizeByLocale(locale: string) {
  return (name: Country['name']): string => {
    if (typeof name === 'string') {
      return name;
    }
    return name[locale] ?? '';
  };
}

const DACH_LOCALIZED: Country[] = [
  { code: 'DE', name: { en: 'Germany', de: 'Deutschland' } },
  { code: 'CH', name: { en: 'Switzerland', de: 'Schweiz' } },
  { code: 'AT', name: { en: 'Austria', de: 'Österreich' } },
];

describe('sortCountriesByDisplayName', () => {
  it('returns an empty array for empty input', () => {
    expect(sortCountriesByDisplayName([], 'en', localizeByLocale('en'))).toEqual([]);
  });

  it('copies before sorting so the input array order is unchanged', () => {
    const countries: Country[] = [
      { code: 'DE', name: 'Germany' },
      { code: 'AT', name: 'Austria' },
      { code: 'CH', name: 'Switzerland' },
    ];
    const originalOrder = countries.map((country) => country.code);

    const sorted = sortCountriesByDisplayName(countries, 'en', localizeByLocale('en'));

    expect(countries.map((country) => country.code)).toEqual(originalOrder);
    expect(sorted.map((country) => country.code)).toEqual(['AT', 'DE', 'CH']);
    expect(sorted).not.toBe(countries);
  });

  it('sorts string names with localeCompare', () => {
    const countries: Country[] = [
      { code: 'CH', name: 'Switzerland' },
      { code: 'DE', name: 'Germany' },
      { code: 'AT', name: 'Austria' },
    ];

    expect(sortCountriesByDisplayName(countries, 'en', localizeByLocale('en')).map((country) => country.code)).toEqual([
      'AT',
      'DE',
      'CH',
    ]);
  });

  it('sorts LocalizedString maps by English labels for locale en', () => {
    expect(
      sortCountriesByDisplayName(DACH_LOCALIZED, 'en', localizeByLocale('en')).map((country) => country.code),
    ).toEqual(['AT', 'DE', 'CH']);
  });

  it('sorts LocalizedString maps by German labels for locale de', () => {
    expect(
      sortCountriesByDisplayName(DACH_LOCALIZED, 'de', localizeByLocale('de')).map((country) => country.code),
    ).toEqual(['DE', 'AT', 'CH']);
  });

  it('falls back to country.code when localizeName is empty', () => {
    const countries: Country[] = [
      { code: 'ZW', name: 'Zimbabwe' },
      { code: 'DE', name: 'Germany' },
      { code: 'AT', name: 'Austria' },
    ];

    expect(sortCountriesByDisplayName(countries, 'en', () => '').map((country) => country.code)).toEqual([
      'AT',
      'DE',
      'ZW',
    ]);
  });

  it('tie-breaks equal display names on code', () => {
    const countries: Country[] = [
      { code: 'ZZ', name: 'Same' },
      { code: 'AA', name: 'Same' },
    ];

    expect(sortCountriesByDisplayName(countries, 'en', localizeByLocale('en')).map((country) => country.code)).toEqual([
      'AA',
      'ZZ',
    ]);
  });
});
