import {
  buildBatteryIncludedSortToken,
  isBatteryIncludedResponseDrivenSortField,
  parseBatteryIncludedSortToken,
} from './BatteryIncludedSortContract';

describe('BatteryIncludedSortContract', () => {
  it('parses and rebuilds BI sort tokens', () => {
    expect(parseBatteryIncludedSortToken('_product_i18n.{locale}.name:asc')).toEqual({
      fieldName: '_product_i18n.{locale}.name',
      direction: 'asc',
    });
    expect(buildBatteryIncludedSortToken('_product_i18n.{locale}.name', 'desc')).toBe(
      '_product_i18n.{locale}.name:desc',
    );
  });

  it('accepts templated and concrete response-driven sort fields', () => {
    expect(isBatteryIncludedResponseDrivenSortField('_product_i18n.{locale}.name')).toBe(true);
    expect(isBatteryIncludedResponseDrivenSortField('_product_i18n.en.name')).toBe(true);
  });
});
