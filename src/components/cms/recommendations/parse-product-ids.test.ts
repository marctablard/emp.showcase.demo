import { parseProductIds } from './parse-product-ids';

describe('parseProductIds', () => {
  it('splits "a,b,c" into ["a","b","c"]', () => {
    expect(parseProductIds('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('splits "a, b, c" (Leerzeichen nach Komma) korrekt', () => {
    expect(parseProductIds('a, b, c')).toEqual(['a', 'b', 'c']);
  });

  it('splits "a ,b" (Leerzeichen vor Komma) korrekt', () => {
    expect(parseProductIds('a ,b')).toEqual(['a', 'b']);
  });

  it('filtert leere Einträge (z.B. trailing comma)', () => {
    expect(parseProductIds('a,b,')).toEqual(['a', 'b']);
  });

  it('gibt [] für leeren String zurück', () => {
    expect(parseProductIds('')).toEqual([]);
  });

  it('gibt ["single"] für einzelne ID zurück', () => {
    expect(parseProductIds('single')).toEqual(['single']);
  });
});
