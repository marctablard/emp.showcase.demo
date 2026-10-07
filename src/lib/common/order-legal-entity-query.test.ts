import { appendLegalEntityIdToOrderQuery } from './order-legal-entity-query';

describe('appendLegalEntityIdToOrderQuery', () => {
  it('returns the original query when no legal entity is selected', () => {
    expect(appendLegalEntityIdToOrderQuery('id:~(ORD-1)', undefined)).toBe('id:~(ORD-1)');
    expect(appendLegalEntityIdToOrderQuery('id:~(ORD-1)', '')).toBe('id:~(ORD-1)');
    expect(appendLegalEntityIdToOrderQuery('id:~(ORD-1)', '   ')).toBe('id:~(ORD-1)');
  });

  it('returns undefined when both query and legal entity are empty', () => {
    expect(appendLegalEntityIdToOrderQuery(undefined, undefined)).toBeUndefined();
    expect(appendLegalEntityIdToOrderQuery('  ', undefined)).toBeUndefined();
  });

  it('uses only legalEntityId when the table has no search query', () => {
    expect(appendLegalEntityIdToOrderQuery(undefined, 'le-a')).toBe('legalEntityId:le-a');
    expect(appendLegalEntityIdToOrderQuery('  ', '  le-a  ')).toBe('legalEntityId:le-a');
  });

  it('ANDs legalEntityId onto an existing search query', () => {
    expect(appendLegalEntityIdToOrderQuery('id:~(ORD-10)', 'le-a')).toBe('id:~(ORD-10) legalEntityId:le-a');
  });

  it('replaces a client legalEntityId clause with the session legal entity', () => {
    expect(appendLegalEntityIdToOrderQuery('legalEntityId:other id:~(ORD-10)', 'le-a')).toBe(
      'id:~(ORD-10) legalEntityId:le-a',
    );
  });

  it('ignores legal entity ids that would break Emporix q grammar', () => {
    expect(appendLegalEntityIdToOrderQuery('id:~(ORD-1)', 'le:evil')).toBe('id:~(ORD-1)');
    expect(appendLegalEntityIdToOrderQuery(undefined, 'le a')).toBeUndefined();
  });
});
