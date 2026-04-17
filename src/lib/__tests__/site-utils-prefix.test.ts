import type { SiteRoutingConfig } from '@/site/types';
import { addPrefixIfNeeded } from '@/site/utils';

const baseRouting: SiteRoutingConfig = {
  defaultSite: 'main',
  availableSites: ['main', 'brand1', 'brand2'],
  prefix: 'as-needed',
  cookie: { name: 'NEXT_SITE' },
};

describe('addPrefixIfNeeded – idempotency', () => {
  test('adds site prefix for non-default site', () => {
    expect(addPrefixIfNeeded('/product/123', 'brand1', baseRouting)).toBe('/brand1/product/123');
  });

  test('does NOT double-prefix when path already starts with site', () => {
    expect(addPrefixIfNeeded('/brand1/product/123', 'brand1', baseRouting)).toBe('/brand1/product/123');
  });

  test('adds site prefix before locale segment', () => {
    expect(addPrefixIfNeeded('/de/product/123', 'brand1', baseRouting)).toBe('/brand1/de/product/123');
  });

  test('does NOT double-prefix when path already has site+locale', () => {
    expect(addPrefixIfNeeded('/brand1/de/product/123', 'brand1', baseRouting)).toBe('/brand1/de/product/123');
  });

  test('does not add prefix for default site in as-needed mode', () => {
    expect(addPrefixIfNeeded('/product/123', 'main', baseRouting)).toBe('/product/123');
  });

  test('forcePrefix adds prefix for default site', () => {
    expect(addPrefixIfNeeded('/', 'brand1', baseRouting, true)).toBe('/brand1/');
  });

  test('forcePrefix is idempotent', () => {
    expect(addPrefixIfNeeded('/brand1', 'brand1', baseRouting, true)).toBe('/brand1');
  });

  test('handles path that exactly equals site prefix', () => {
    expect(addPrefixIfNeeded('/brand1', 'brand1', baseRouting)).toBe('/brand1');
  });

  test('handles root path', () => {
    expect(addPrefixIfNeeded('/', 'brand1', baseRouting)).toBe('/brand1/');
  });

  test('does not add prefix when site is undefined', () => {
    expect(addPrefixIfNeeded('/product/123', undefined, baseRouting)).toBe('/product/123');
  });
});

describe('addPrefixIfNeeded – prefix modes', () => {
  test('prefix: never — never adds prefix', () => {
    const neverRouting: SiteRoutingConfig = { ...baseRouting, prefix: 'never' };
    expect(addPrefixIfNeeded('/product/123', 'brand1', neverRouting)).toBe('/product/123');
    expect(addPrefixIfNeeded('/product/123', 'main', neverRouting)).toBe('/product/123');
  });

  test('prefix: always — adds prefix even for default site', () => {
    const alwaysRouting: SiteRoutingConfig = { ...baseRouting, prefix: 'always' };
    expect(addPrefixIfNeeded('/product/123', 'main', alwaysRouting)).toBe('/main/product/123');
    expect(addPrefixIfNeeded('/product/123', 'brand1', alwaysRouting)).toBe('/brand1/product/123');
  });

  test('prefix: always — idempotent for default site', () => {
    const alwaysRouting: SiteRoutingConfig = { ...baseRouting, prefix: 'always' };
    expect(addPrefixIfNeeded('/main/product/123', 'main', alwaysRouting)).toBe('/main/product/123');
  });
});

describe('addPrefixIfNeeded – path without leading slash', () => {
  test('adds leading slash when path does not start with /', () => {
    expect(addPrefixIfNeeded('product/123', 'brand1', baseRouting)).toBe('/brand1/product/123');
  });
});
