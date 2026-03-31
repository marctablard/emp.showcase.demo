import {
  extractFiltersFromSearchParams,
  extractFiltersFromUrlSearchParams,
  urlSearchParamsToNextRecord,
} from '@/utils/filterUtils';

describe('extractFiltersFromUrlSearchParams', () => {
  it('maps filters[categoryIds]=uuid to categoryIds string', () => {
    const sp = new URLSearchParams();
    sp.set('filters[categoryIds]', '8b709e4f-592e-4964-be84-e93913a22f4e');
    sp.set('site', 'main');
    sp.set('locale', 'en');

    const filters = extractFiltersFromUrlSearchParams(sp);

    expect(filters.categoryIds).toBe('8b709e4f-592e-4964-be84-e93913a22f4e');
    expect(filters.site).toBeUndefined();
    expect(filters.locale).toBeUndefined();
  });

  it('maps filters[categoryIds][] repeated keys to string array', () => {
    const sp = new URLSearchParams();
    sp.append('filters[categoryIds][]', 'a');
    sp.append('filters[categoryIds][]', 'b');

    const filters = extractFiltersFromUrlSearchParams(sp);

    expect(filters.categoryIds).toEqual(['a', 'b']);
  });

  it('maps nested facet keys filters[key][sub] like browse / useSearch range facets', () => {
    const sp = new URLSearchParams();
    sp.set('filters[prices][from]', '10');
    sp.set('filters[prices][till]', '99');

    const filters = extractFiltersFromUrlSearchParams(sp);

    expect(filters.prices).toEqual({ from: '10', till: '99' });
  });

  it('matches extractFiltersFromSearchParams(urlSearchParamsToNextRecord) parity', () => {
    const sp = new URLSearchParams('filters[categoryIds]=x&q=hello');
    const viaUrl = extractFiltersFromUrlSearchParams(sp);
    const viaRecord = extractFiltersFromSearchParams(urlSearchParamsToNextRecord(sp));
    expect(viaRecord).toEqual({ categoryIds: 'x' });
    expect(viaUrl).toEqual(viaRecord);
  });
});
