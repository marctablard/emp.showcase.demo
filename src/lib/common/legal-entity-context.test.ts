import { resolveLegalEntityIdFromSessionAndCustomer } from './legal-entity-context';

describe('resolveLegalEntityIdFromSessionAndCustomer', () => {
  it('prefers session legalEntityId over customer', () => {
    expect(
      resolveLegalEntityIdFromSessionAndCustomer({ legalEntityId: 'session-le' }, { legalEntityId: 'customer-le' }),
    ).toBe('session-le');
  });

  it('falls back to customer when session has none', () => {
    expect(resolveLegalEntityIdFromSessionAndCustomer({}, { legalEntityId: 'customer-le' })).toBe('customer-le');
  });

  it('trims whitespace', () => {
    expect(resolveLegalEntityIdFromSessionAndCustomer({ legalEntityId: '  abc  ' }, {})).toBe('abc');
  });

  it('returns undefined when neither side has id', () => {
    expect(resolveLegalEntityIdFromSessionAndCustomer(undefined, null)).toBeUndefined();
  });
});
