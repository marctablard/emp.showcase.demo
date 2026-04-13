import type { ShippingMethod } from '@/platform/services/model/shipping';
import {
  buildShippingMethodsCacheKey,
  buildShippingMethodsSessionScope,
  invalidateShippingMethodsResponseCache,
  readShippingMethodsCache,
  writeShippingMethodsCache,
} from './shipping-methods-response-cache';

describe('shipping-methods-response-cache', () => {
  beforeEach(() => {
    invalidateShippingMethodsResponseCache();
  });

  it('builds stable cache keys for scope and query params', () => {
    const scope = buildShippingMethodsSessionScope({
      siteCode: 'main',
      currency: 'EUR',
      legalEntityId: '  le1  ',
    });
    const k1 = buildShippingMethodsCacheKey(scope, 'DE', '023344', { amount: 464.1, currency: 'EUR' });
    const k2 = buildShippingMethodsCacheKey(scope, 'DE', '023344', { amount: 464.1, currency: 'EUR' });
    expect(k1).toBe(k2);
    expect(k1).toContain('main');
    expect(k1).toContain('le1');
  });

  it('treats equivalent numeric amounts equally in the key', () => {
    const scope = buildShippingMethodsSessionScope({ siteCode: 's', currency: 'EUR' });
    const a = buildShippingMethodsCacheKey(scope, 'DE', '1', { amount: 464.1, currency: 'EUR' });
    const b = buildShippingMethodsCacheKey(scope, 'DE', '1', { amount: 464.1, currency: 'EUR' });
    expect(a).toBe(b);
  });

  it('reads and writes cache entries with TTL', () => {
    const scope = buildShippingMethodsSessionScope({ siteCode: 'main', currency: 'EUR' });
    const key = buildShippingMethodsCacheKey(scope, 'DE', '10117', { amount: 10, currency: 'EUR' });
    const methods: ShippingMethod[] = [{ id: 'm1', zoneId: 'z1', name: 'Standard', taxCode: 'STANDARD' }];
    writeShippingMethodsCache(key, methods, 60_000);
    expect(readShippingMethodsCache(key)).toEqual(methods);
    invalidateShippingMethodsResponseCache();
    expect(readShippingMethodsCache(key)).toBeNull();
  });
});
