import { formatDate } from '@/lib/date-utils';
import { L10N_MISSING_LABEL } from '@/lib/l10n';
import {
  PRODUCT_TEMPLATE_ATTRIBUTE_TYPE,
  formatTemplateAttributeValue,
  isPlaceholderAttributeLabel,
  orderedTemplateAttributeEntries,
  parseBooleanTemplateAttributeValue,
  resolveTemplateAttributeLabel,
  resolveVariantAttributeLabel,
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

  it('formats NUMBER values with the locale number formatter', () => {
    expect(formatTemplateAttributeValue('2342423', PRODUCT_TEMPLATE_ATTRIBUTE_TYPE.NUMBER, 'en-US')).toBe('2,342,423');
    expect(formatTemplateAttributeValue('2342423', PRODUCT_TEMPLATE_ATTRIBUTE_TYPE.NUMBER, 'de-DE')).toBe('2.342.423');
    expect(formatTemplateAttributeValue('15', PRODUCT_TEMPLATE_ATTRIBUTE_TYPE.NUMBER, 'en-US')).toBe('15');
  });

  it('leaves TEXT values and non-numeric NUMBER keys unchanged', () => {
    expect(formatTemplateAttributeValue('value 4', PRODUCT_TEMPLATE_ATTRIBUTE_TYPE.TEXT, 'en-US')).toBe('value 4');
    expect(formatTemplateAttributeValue('12 Ah', PRODUCT_TEMPLATE_ATTRIBUTE_TYPE.NUMBER, 'en-US')).toBe('12 Ah');
  });

  it('formats date-only values', () => {
    expect(formatTemplateAttributeValue('2026-08-27', undefined, 'en-US')).toBe(formatDate('2026-08-27', 'en-US'));
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

describe('isPlaceholderAttributeLabel', () => {
  it('treats key-echo localized maps as placeholders', () => {
    expect(isPlaceholderAttributeLabel({ en: 'width' }, 'width')).toBe(true);
    expect(isPlaceholderAttributeLabel('width', 'width')).toBe(true);
    expect(isPlaceholderAttributeLabel({}, 'width')).toBe(true);
    expect(isPlaceholderAttributeLabel({ en: 'Width' }, 'width')).toBe(false);
  });
});

describe('resolveVariantAttributeLabel', () => {
  const l10n = (value: { en?: string; de?: string } | string): string =>
    typeof value === 'string' ? value : (value.en ?? value.de ?? L10N_MISSING_LABEL);

  it('prefers a real localized name over a key echo', () => {
    expect(
      resolveVariantAttributeLabel(
        'a-very-long-attribute-name-to-test-wrapping',
        { en: 'a-very-long-attribute-name-to-test-wrapping' },
        { 'a-very-long-attribute-name-to-test-wrapping': { en: 'A Very Long Attribute Name To Test Wrapping' } },
        l10n,
      ),
    ).toBe('A Very Long Attribute Name To Test Wrapping');
  });

  it('shows a localized name that contains hyphens or underscores', () => {
    expect(resolveVariantAttributeLabel('a-number-attribute-9', { en: 'Number-Attribute' }, undefined, l10n)).toBe(
      'Number-Attribute',
    );
    expect(resolveVariantAttributeLabel('a-number-attribute-9', { en: 'Num_Attribute' }, undefined, l10n)).toBe(
      'Num_Attribute',
    );
    expect(
      resolveVariantAttributeLabel('Max-Operating-Pressure', { en: 'Max-Operating-Pressure' }, undefined, l10n),
    ).toBe('Max-Operating-Pressure');
    expect(resolveVariantAttributeLabel('threadSize', { en: 'Thread-Size / Pitch' }, undefined, l10n)).toBe(
      'Thread-Size / Pitch',
    );
  });

  it('shows a key-echo name, including a generated key, when that is the only label', () => {
    expect(resolveVariantAttributeLabel('Width', { en: 'Width' }, undefined, l10n)).toBe('Width');
    expect(resolveVariantAttributeLabel('a-number-attribute-9', { en: 'a-number-attribute-9' }, undefined, l10n)).toBe(
      'a-number-attribute-9',
    );
    expect(resolveVariantAttributeLabel('colorFinish', { en: 'colorFinish' }, undefined, l10n)).toBe('colorFinish');
  });

  it('prefers a localized display name over a camelCase key', () => {
    expect(resolveVariantAttributeLabel('colorFinish', { en: 'Color' }, undefined, l10n)).toBe('Color');
  });

  it('returns missing label when name is absent', () => {
    expect(resolveVariantAttributeLabel('colorFinish', undefined, undefined, l10n)).toBe(L10N_MISSING_LABEL);
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
