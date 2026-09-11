import { browseHeadingKey, browseSearchResultsRemountKey } from './browse-heading-key';

describe('browseHeadingKey', () => {
  it('returns searchResults whenever a search phrase is present, in every mode', () => {
    expect(browseHeadingKey('assigned', 'drill')).toBe('searchResults');
    expect(browseHeadingKey('all', 'drill')).toBe('searchResults');
    expect(browseHeadingKey('unsegmented', 'drill')).toBe('searchResults');
    expect(browseHeadingKey('anonymous', 'drill')).toBe('searchResults');
  });

  it('returns assignedProducts in assigned mode without a search phrase', () => {
    expect(browseHeadingKey('assigned')).toBe('assignedProducts');
    expect(browseHeadingKey('assigned', '')).toBe('assignedProducts');
    expect(browseHeadingKey('assigned', '   ')).toBe('assignedProducts');
  });

  it('returns allProducts in every other mode without a search phrase', () => {
    expect(browseHeadingKey('anonymous')).toBe('allProducts');
    expect(browseHeadingKey('unsegmented', undefined)).toBe('allProducts');
    expect(browseHeadingKey('all', '  ')).toBe('allProducts');
  });
});

describe('browseSearchResultsRemountKey', () => {
  it('changes when the customer id changes while the mode stays assigned', () => {
    expect(browseSearchResultsRemountKey('assigned', 'cust-a')).toBe('assigned:cust-a');
    expect(browseSearchResultsRemountKey('assigned', 'cust-b')).toBe('assigned:cust-b');
    expect(browseSearchResultsRemountKey('assigned', 'cust-a')).not.toBe(
      browseSearchResultsRemountKey('assigned', 'cust-b'),
    );
  });

  it('treats a missing customer id as an empty suffix', () => {
    expect(browseSearchResultsRemountKey('anonymous')).toBe('anonymous:');
    expect(browseSearchResultsRemountKey('assigned', undefined)).toBe('assigned:');
  });
});
