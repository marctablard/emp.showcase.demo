import type { FilterValue } from '@/platform/services/model/common';

/**
 * Checks if filter values have units of measurement (e.g., '10 kg')
 */
export function hasUnitOfMeasurement(values: FilterValue[]): boolean {
  return values.some(({ name }) => name && /\d+\s?\w+/i.test(name || ''));
}

/**
 * Checks if filter values represent a numeric range
 */
export function isNumberRange(values: FilterValue[]): boolean {
  return (
    values.length > 1 &&
    values.some(({ name }) => {
      return name && /\d+/i.test(name || '');
    })
  );
}

/**
 * Checks if filter is a pricing filter
 */
export function isSelect(name: string): boolean {
  return !/(^|\.)(prices|price)\.effectiveAmount$/i.test(name);
}

export function getFilterLabelFallback(name: string): string {
  if (/(^|\.)(prices|price)\.effectiveAmount$/i.test(name)) {
    return 'Price';
  }

  if (/category/i.test(name)) {
    return 'Category';
  }

  if (/brand\.name$/i.test(name)) {
    return 'Brand';
  }

  if (/availability\.available$/i.test(name)) {
    return 'Availability';
  }

  const normalized = name
    .split('.')
    .filter(Boolean)
    .filter((segment) => !/^_[a-z]/i.test(segment))
    .filter((segment) => !/^[a-z]{2}(-[a-z]+)?$/i.test(segment))
    .filter((segment) => !/^[A-Z]{2}$/.test(segment))
    .filter((segment) => !/^[a-z]+-branch$/i.test(segment));

  const source = normalized.length > 0 ? normalized[normalized.length - 1] : name;
  return source
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase());
}

/**
 * Extracts unit from a value name (e.g., '10 kg' -> 'kg')
 */
export function extractUnit(name: string): string {
  const match = name.match(/\d+\s?(\w+)/i);
  return match ? match[1] : '';
}

/**
 * Gets minimum and maximum values for range sliders
 */
export function getMinMaxValues(values: FilterValue[]): [number, number] {
  const sorted = values
    .map(({ name }) => Number(name?.match(/\d+/)?.[0]))
    .filter((val) => !isNaN(val))
    .sort((a, b) => a - b);

  if (sorted.length === 0) {
    return [0, 100]; // Default range if no valid values
  }

  return [sorted[0], sorted[sorted.length - 1]];
}
