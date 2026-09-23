import {
  firstAssignedLegalEntityId,
  readContextLegalEntityId,
  resolveClientSelectedLegalEntityId,
  resolveLegalEntityIdFromSessionAndCustomer,
  resolvePermittedSelectedLegalEntityId,
} from './legal-entity-context';

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

describe('firstAssignedLegalEntityId', () => {
  it('returns the first entity that has both an id and a name', () => {
    expect(
      firstAssignedLegalEntityId([
        { id: '  ', name: 'Missing' },
        { id: ' le-1 ', name: ' The LA La Ride ' },
        { id: 'le-2', name: 'Darina Company LTD' },
      ]),
    ).toBe('le-1');
  });

  it('returns undefined when nothing is displayable', () => {
    expect(firstAssignedLegalEntityId(undefined)).toBeUndefined();
    expect(firstAssignedLegalEntityId([{ id: 'le-1', name: '  ' }])).toBeUndefined();
  });
});

describe('readContextLegalEntityId', () => {
  it('reads a string or a session-context attribute value', () => {
    expect(readContextLegalEntityId('  le-1  ')).toBe('le-1');
    expect(readContextLegalEntityId({ key: 'legalEntityId', value: 'le-2' })).toBe('le-2');
    expect(readContextLegalEntityId({ value: '   ' })).toBeUndefined();
    expect(readContextLegalEntityId(undefined)).toBeUndefined();
  });
});

describe('resolvePermittedSelectedLegalEntityId', () => {
  const permitted = ['le-admin', 'le-contact'];

  it('uses session when it is a permitted company', () => {
    expect(
      resolvePermittedSelectedLegalEntityId({
        sessionLegalEntityId: 'le-contact',
        tokenLegalEntityId: 'le-admin',
        customerLegalEntityId: 'le-admin',
        permittedCompanyIds: permitted,
      }),
    ).toBe('le-contact');
  });

  it('recovers from the token claim when session is missing or not permitted', () => {
    expect(
      resolvePermittedSelectedLegalEntityId({
        sessionLegalEntityId: 'le-stale',
        tokenLegalEntityId: 'le-admin',
        customerLegalEntityId: 'le-contact',
        permittedCompanyIds: permitted,
      }),
    ).toBe('le-admin');
  });

  it('recovers from the customer profile when session and token are missing', () => {
    expect(
      resolvePermittedSelectedLegalEntityId({
        customerLegalEntityId: '  le-admin  ',
        permittedCompanyIds: new Set(permitted),
      }),
    ).toBe('le-admin');
  });

  it('does not invent companies[0] when no candidate is permitted', () => {
    expect(
      resolvePermittedSelectedLegalEntityId({
        sessionLegalEntityId: '',
        customerLegalEntityId: 'le-unknown',
        permittedCompanyIds: permitted,
      }),
    ).toBe('');
  });
});

describe('resolveClientSelectedLegalEntityId', () => {
  const known = ['le-admin', 'le-contact'];

  it('prefers a session company that is in the header list', () => {
    expect(
      resolveClientSelectedLegalEntityId({
        sessionLegalEntityId: 'le-contact',
        recoveredLegalEntityId: 'le-admin',
        knownCompanyIds: known,
      }),
    ).toBe('le-contact');
  });

  it('uses the recovered id when the session company is missing or stale', () => {
    expect(
      resolveClientSelectedLegalEntityId({
        sessionLegalEntityId: 'le-stale',
        recoveredLegalEntityId: 'le-admin',
        knownCompanyIds: known,
      }),
    ).toBe('le-admin');
    expect(
      resolveClientSelectedLegalEntityId({
        recoveredLegalEntityId: 'le-admin',
        knownCompanyIds: known,
      }),
    ).toBe('le-admin');
  });

  it('keeps the session company when no header list is provided', () => {
    expect(
      resolveClientSelectedLegalEntityId({
        sessionLegalEntityId: 'le-session',
        recoveredLegalEntityId: 'le-admin',
      }),
    ).toBe('le-session');
  });
});
