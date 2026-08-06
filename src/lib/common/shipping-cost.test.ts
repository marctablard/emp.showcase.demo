import type { ShippingMethod } from '@/platform/services/model/shipping';
import { resolveDefaultShippingCost } from './shipping-cost';

function method(partial: Partial<ShippingMethod> & Pick<ShippingMethod, 'id'>): ShippingMethod {
  return {
    name: partial.name ?? partial.id,
    zoneId: partial.zoneId ?? 'zone',
    ...partial,
  };
}

describe('resolveDefaultShippingCost', () => {
  it('returns the lowest cost when multiple methods are present', () => {
    const methods: ShippingMethod[] = [
      method({ id: 'express', cost: { amount: 9.95, currency: 'EUR' } }),
      method({ id: 'de-standard-dhl', cost: { amount: 4.95, currency: 'EUR' } }),
      method({ id: 'economy', cost: { amount: 6.5, currency: 'EUR' } }),
    ];

    expect(resolveDefaultShippingCost(methods)).toBe(4.95);
  });

  it('returns 0 when a threshold-driven free-shipping fee is present', () => {
    const methods: ShippingMethod[] = [method({ id: 'de-standard-dhl', cost: { amount: 0, currency: 'EUR' } })];

    expect(resolveDefaultShippingCost(methods)).toBe(0);
  });

  it('returns undefined for an empty array', () => {
    expect(resolveDefaultShippingCost([])).toBeUndefined();
  });

  it('returns undefined when every method is missing cost', () => {
    const methods: ShippingMethod[] = [method({ id: 'no-cost-a' }), method({ id: 'no-cost-b', cost: undefined })];

    expect(resolveDefaultShippingCost(methods)).toBeUndefined();
  });

  it('ignores methods without cost and still picks the lowest resolvable amount', () => {
    const methods: ShippingMethod[] = [
      method({ id: 'no-cost' }),
      method({ id: 'paid', cost: { amount: 4.95, currency: 'EUR' } }),
    ];

    expect(resolveDefaultShippingCost(methods)).toBe(4.95);
  });
});
