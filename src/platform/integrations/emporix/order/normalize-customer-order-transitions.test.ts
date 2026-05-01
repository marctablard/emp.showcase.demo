import { normalizeCustomerOrderTransitionsPayload } from './normalize-customer-order-transitions';

describe('normalizeCustomerOrderTransitionsPayload', () => {
  it('returns empty array for null/undefined', () => {
    expect(normalizeCustomerOrderTransitionsPayload(null)).toEqual([]);
    expect(normalizeCustomerOrderTransitionsPayload(undefined)).toEqual([]);
  });

  it('normalizes string[]', () => {
    expect(normalizeCustomerOrderTransitionsPayload(['DECLINED', ' CONFIRMED '])).toEqual(['DECLINED', 'CONFIRMED']);
  });

  it('normalizes { status }[]', () => {
    expect(normalizeCustomerOrderTransitionsPayload([{ status: 'DECLINED' }, { status: 'CONFIRMED' }])).toEqual([
      'DECLINED',
      'CONFIRMED',
    ]);
  });

  it('unwraps transitions wrapper', () => {
    expect(
      normalizeCustomerOrderTransitionsPayload({
        transitions: [{ status: 'DECLINED' }],
      }),
    ).toEqual(['DECLINED']);
  });

  it('throws on invalid entry', () => {
    expect(() => normalizeCustomerOrderTransitionsPayload([{ foo: 'bar' }])).toThrow();
  });

  it('throws on unrecognized object', () => {
    expect(() => normalizeCustomerOrderTransitionsPayload({ foo: [] })).toThrow();
  });
});
