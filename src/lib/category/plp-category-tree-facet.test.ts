import type { Category } from '@/platform/services/model/category';
import { BATTERY_INCLUDED_BREADCRUMB_FILTER } from '@/platform/services/model/category/batteryincluded-category';
import type { BatteryIncludedFacet } from '@/platform/services/model/common';
import { resolvePlpCategoryTreeFacetContext } from './plp-category-tree-facet';

describe('resolvePlpCategoryTreeFacetContext', () => {
  const staticRoot: Category = {
    id: 'electronics',
    name: { en: 'Static Electronics' },
    customAttributes: {
      batteryIncludedCategory: {
        source: 'batteryincluded',
        displayPath: 'Static Electronics',
        facetValue: 'Static Electronics',
        labelPath: 'Static Electronics',
        leafLabel: 'Static Electronics',
        publicationAnchorId: 'electronics',
        count: 999,
        idPath: ['electronics'],
      },
    },
    children: [
      {
        id: 'phones',
        name: { en: 'Static Phones' },
        customAttributes: {
          batteryIncludedCategory: {
            source: 'batteryincluded',
            displayPath: 'Static Electronics > Static Phones',
            facetValue: 'Static Electronics > Static Phones',
            labelPath: 'Static Electronics > Static Phones',
            leafLabel: 'Static Phones',
            publicationAnchorId: 'phones',
            count: 999,
            idPath: ['electronics', 'phones'],
          },
        },
        children: [],
      },
      {
        id: 'tablets',
        name: { en: 'Static Tablets' },
        customAttributes: {
          batteryIncludedCategory: {
            source: 'batteryincluded',
            displayPath: 'Static Electronics > Static Tablets',
            facetValue: 'Static Electronics > Static Tablets',
            labelPath: 'Static Electronics > Static Tablets',
            leafLabel: 'Static Tablets',
            publicationAnchorId: 'tablets',
            count: 999,
            idPath: ['electronics', 'tablets'],
          },
        },
        children: [],
      },
    ],
  };

  const treeFacets: BatteryIncludedFacet[] = [
    {
      id: BATTERY_INCLUDED_BREADCRUMB_FILTER,
      label: 'Categories',
      kind: 'tree',
      options: [
        {
          id: 'electronics',
          label: 'Electronics',
          count: 5,
          active: false,
          idPath: ['electronics'],
          labelPath: ['Electronics'],
        },
        {
          id: 'phones',
          label: 'Phones',
          count: 3,
          active: false,
          idPath: ['electronics', 'phones'],
          labelPath: ['Electronics', 'Phones'],
        },
        {
          id: 'tablets',
          label: 'Tablets',
          count: 2,
          active: false,
          idPath: ['electronics', 'tablets'],
          labelPath: ['Electronics', 'Tablets'],
        },
      ],
    },
  ];

  const selectFacets: BatteryIncludedFacet[] = [
    {
      id: BATTERY_INCLUDED_BREADCRUMB_FILTER,
      label: 'Categories',
      kind: 'select',
      options: [
        {
          id: 'Static Electronics',
          label: 'Static Electronics',
          count: 5,
          active: false,
        },
        {
          id: 'Static Electronics > Static Phones',
          label: 'Static Electronics > Static Phones',
          count: 3,
          active: false,
        },
        {
          id: 'Static Electronics > Static Tablets',
          label: 'Static Electronics > Static Tablets',
          count: 2,
          active: false,
        },
        {
          id: 'Unknown Category',
          label: 'Unknown Category', // Should be ignored
          count: 5,
          active: false,
        },
      ],
    },
  ];

  describe('with kind: "tree"', () => {
    it('builds the current category tree from live facet counts and preserves static metadata', () => {
      const ctx = resolvePlpCategoryTreeFacetContext(treeFacets, [staticRoot], 'electronics', 'en');

      expect(ctx).toBeDefined();
      expect(ctx?.selectedCategoryFound).toBe(true);
      expect(ctx?.plpCategoryContext.currentCategory).toMatchObject({
        id: 'electronics',
        name: { en: 'Electronics' },
      });
      expect(ctx?.plpCategoryContext.currentChildren.map((category) => category.id)).toEqual(['phones', 'tablets']);
      expect(ctx?.plpCategoryContext.ancestorTrail).toEqual([{ kind: 'virtual-all-products' }]);
      expect(ctx?.categoryCountsById).toMatchObject({ electronics: 5, phones: 3, tablets: 2 });
      expect(ctx?.plpCategoryContext.currentCategory?.customAttributes).toEqual(staticRoot.customAttributes);
    });

    it('falls back to the live root forest when no category is selected', () => {
      const ctx = resolvePlpCategoryTreeFacetContext(treeFacets, [staticRoot], undefined, 'en');

      expect(ctx).toBeDefined();
      expect(ctx?.selectedCategoryFound).toBe(true);
      expect(ctx?.plpCategoryContext.currentCategory).toBeUndefined();
      expect(ctx?.plpCategoryContext.currentChildren.map((category) => category.id)).toEqual(['electronics']);
      expect(ctx?.categoryCountsById.electronics).toBe(5);
    });
  });

  describe('with kind: "select"', () => {
    it('builds tree nodes correctly by mapping displayPath options to static categories and aggregating counts', () => {
      const ctx = resolvePlpCategoryTreeFacetContext(selectFacets, [staticRoot], 'electronics', 'en');

      expect(ctx).toBeDefined();
      expect(ctx?.selectedCategoryFound).toBe(true);
      expect(ctx?.plpCategoryContext.currentCategory).toMatchObject({
        id: 'electronics',
        name: { en: 'Static Electronics' },
      });
      expect(ctx?.plpCategoryContext.currentChildren.map((category) => category.id)).toEqual(['phones', 'tablets']);
      expect(ctx?.categoryCountsById).toMatchObject({ electronics: 5, phones: 3, tablets: 2 });
      // "Unknown Category" should be ignored, so root electronics total is 5 (3+2), not 10.
    });

    it('falls back to live root forest when no category is selected', () => {
      const ctx = resolvePlpCategoryTreeFacetContext(selectFacets, [staticRoot], undefined, 'en');

      expect(ctx).toBeDefined();
      expect(ctx?.selectedCategoryFound).toBe(true);
      expect(ctx?.plpCategoryContext.currentCategory).toBeUndefined();
      expect(ctx?.plpCategoryContext.currentChildren.map((category) => category.id)).toEqual(['electronics']);
      expect(ctx?.categoryCountsById.electronics).toBe(5);
    });
  });
});
