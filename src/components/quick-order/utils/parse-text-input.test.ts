import { parseTextInput } from './parse-text-input';
import type { ParseResult, ParsedEntry } from './parse-text-input';

describe('parseTextInput', () => {
  it('returns a single product code with default quantity 1', () => {
    const result = parseTextInput('ABC');
    expect(result).toEqual<ParseResult>({ entries: [{ code: 'ABC', quantity: 1 }], errors: [] });
  });

  it('returns a code with explicit quantity', () => {
    const result = parseTextInput('ABC 5');
    expect(result).toEqual<ParseResult>({ entries: [{ code: 'ABC', quantity: 5 }], errors: [] });
  });

  it('parses multiple lines into correct array', () => {
    const input = 'ABC 2\nDEF 3\nGHI 1';
    const result = parseTextInput(input);
    expect(result).toEqual<ParseResult>({
      entries: [
        { code: 'ABC', quantity: 2 },
        { code: 'DEF', quantity: 3 },
        { code: 'GHI', quantity: 1 },
      ],
      errors: [],
    });
  });

  it('parses comma-separated codes on a single line', () => {
    const result = parseTextInput('ABC,5');
    expect(result).toEqual<ParseResult>({ entries: [{ code: 'ABC', quantity: 5 }], errors: [] });
  });

  it('parses semicolon-separated codes', () => {
    const result = parseTextInput('ABC;3');
    expect(result).toEqual<ParseResult>({ entries: [{ code: 'ABC', quantity: 3 }], errors: [] });
  });

  it('returns empty result for empty input', () => {
    expect(parseTextInput('')).toEqual<ParseResult>({ entries: [], errors: [] });
  });

  it('returns empty result for whitespace-only input', () => {
    expect(parseTextInput('   \n  \n  ')).toEqual<ParseResult>({ entries: [], errors: [] });
  });

  it('reports error when quantity is non-numeric', () => {
    const result = parseTextInput('ABC xyz');
    expect(result).toEqual<ParseResult>({ entries: [], errors: ['ABC xyz'] });
  });

  it('reports error when quantity is zero', () => {
    const result = parseTextInput('ABC 0');
    expect(result).toEqual<ParseResult>({ entries: [], errors: ['ABC 0'] });
  });

  it('reports error when quantity is negative', () => {
    const result = parseTextInput('PWC-001, -4');
    expect(result).toEqual<ParseResult>({ entries: [], errors: ['PWC-001, -4'] });
  });

  it('reports error when quantity is a float', () => {
    const result = parseTextInput('ABC, 2.5');
    expect(result).toEqual<ParseResult>({ entries: [], errors: ['ABC, 2.5'] });
  });

  it('separates valid entries from invalid lines', () => {
    const input = 'ABC 2\n\n   \nDEF notanumber\nGHI 10';
    const result = parseTextInput(input);
    expect(result).toEqual<ParseResult>({
      entries: [
        { code: 'ABC', quantity: 2 },
        { code: 'GHI', quantity: 10 },
      ],
      errors: ['DEF notanumber'],
    });
  });

  it('handles Windows-style line endings (CRLF)', () => {
    const input = 'ABC 2\r\nDEF 3';
    const result = parseTextInput(input);
    expect(result).toEqual<ParseResult>({
      entries: [
        { code: 'ABC', quantity: 2 },
        { code: 'DEF', quantity: 3 },
      ],
      errors: [],
    });
  });

  it('trims whitespace around codes', () => {
    const result = parseTextInput('  ABC  5  ');
    expect(result).toEqual<ParseResult>({ entries: [{ code: 'ABC', quantity: 5 }], errors: [] });
  });

  it('returns empty result for null-ish input', () => {
    expect(parseTextInput(null as unknown as string)).toEqual<ParseResult>({ entries: [], errors: [] });
    expect(parseTextInput(undefined as unknown as string)).toEqual<ParseResult>({ entries: [], errors: [] });
  });

  it('defaults to quantity 1 when no quantity is provided', () => {
    const result = parseTextInput('PWC-001');
    expect(result).toEqual<ParseResult>({ entries: [{ code: 'PWC-001', quantity: 1 }], errors: [] });
  });

  it('accepts positive integer quantity', () => {
    const result = parseTextInput('PWC-001, 3');
    expect(result).toEqual<ParseResult>({ entries: [{ code: 'PWC-001', quantity: 3 }], errors: [] });
  });
});
