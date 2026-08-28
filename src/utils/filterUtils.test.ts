import { browseSearchStateSignature } from './filterUtils';

describe('browseSearchStateSignature', () => {
  it('is equal for a string filter and a one-value array filter', () => {
    const shared = { query: 'drill', page: 0, size: 12, sort: 'price:asc' };

    expect(browseSearchStateSignature({ ...shared, filters: { color: 'red' } })).toEqual(
      browseSearchStateSignature({ ...shared, filters: { color: ['red'] } }),
    );
  });

  it('includes sort so price:asc differs from omitted sort', () => {
    const shared = { query: '', page: 0, size: 12 };

    expect(browseSearchStateSignature({ ...shared, sort: 'price:asc' })).not.toEqual(
      browseSearchStateSignature(shared),
    );
  });

  it('is equal for nested string filters and one-value arrays in any leaf order', () => {
    const shared = { query: '', page: 0, size: 12, sort: undefined };

    expect(
      browseSearchStateSignature({
        ...shared,
        filters: { range: { min: '1', max: ['10', '20'] } },
      }),
    ).toEqual(
      browseSearchStateSignature({
        ...shared,
        filters: { range: { max: ['20', '10'], min: ['1'] } },
      }),
    );
  });
});
