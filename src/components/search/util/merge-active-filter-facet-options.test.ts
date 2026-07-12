import type { BatteryIncludedFacet, SearchFilterValue } from '@/platform/services/model/common';
import { getActiveFacetValues, mergeActiveFilterFacetOptions } from './merge-active-filter-facet-options';

describe('merge-active-filter-facet-options', () => {
  describe('getActiveFacetValues', () => {
    it('returns array for string', () => {
      expect(getActiveFacetValues('test')).toEqual(['test']);
    });

    it('returns array for array', () => {
      expect(getActiveFacetValues(['test1', 'test2'])).toEqual(['test1', 'test2']);
    });

    it('returns empty array for object nested values (not completely handled but expected basic fallback behavior)', () => {
      expect(getActiveFacetValues({ nested: 'value' })).toEqual([]);
    });

    it('returns empty array for undefined', () => {
      expect(getActiveFacetValues(undefined)).toEqual([]);
    });
  });

  describe('mergeActiveFilterFacetOptions', () => {
    it('returns empty array if facets is undefined', () => {
      expect(mergeActiveFilterFacetOptions(undefined, {})).toEqual([]);
    });

    it('returns same facets if no active missing filters', () => {
      const facets: BatteryIncludedFacet[] = [
        {
          kind: 'select',
          id: 'brand',
          label: 'Brand',
          options: [{ id: 'EcoFlow', label: 'EcoFlow', active: true, count: 5 }],
        },
      ];
      const activeFilters: Record<string, SearchFilterValue> = {
        brand: 'EcoFlow',
      };

      const result = mergeActiveFilterFacetOptions(facets, activeFilters);
      expect(result).toEqual(facets);
    });

    it('appends missing active filter values to select facets', () => {
      const facets: BatteryIncludedFacet[] = [
        {
          kind: 'select',
          id: 'brand',
          label: 'Brand',
          options: [{ id: 'EcoFlow', label: 'EcoFlow', active: true, count: 5 }],
        },
      ];
      const activeFilters: Record<string, SearchFilterValue> = {
        brand: ['EcoFlow', 'MissingBrand'],
      };

      const result = mergeActiveFilterFacetOptions(facets, activeFilters);
      expect(result[0]).toEqual({
        kind: 'select',
        id: 'brand',
        label: 'Brand',
        options: [
          { id: 'EcoFlow', label: 'EcoFlow', active: true, count: 5 },
          { id: 'MissingBrand', label: 'MissingBrand', active: true, count: undefined },
        ],
      });
    });

    it('appends missing active filter values to rating facets', () => {
      const facets: BatteryIncludedFacet[] = [
        {
          kind: 'rating',
          id: 'rating',
          label: 'Rating',
          options: [{ id: '4', label: '4 star', active: true, count: 5 }],
        },
      ];
      const activeFilters: Record<string, SearchFilterValue> = {
        rating: ['4', '5'],
      };

      const result = mergeActiveFilterFacetOptions(facets, activeFilters);
      expect(result[0]).toEqual({
        kind: 'rating',
        id: 'rating',
        label: 'Rating',
        options: [
          { id: '4', label: '4 star', active: true, count: 5 },
          { id: '5', label: '5', active: true, count: undefined },
        ],
      });
    });

    it('leaves tree and range facets untouched', () => {
      const facets: BatteryIncludedFacet[] = [
        {
          kind: 'tree',
          id: 'category',
          label: 'Category',
          options: [{ id: 'cat1', label: 'Cat 1', active: false, count: 5, idPath: ['cat1'], labelPath: ['Cat 1'] }],
        },
        {
          kind: 'range',
          id: 'price',
          label: 'Price',
          min: '10',
          max: '100',
        },
      ];

      const activeFilters: Record<string, SearchFilterValue> = {
        category: 'MissingCat',
        price: { from: '20', till: '80' },
      };

      const result = mergeActiveFilterFacetOptions(facets, activeFilters);
      expect(result).toEqual(facets);
    });
  });
});
