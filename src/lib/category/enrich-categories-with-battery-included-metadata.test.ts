import type { Category } from '@/platform/services/model/category';
import {
  getBatteryIncludedCategoryMetadata,
  getBatteryIncludedCategoryStaticCount,
} from '@/platform/services/model/category/batteryincluded-category';
import type { BatteryIncludedCategoryLookupEntry } from '@/platform/services/search/impl/batteryincluded-category-tree';
import { enrichCategoriesWithBatteryIncludedMetadata } from './enrich-categories-with-battery-included-metadata';

describe('enrichCategoriesWithBatteryIncludedMetadata', () => {
  const sheets: Category = { id: 'sheets', name: { en: 'Sheets' }, children: [] };
  const rods: Category = { id: 'rods', name: { en: 'Rods' } };
  const metals: Category = { id: 'metals', name: { en: 'Metals' }, children: [sheets, rods] };
  const unknownRoot: Category = { id: 'unknown', name: { en: 'Unknown' }, children: [] };
  const roots: Category[] = [metals, unknownRoot];

  const metalsEntry: BatteryIncludedCategoryLookupEntry = {
    id: 'metals',
    displayPath: 'Metals',
    facetValue: 'Metals',
    labelPath: 'Metals',
    leafLabel: 'Metals',
    publicationAnchorId: 'metals',
    count: 30,
    idPath: ['metals'],
    position: 1,
  };
  const sheetsEntry: BatteryIncludedCategoryLookupEntry = {
    id: 'sheets',
    displayPath: 'Metals > Sheets',
    facetValue: 'Metals > Sheets',
    labelPath: 'Metals > Sheets',
    leafLabel: 'Sheets',
    publicationAnchorId: 'metals',
    count: 30,
    idPath: ['metals', 'sheets'],
  };
  const snapshot = { byId: { metals: metalsEntry, sheets: sheetsEntry } };

  it('attaches BI metadata (without the public count) to every node present in the snapshot', () => {
    const [enrichedMetals] = enrichCategoriesWithBatteryIncludedMetadata(roots, snapshot);

    expect(getBatteryIncludedCategoryMetadata(enrichedMetals)).toEqual({
      source: 'batteryincluded',
      displayPath: 'Metals',
      facetValue: 'Metals',
      labelPath: 'Metals',
      leafLabel: 'Metals',
      publicationAnchorId: 'metals',
      idPath: ['metals'],
    });
    expect(getBatteryIncludedCategoryStaticCount(enrichedMetals)).toBeUndefined();

    const [enrichedSheets] = enrichedMetals.children as Category[];
    expect(getBatteryIncludedCategoryMetadata(enrichedSheets)).toMatchObject({
      displayPath: 'Metals > Sheets',
      facetValue: 'Metals > Sheets',
      idPath: ['metals', 'sheets'],
    });
    expect(getBatteryIncludedCategoryMetadata(enrichedSheets)).not.toHaveProperty('count');
  });

  it('keeps nodes missing from the snapshot unchanged and preserves children order', () => {
    const [enrichedMetals, enrichedUnknown] = enrichCategoriesWithBatteryIncludedMetadata(roots, snapshot);

    expect(enrichedUnknown).toBe(unknownRoot);
    const children = enrichedMetals.children as Category[];
    expect(children.map((child) => child.id)).toEqual(['sheets', 'rods']);
    expect(children[1]).toBe(rods);
    expect(getBatteryIncludedCategoryMetadata(children[1])).toBeUndefined();
  });

  it('does not mutate the input forest', () => {
    const before = JSON.stringify(roots);

    enrichCategoriesWithBatteryIncludedMetadata(roots, snapshot);

    expect(JSON.stringify(roots)).toBe(before);
    expect(getBatteryIncludedCategoryMetadata(metals)).toBeUndefined();
    expect(getBatteryIncludedCategoryMetadata(sheets)).toBeUndefined();
  });

  it('preserves existing customAttributes on enriched nodes', () => {
    const withAttributes: Category = { id: 'metals', name: { en: 'Metals' }, customAttributes: { foo: 'bar' } };

    const [enriched] = enrichCategoriesWithBatteryIncludedMetadata([withAttributes], snapshot);

    expect(enriched.customAttributes).toMatchObject({ foo: 'bar' });
    expect(getBatteryIncludedCategoryMetadata(enriched)?.leafLabel).toBe('Metals');
  });

  it.each([null, undefined])('returns the roots unchanged when the snapshot is %s', (missing) => {
    const result = enrichCategoriesWithBatteryIncludedMetadata(roots, missing);

    expect(result).toEqual(roots);
    expect(result[0]).toBe(metals);
    expect(result[1]).toBe(unknownRoot);
  });

  it('returns an empty array for an empty forest', () => {
    expect(enrichCategoriesWithBatteryIncludedMetadata([], snapshot)).toEqual([]);
  });
});
