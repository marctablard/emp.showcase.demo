import type { Country } from '@/platform/services/model/common';

const COLLATOR_OPTIONS: Intl.CollatorOptions = { sensitivity: 'base' };

function displayLabel(country: Country, localizeName: (name: Country['name']) => string): string {
  return localizeName(country.name) || country.code;
}

/**
 * Returns a new array of countries ordered by the localized display label.
 * Does not mutate the input. When labels compare equal, ties break on `code`.
 */
export function sortCountriesByDisplayName(
  countries: readonly Country[],
  locale: string,
  localizeName: (name: Country['name']) => string,
): Country[] {
  return [...countries].sort((left, right) => {
    const nameComparison = displayLabel(left, localizeName).localeCompare(
      displayLabel(right, localizeName),
      locale,
      COLLATOR_OPTIONS,
    );

    if (nameComparison !== 0) {
      return nameComparison;
    }

    return left.code.localeCompare(right.code, locale, COLLATOR_OPTIONS);
  });
}
