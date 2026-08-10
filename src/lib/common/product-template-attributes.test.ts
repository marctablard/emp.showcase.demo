import { formatDate } from '@/lib/date-utils';
import {
  PRODUCT_TEMPLATE_ATTRIBUTE_TYPE,
  formatTemplateAttributeValue,
  orderedTemplateAttributeEntries,
  parseBooleanTemplateAttributeValue,
  resolveTemplateAttributeLabel,
} from './product-template-attributes';

describe('formatTemplateAttributeValue', () => {
  it('formats DATETIME values with the shared date formatter', () => {
    // Midday UTC avoids locale-offset day shifts in CI.
    expect(
      formatTemplateAttributeValue('2026-08-18T12:00:00.000Z', PRODUCT_TEMPLATE_ATTRIBUTE_TYPE.DATETIME, 'en-US'),
    ).toBe(formatDate('2026-08-18T12:00:00.000Z', 'en-US'));
  });

  it('formats ISO datetime strings even when type meta is missing', () => {
    expect(formatTemplateAttributeValue('2026-08-18T22:00:00.000Z', undefined, 'en-US')).toBe(
      formatDate('2026-08-18T22:00:00.000Z', 'en-US'),
    );
  });

  it('leaves non-date types unchanged', () => {
    expect(formatTemplateAttributeValue('value 4', PRODUCT_TEMPLATE_ATTRIBUTE_TYPE.TEXT, 'en-US')).toBe('value 4');
    expect(formatTemplateAttributeValue('1705', PRODUCT_TEMPLATE_ATTRIBUTE_TYPE.NUMBER, 'de-DE')).toBe('1705');
  });
});

describe('resolveTemplateAttributeLabel', () => {
  const l10n = (value: { en?: string } | string): string => (typeof value === 'string' ? value : (value.en ?? ''));

  it('prefers localized template attribute names from the BE', () => {
    expect(resolveTemplateAttributeLabel('date-attribute', { 'date-attribute': { en: 'Date attribute' } }, l10n)).toBe(
      'Date attribute',
    );
  });

  it('falls back to the attribute key when labels are missing', () => {
    expect(resolveTemplateAttributeLabel('pick-a-list-optional', undefined, l10n)).toBe('pick-a-list-optional');
  });
});

describe('parseBooleanTemplateAttributeValue', () => {
  it('parses BOOLEAN-typed true/false case-insensitively', () => {
    expect(parseBooleanTemplateAttributeValue('True', PRODUCT_TEMPLATE_ATTRIBUTE_TYPE.BOOLEAN)).toBe(true);
    expect(parseBooleanTemplateAttributeValue('FALSE', PRODUCT_TEMPLATE_ATTRIBUTE_TYPE.BOOLEAN)).toBe(false);
  });

  it('parses true/false literals when type meta is missing', () => {
    expect(parseBooleanTemplateAttributeValue('true', undefined)).toBe(true);
    expect(parseBooleanTemplateAttributeValue('false', undefined)).toBe(false);
  });

  it('does not coerce non-BOOLEAN typed values', () => {
    expect(parseBooleanTemplateAttributeValue('true', PRODUCT_TEMPLATE_ATTRIBUTE_TYPE.TEXT)).toBeUndefined();
    expect(parseBooleanTemplateAttributeValue('false', PRODUCT_TEMPLATE_ATTRIBUTE_TYPE.NUMBER)).toBeUndefined();
  });
});

describe('orderedTemplateAttributeEntries', () => {
  it('returns empty for missing templateAttributes', () => {
    expect(orderedTemplateAttributeEntries(undefined, ['a'])).toEqual([]);
  });

  it('follows Product Templates attributes[] order, not A–Z or object key order', () => {
    // Keys inserted alphabetically so raw Object.entries would be A→Z if order were ignored.
    const attrs = {
      zebra: 'z',
      alpha: 'a',
      middle: 'm',
    };
    expect(orderedTemplateAttributeEntries(attrs, ['middle', 'zebra', 'alpha'])).toEqual([
      ['middle', 'm'],
      ['zebra', 'z'],
      ['alpha', 'a'],
    ]);
  });

  it('skips order keys absent from the mixin map and ignores duplicates in order', () => {
    expect(
      orderedTemplateAttributeEntries({ width: '10', length: '20' }, ['length', 'missing', 'length', 'width']),
    ).toEqual([
      ['length', '20'],
      ['width', '10'],
    ]);
  });

  it('appends mixin-only keys after order, preserving map insertion order', () => {
    const attrs = { width: '10', extra: 'x', length: '20' };
    expect(orderedTemplateAttributeEntries(attrs, ['length'])).toEqual([
      ['length', '20'],
      ['width', '10'],
      ['extra', 'x'],
    ]);
  });

  it('falls back to Object.entries order when order is missing', () => {
    const attrs = { first: '1', second: '2' };
    expect(orderedTemplateAttributeEntries(attrs)).toEqual([
      ['first', '1'],
      ['second', '2'],
    ]);
  });
});
