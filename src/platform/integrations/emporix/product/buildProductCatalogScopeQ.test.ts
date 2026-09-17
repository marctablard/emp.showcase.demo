import { buildSearchQuery } from '../common/util/common';
import { buildProductCategoryIdsCriteriaValue, buildSegmentScopeCompoundQuery } from './buildProductCatalogScopeQ';

describe('buildProductCategoryIdsCriteriaValue', () => {
  it('returns undefined for empty input', () => {
    expect(buildProductCategoryIdsCriteriaValue([])).toBeUndefined();
  });

  it('returns undefined when all ids are blank', () => {
    expect(buildProductCategoryIdsCriteriaValue(['', '  '])).toBeUndefined();
  });

  it('wraps single id in parentheses (required for UUIDs with hyphens in Emporix q)', () => {
    expect(buildProductCategoryIdsCriteriaValue(['abc'])).toBe('(abc)');
    expect(buildProductCategoryIdsCriteriaValue(['812358ba-6327-4195-ac6b-bf77e1fb9718'])).toBe(
      '(812358ba-6327-4195-ac6b-bf77e1fb9718)',
    );
  });

  it('dedupes and joins multiple ids in parentheses', () => {
    expect(buildProductCategoryIdsCriteriaValue(['a', 'b', 'a'])).toBe('(a,b)');
  });
});

describe('buildSegmentScopeCompoundQuery', () => {
  it('(a) categories + products → OR of both branches', () => {
    expect(
      buildSegmentScopeCompoundQuery({
        selectedCategoryIds: [],
        assignedCategoryIds: ['a', 'b'],
        productIds: ['p1', 'p2'],
      }),
    ).toBe('compoundLogicalQuery:((categoryIds:(a,b)) OR (id:(p1,p2)))');
  });

  it('(b) categories only → no OR branch', () => {
    expect(
      buildSegmentScopeCompoundQuery({ selectedCategoryIds: [], assignedCategoryIds: ['a', 'b'], productIds: [] }),
    ).toBe('compoundLogicalQuery:(categoryIds:(a,b))');
  });

  it('(c) products only → no OR branch', () => {
    expect(
      buildSegmentScopeCompoundQuery({ selectedCategoryIds: [], assignedCategoryIds: [], productIds: ['p1', 'p2'] }),
    ).toBe('compoundLogicalQuery:(id:(p1,p2))');
  });

  it('(d) selected category AND scope', () => {
    expect(
      buildSegmentScopeCompoundQuery({
        selectedCategoryIds: ['sel'],
        assignedCategoryIds: ['a', 'b'],
        productIds: ['p1'],
      }),
    ).toBe('compoundLogicalQuery:((categoryIds:(sel)) AND ((categoryIds:(a,b)) OR (id:(p1))))');
  });

  it('(e) both scope parts empty → undefined (even with a selected category)', () => {
    expect(buildSegmentScopeCompoundQuery({ selectedCategoryIds: [], assignedCategoryIds: [], productIds: [] })).toBe(
      undefined,
    );
    expect(
      buildSegmentScopeCompoundQuery({ selectedCategoryIds: ['sel'], assignedCategoryIds: ['  '], productIds: [] }),
    ).toBeUndefined();
  });

  it('every defined result starts with the compoundLogicalQuery prefix and uses unquoted id lists', () => {
    const results = [
      buildSegmentScopeCompoundQuery({ selectedCategoryIds: [], assignedCategoryIds: ['a', 'b'], productIds: ['p1'] }),
      buildSegmentScopeCompoundQuery({ selectedCategoryIds: [], assignedCategoryIds: ['a'], productIds: [] }),
      buildSegmentScopeCompoundQuery({ selectedCategoryIds: [], assignedCategoryIds: [], productIds: ['p1', 'p2'] }),
      buildSegmentScopeCompoundQuery({ selectedCategoryIds: ['sel'], assignedCategoryIds: ['a'], productIds: ['p1'] }),
    ];
    for (const result of results) {
      expect(result).toBeDefined();
      expect(result!.startsWith('compoundLogicalQuery:(')).toBe(true);
      expect(result).not.toContain('"');
    }
    expect(results[0]).toContain(`categoryIds:${buildProductCategoryIdsCriteriaValue(['a', 'b'])}`);
    expect(results[2]).toContain(`id:${buildProductCategoryIdsCriteriaValue(['p1', 'p2'])}`);
  });

  it('is appended verbatim by buildSearchQuery — exactly one compoundLogicalQuery prefix in the serialised q', () => {
    const fragment = buildSegmentScopeCompoundQuery({
      selectedCategoryIds: ['sel'],
      assignedCategoryIds: ['a', 'b'],
      productIds: ['p1', 'p2'],
    });

    const { body } = buildSearchQuery({ criteria: { name: '~solar', compoundLogicalQuery: fragment } });

    expect(body).toBe(
      'name:~solar compoundLogicalQuery:((categoryIds:(sel)) AND ((categoryIds:(a,b)) OR (id:(p1,p2))))',
    );
    expect(body.split('compoundLogicalQuery:').length - 1).toBe(1);
  });
});
