import type { Product } from '@/platform/services/model/product';
import {
  dynamicMemberMatchesQualifiers,
  filterDynamicMembersByQualifiers,
  filterSellableDynamicMembers,
  getCompatibleDynamicAttributeValues,
  resolveDynamicRootId,
  unionDynamicVariantAttributes,
} from './product-dynamic-variants';

/**
 * OpenAPI-correct path fixtures (index 0 = direct parent, last = root).
 * Do not treat the Product tutorial's root-first JSON as the expected order.
 */
const TWO_LEVEL_PATH = ['direct-parent', 'tree-root'] as const;
const THREE_LEVEL_PATH = ['direct-parent', 'mid-ancestor', 'tree-root'] as const;

function buildDynamicMember(
  id: string,
  options: {
    sellable?: boolean;
    parentVariantId?: string;
    parentVariantPath?: string[];
    attributes?: { key: string; value: string | number | boolean; name?: string }[];
  } = {},
): Product {
  return {
    id,
    name: id,
    description: '',
    purchasable: options.sellable === true,
    productType: 'DYNAMIC_VARIANT',
    sellable: options.sellable,
    parentVariantId: options.parentVariantId,
    parentVariantPath: options.parentVariantPath,
    variantAttributes: options.attributes?.map((attribute) => ({
      key: attribute.key,
      name: attribute.name,
      values: [{ key: String(attribute.value), selected: true }],
    })),
  };
}

describe('resolveDynamicRootId', () => {
  it('uses parentVariantPath.at(-1) for a 2-level OpenAPI path (last = root, not path[0])', () => {
    const child = buildDynamicMember('l2-child', {
      parentVariantId: 'direct-parent',
      parentVariantPath: [...TWO_LEVEL_PATH],
    });

    expect(TWO_LEVEL_PATH[0]).toBe('direct-parent');
    expect(TWO_LEVEL_PATH.at(-1)).toBe('tree-root');
    expect(resolveDynamicRootId(child)).toBe('tree-root');
    expect(resolveDynamicRootId(child)).not.toBe(TWO_LEVEL_PATH[0]);
  });

  it('uses parentVariantPath.at(-1) for a 3-level OpenAPI path (last = root, not path[0])', () => {
    const leaf = buildDynamicMember('l3-leaf', {
      parentVariantId: 'direct-parent',
      parentVariantPath: [...THREE_LEVEL_PATH],
    });

    expect(THREE_LEVEL_PATH[0]).toBe('direct-parent');
    expect(THREE_LEVEL_PATH.at(-1)).toBe('tree-root');
    expect(resolveDynamicRootId(leaf)).toBe('tree-root');
    expect(resolveDynamicRootId(leaf)).not.toBe(THREE_LEVEL_PATH[0]);
  });

  it('returns the current id when the path is empty and there is no parentVariantId', () => {
    expect(
      resolveDynamicRootId({
        id: 'tree-root',
        parentVariantPath: [],
      }),
    ).toBe('tree-root');
  });

  it('returns the current id when the path is omitted and there is no parentVariantId', () => {
    expect(resolveDynamicRootId({ id: 'tree-root' })).toBe('tree-root');
  });
});

describe('filterSellableDynamicMembers', () => {
  const members = [
    buildDynamicMember('tree-root', { sellable: false }),
    buildDynamicMember('l1-group', { sellable: false, parentVariantId: 'tree-root' }),
    buildDynamicMember('leaf-a', { sellable: true, parentVariantId: 'l1-group' }),
    buildDynamicMember('leaf-b', { sellable: true, parentVariantId: 'l1-group' }),
  ];

  it('returns only sellable === true members when the opened id is already sellable', () => {
    expect(filterSellableDynamicMembers(members, 'leaf-a').map((member) => member.id)).toEqual(['leaf-a', 'leaf-b']);
  });

  it('includes the opened non-sellable member plus sellable === true members', () => {
    expect(filterSellableDynamicMembers(members, 'l1-group').map((member) => member.id)).toEqual([
      'l1-group',
      'leaf-a',
      'leaf-b',
    ]);
  });

  it('includes the opened root when that member is non-sellable', () => {
    expect(filterSellableDynamicMembers(members, 'tree-root').map((member) => member.id)).toEqual([
      'tree-root',
      'leaf-a',
      'leaf-b',
    ]);
  });

  it('does not invent an opened member that is missing from the family', () => {
    expect(filterSellableDynamicMembers(members, 'unknown-id').map((member) => member.id)).toEqual([
      'leaf-a',
      'leaf-b',
    ]);
  });
});

describe('unionDynamicVariantAttributes', () => {
  it('includes attributes that exist only on some descendants (Frequency case)', () => {
    const members = [
      buildDynamicMember('tree-root', { sellable: false }),
      buildDynamicMember('l1-group', {
        sellable: false,
        attributes: [
          { key: 'width', value: 15, name: 'Width' },
          { key: 'height', value: 'Short', name: 'Height' },
        ],
      }),
      buildDynamicMember('leaf-with-frequency', {
        sellable: true,
        attributes: [
          { key: 'width', value: 15, name: 'Width' },
          { key: 'height', value: 'Short', name: 'Height' },
          { key: 'frequency', value: '50Hz', name: 'Frequency' },
        ],
      }),
      buildDynamicMember('leaf-without-frequency', {
        sellable: true,
        attributes: [
          { key: 'width', value: 20, name: 'Width' },
          { key: 'height', value: 'Short', name: 'Height' },
        ],
      }),
    ];

    const groups = unionDynamicVariantAttributes(members);
    expect(groups.map((group) => group.key)).toEqual(['width', 'height', 'frequency']);
    expect(groups.find((group) => group.key === 'frequency')).toEqual({
      key: 'frequency',
      name: 'Frequency',
      values: ['50Hz'],
    });
    expect(groups.find((group) => group.key === 'width')?.values).toEqual(['15', '20']);
  });
});

describe('dynamic qualifier matching', () => {
  const members = [
    buildDynamicMember('leaf-15-50', {
      sellable: true,
      attributes: [
        { key: 'width', value: 15 },
        { key: 'frequency', value: '50Hz' },
      ],
    }),
    buildDynamicMember('leaf-20', {
      sellable: true,
      attributes: [{ key: 'width', value: 20 }],
    }),
  ];

  it('matches qualifier strings after normalizeVariantAttributeValueKey', () => {
    expect(dynamicMemberMatchesQualifiers(members[0], { width: '15' })).toBe(true);
    expect(dynamicMemberMatchesQualifiers(members[0], { width: '20' })).toBe(false);
  });

  it('filters members by selected qualifiers and keeps compatible Frequency values visible', () => {
    expect(filterDynamicMembersByQualifiers(members, { width: '15' }).map((member) => member.id)).toEqual([
      'leaf-15-50',
    ]);
    expect([...getCompatibleDynamicAttributeValues(members, { width: '15' }, 'frequency')]).toEqual(['50Hz']);
    expect([...getCompatibleDynamicAttributeValues(members, { width: '15' }, 'width')].sort()).toEqual(['15', '20']);
  });

  it('ORs values on one axis and ANDs values across axes', () => {
    const colored = [
      buildDynamicMember('red-30', {
        sellable: true,
        attributes: [
          { key: 'height', value: '30' },
          { key: 'color', value: 'Red' },
        ],
      }),
      buildDynamicMember('blue-30', {
        sellable: true,
        attributes: [
          { key: 'height', value: '30' },
          { key: 'color', value: 'Blue' },
        ],
      }),
      buildDynamicMember('red-10', {
        sellable: true,
        attributes: [
          { key: 'height', value: '10' },
          { key: 'color', value: 'Red' },
        ],
      }),
      buildDynamicMember('green-30', {
        sellable: true,
        attributes: [
          { key: 'height', value: '30' },
          { key: 'color', value: 'Green' },
        ],
      }),
    ];

    expect(
      filterDynamicMembersByQualifiers(colored, { height: ['30'], color: ['Red', 'Blue'] }).map((member) => member.id),
    ).toEqual(['red-30', 'blue-30']);
  });
});
