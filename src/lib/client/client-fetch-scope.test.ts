import { buildClientFetchScope } from './client-fetch-scope';

describe('buildClientFetchScope', () => {
  it('joins mode, site and customer, omitting empty extra', () => {
    expect(buildClientFetchScope({ mode: 'assigned', siteCode: 'main', customerId: 'c-1' })).toBe('assigned:main:c-1');
  });

  it('appends extra when present and treats missing fields as empty', () => {
    expect(buildClientFetchScope({ extra: 'USD' })).toBe(':::USD');
    expect(buildClientFetchScope({})).toBe('::');
  });
});
