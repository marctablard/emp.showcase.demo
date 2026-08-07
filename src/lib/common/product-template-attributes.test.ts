import { formatDate } from '@/lib/date-utils';
import { PRODUCT_TEMPLATE_ATTRIBUTE_TYPE, formatTemplateAttributeValue } from './product-template-attributes';

describe('formatTemplateAttributeValue', () => {
  it('formats DATETIME values with the shared date formatter', () => {
    // Midday UTC avoids locale-offset day shifts in CI.
    expect(
      formatTemplateAttributeValue('2026-08-18T12:00:00.000Z', PRODUCT_TEMPLATE_ATTRIBUTE_TYPE.DATETIME, 'en-US'),
    ).toBe(formatDate('2026-08-18T12:00:00.000Z', 'en-US'));
  });

  it('leaves non-date types unchanged', () => {
    expect(formatTemplateAttributeValue('value 4', PRODUCT_TEMPLATE_ATTRIBUTE_TYPE.TEXT, 'en-US')).toBe('value 4');
    expect(formatTemplateAttributeValue('1705', PRODUCT_TEMPLATE_ATTRIBUTE_TYPE.NUMBER, 'de-DE')).toBe('1705');
  });
});
