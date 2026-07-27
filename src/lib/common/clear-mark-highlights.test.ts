import { clearMarkHighlights } from './clear-mark-highlights';

describe('clearMarkHighlights', () => {
  it('removes <mark> tags', () => {
    expect(clearMarkHighlights('<mark>Hello</mark> World')).toBe('Hello World');
  });

  it('removes multiple <mark> tags', () => {
    expect(clearMarkHighlights('<mark>Hello</mark> <mark>World</mark>')).toBe('Hello World');
  });

  it('preserves other HTML tags', () => {
    expect(clearMarkHighlights('<mark>Hello</mark> <b>World</b>')).toBe('Hello <b>World</b>');
  });

  it('handles empty strings', () => {
    expect(clearMarkHighlights('')).toBe('');
  });

  it('handles null and undefined', () => {
    expect(clearMarkHighlights(null)).toBe('');
    expect(clearMarkHighlights(undefined)).toBe('');
  });

  it('handles numbers', () => {
    expect(clearMarkHighlights(123 as any)).toBe('123');
  });
});
