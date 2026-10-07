import { normalizeLocalizedLeaf } from './normalizeLocalizedLeaf';

describe('normalizeLocalizedLeaf', () => {
  it('returns undefined for empty input when no fallback is given', () => {
    expect(normalizeLocalizedLeaf(undefined)).toBeUndefined();
    expect(normalizeLocalizedLeaf(null)).toBeUndefined();
    expect(normalizeLocalizedLeaf('')).toBeUndefined();
  });

  it('returns fallback logic for empty input', () => {
    expect(normalizeLocalizedLeaf(null, 'fallback-key')).toEqual({ en: 'fallback-key' });
  });

  it('returns undefined for empty array', () => {
    expect(normalizeLocalizedLeaf([])).toBeUndefined();
  });

  it('returns fallback for empty array when provided', () => {
    expect(normalizeLocalizedLeaf([], 'fallback-arr')).toEqual({ en: 'fallback-arr' });
  });

  it('filters out invalid array items and returns undefined if empty afterwards', () => {
    expect(normalizeLocalizedLeaf([{}, { language: 'en' }, { value: 'hi' }])).toBeUndefined();
  });

  it('reduces valid array items to localized map', () => {
    const input = [{ language: 'en', value: 'Hello' }, { language: 'de', value: 'Hallo' }, { invalid: true }];
    expect(normalizeLocalizedLeaf(input)).toEqual({ en: 'Hello', de: 'Hallo' });
  });

  it('returns undefined for empty object', () => {
    expect(normalizeLocalizedLeaf({})).toBeUndefined();
  });

  it('returns object itself if not empty', () => {
    const input = { en: 'Hello', de: 'Hallo' };
    expect(normalizeLocalizedLeaf(input)).toEqual(input);
  });

  it('stringifies primitives to en locale', () => {
    expect(normalizeLocalizedLeaf(123)).toEqual({ en: '123' });
    expect(normalizeLocalizedLeaf(false)).toEqual({ en: 'false' });
    expect(normalizeLocalizedLeaf('plain string')).toEqual({ en: 'plain string' });
  });
});
