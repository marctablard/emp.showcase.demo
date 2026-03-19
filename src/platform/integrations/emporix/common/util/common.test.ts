import { buildSearchQuery, checkTokenValidity } from './common';

describe('buildSearchQuery', () => {
  it('should produce correct body for single value without spaces', () => {
    const result = buildSearchQuery({ criteria: { name: '~solar' } });
    expect(result.body).toBe('name:~solar');
  });

  it('should wrap value containing spaces in parentheses', () => {
    const result = buildSearchQuery({ criteria: { name: '~solar blue' } });
    expect(result.body).toBe('name:(~solar blue)');
  });

  it('should handle multiple criteria without spaces', () => {
    const result = buildSearchQuery({ criteria: { name: '~solar', code: 'ABC' } });
    expect(result.body).toBe('name:~solar code:ABC');
  });

  it('should wrap all space-containing values in parentheses', () => {
    const result = buildSearchQuery({ criteria: { name: '~solar blue', code: 'A B' } });
    expect(result.body).toBe('name:(~solar blue) code:(A B)');
  });

  it('should return empty body for empty criteria', () => {
    const result = buildSearchQuery({ criteria: {} });
    expect(result.body).toBe('');
  });

  it('should return empty body when no criteria provided', () => {
    const result = buildSearchQuery({});
    expect(result.body).toBe('');
  });

  it('should skip undefined and null criteria values', () => {
    const result = buildSearchQuery({ criteria: { name: undefined, code: 'ABC' } as any });
    expect(result.body).toBe('code:ABC');
  });

  it('should pass page, size, sort as query params', () => {
    const result = buildSearchQuery({ page: 2, size: 10, sort: 'name:asc', criteria: { name: '~test' } });
    const params = new URLSearchParams(result.query);
    expect(params.get('pageNumber')).toBe('2');
    expect(params.get('pageSize')).toBe('10');
    expect(params.get('sort')).toBe('name:asc');
    expect(result.body).toBe('name:~test');
  });

  it('should use query params for criteria when filterAsQuery is true', () => {
    const result = buildSearchQuery({ criteria: { name: '~solar blue' } }, true);
    expect(result.body).toBe('');
    const params = new URLSearchParams(result.query);
    expect(params.get('name')).toBe('~solar blue');
  });

  it('should not double-wrap pre-parenthesized values from service layer', () => {
    // Simulates the actual runtime path: EmporixSearchService passes '~solar blue'
    // (not '~(solar blue)') and buildSearchQuery is the single canonical wrapping point
    const result = buildSearchQuery({ criteria: { name: '~solar blue' } });
    expect(result.body).toBe('name:(~solar blue)');
  });
});

describe('checkTokenValidity', () => {
  // Mock the Date.now function to return a fixed timestamp
  const originalDateNow = Date.now;
  const mockNow = 1621000000000; // A fixed timestamp (May 14, 2021)

  beforeEach(() => {
    // Mock Date.now to return our fixed timestamp
    global.Date.now = jest.fn(() => mockNow);
  });

  afterEach(() => {
    // Restore the original Date.now function
    global.Date.now = originalDateNow;
  });

  it('should return false if token is undefined', () => {
    expect(checkTokenValidity(undefined, 1621000060000)).toBe(false);
  });

  it('should return true if expiryAt is undefined', () => {
    expect(checkTokenValidity('valid-token', undefined)).toBe(true);
  });

  it('should return true when token is valid and not expired', () => {
    // Token expires 60 seconds in the future
    const expiryAt = mockNow + 60000;
    expect(checkTokenValidity('valid-token', expiryAt)).toBe(true);
  });

  it('should return true when token is valid and expiry is exactly at threshold', () => {
    // Token expires exactly at the threshold (6000ms by default)
    const expiryAt = mockNow + 6000;
    expect(checkTokenValidity('valid-token', expiryAt)).toBe(true);
  });

  it('should return false when token is expired', () => {
    // Token expired in the past
    const expiryAt = mockNow - 1000;
    expect(checkTokenValidity('valid-token', expiryAt)).toBe(false);
  });

  it('should return false when token is about to expire within threshold', () => {
    // Token expires in 5000ms, which is less than the default threshold of 6000ms
    const expiryAt = mockNow + 5000;
    expect(checkTokenValidity('valid-token', expiryAt)).toBe(false);
  });

  it('should use custom threshold when provided', () => {
    // Token expires in 10000ms
    const expiryAt = mockNow + 10000;
    // With default threshold (6000ms), this would be valid
    expect(checkTokenValidity('valid-token', expiryAt)).toBe(true);
    // With custom threshold of 15000ms, this should be invalid
    expect(checkTokenValidity('valid-token', expiryAt, 15000)).toBe(false);
  });
});
