import { formatDate } from '@/lib/date-utils';
import {
  PRODUCT_TEMPLATE_ATTRIBUTE_TYPE,
  formatTemplateAttributeValue,
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
