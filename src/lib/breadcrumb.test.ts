import type { Category } from '@/platform/services/model/category';
import type { BatteryIncludedCategoryMetadata } from '@/platform/services/model/category/batteryincluded-category';
import type { Product } from '@/platform/services/model/product';
import type { BatteryIncludedCategoryTreeSnapshot } from '@/platform/services/search/impl/batteryincluded-category-tree';
import { generateVisibleBreadcrumbForPdp } from './breadcrumb';

describe('generateVisibleBreadcrumbForPdp', () => {
  const product: Product = {
    id: 'prod-123',
    name: { en: 'Product Name' },
    sku: 'prod-123',
    images: [],
    primaryCategory: {
      id: 'cat-3',
      name: { en: 'Cat 3' },
      parent: {
        id: 'cat-2',
        name: { en: 'Cat 2' },
        parent: {
          id: 'cat-1',
          name: { en: 'Cat 1' },
          parent: undefined,
        } as Category,
      } as Category,
    } as unknown as Category,
  } as unknown as Product;

  const buildBiCategory = (
    id: string,
    label: string,
    metadata: Partial<BatteryIncludedCategoryMetadata>,
    children: Category[] = [],
  ): Category =>
    ({
      id,
      name: { en: label },
      children,
      customAttributes: {
        batteryIncludedCategory: {
          source: 'batteryincluded',
          labelPath: metadata.labelPath ?? label,
          leafLabel: metadata.leafLabel ?? label,
          publicationAnchorId: metadata.publicationAnchorId ?? 'anchor',
          count: metadata.count ?? 1,
          idPath: metadata.idPath ?? [id],
          ...(metadata.displayPath ? { displayPath: metadata.displayPath } : {}),
          ...(metadata.facetValue ? { facetValue: metadata.facetValue } : {}),
        },
      },
    }) as unknown as Category;

  it('prefers nav-forest trail and builds BI cumulative display-path hrefs', () => {
    const navRoots: Category[] = [
      buildBiCategory('cat-1', 'Nav Root', { labelPath: 'Root > Middle > Leaf', idPath: ['cat-1'] }, [
        buildBiCategory('cat-2', 'Nav Middle', { labelPath: 'Root > Middle > Leaf', idPath: ['cat-1', 'cat-2'] }, [
          buildBiCategory('cat-3', 'Nav Leaf', {
            labelPath: 'Root > Middle > Leaf',
            displayPath: 'root > middle > leaf',
            idPath: ['cat-1', 'cat-2', 'cat-3'],
          }),
        ]),
      ]),
    ];

    const biSnapshot: BatteryIncludedCategoryTreeSnapshot = {
      roots: [],
      byId: {
        'cat-3': {
          id: 'cat-3',
          labelPath: 'Snapshot Root > Snapshot Leaf',
          displayPath: 'snapshot > leaf',
          leafLabel: 'Snapshot Leaf',
          publicationAnchorId: 'root-id',
          count: 5,
          idPath: ['cat-a', 'cat-3'],
        },
      },
      byFacetValue: {},
      countsById: {},
    };

    const emporixAncestorTrail: Category[] = [
      { id: 'legacy-root', name: { en: 'Legacy Root' } } as Category,
      { id: 'legacy-leaf', name: { en: 'Legacy Leaf' } } as Category,
    ];

    const breadcrumbs = generateVisibleBreadcrumbForPdp(
      product,
      'en',
      'batteryincluded',
      biSnapshot,
      emporixAncestorTrail,
      navRoots,
    );

    expect(breadcrumbs).toHaveLength(4);
    expect(breadcrumbs[0].label).toBe('Nav Root');
    expect(breadcrumbs[0].href).toBe('/browse?filters%5B_product_i18n.categoryBreadcrumbs.displayPath%5D=root');
    expect(breadcrumbs[1].label).toBe('Nav Middle');
    expect(breadcrumbs[1].href).toBe(
      '/browse?filters%5B_product_i18n.categoryBreadcrumbs.displayPath%5D=root+%3E+middle',
    );
    expect(breadcrumbs[2].label).toBe('Nav Leaf');
    expect(breadcrumbs[2].href).toBe(
      '/browse?filters%5B_product_i18n.categoryBreadcrumbs.displayPath%5D=root+%3E+middle+%3E+leaf',
    );
    expect(breadcrumbs[3].label).toBe('Product Name');
    expect(breadcrumbs[3].href).toBe('/product/prod-123');
  });

  it('keeps BI displayPath filter for ancestors that only expose labelPath metadata', () => {
    const navRoots: Category[] = [
      buildBiCategory(
        'cat-1',
        'Root Label',
        { labelPath: 'Root Label > Middle Label > Leaf Label', idPath: ['cat-1'] },
        [
          buildBiCategory(
            'cat-2',
            'Middle Label',
            { labelPath: 'Root Label > Middle Label > Leaf Label', idPath: ['cat-1', 'cat-2'] },
            [
              buildBiCategory('cat-3', 'Leaf Label', {
                labelPath: 'Root Label > Middle Label > Leaf Label',
                idPath: ['cat-1', 'cat-2', 'cat-3'],
              }),
            ],
          ),
        ],
      ),
    ];

    const breadcrumbs = generateVisibleBreadcrumbForPdp(product, 'en', 'batteryincluded', null, null, navRoots);
    expect(breadcrumbs).toHaveLength(4);
    expect(breadcrumbs[0].href).toContain('filters%5B_product_i18n.categoryBreadcrumbs.displayPath%5D=');
    expect(breadcrumbs[0].href).not.toContain('filters%5BcategoryIds%5D=');
    expect(breadcrumbs[1].href).toContain('filters%5B_product_i18n.categoryBreadcrumbs.displayPath%5D=');
    expect(breadcrumbs[1].href).not.toContain('filters%5BcategoryIds%5D=');
    expect(breadcrumbs[2].href).toContain('filters%5B_product_i18n.categoryBreadcrumbs.displayPath%5D=');
    expect(breadcrumbs[2].href).not.toContain('filters%5BcategoryIds%5D=');
  });

  it('uses categoryIds browse links when nav path has no BI metadata', () => {
    const navRoots: Category[] = [
      {
        id: 'cat-1',
        name: { en: 'Emp Root' },
        children: [
          {
            id: 'cat-2',
            name: { en: 'Emp Middle' },
            children: [{ id: 'cat-3', name: { en: 'Emp Leaf' } as Record<string, string> } as Category],
          } as Category,
        ],
      } as Category,
    ];

    const breadcrumbs = generateVisibleBreadcrumbForPdp(product, 'en', 'emporix', null, null, navRoots);

    expect(breadcrumbs).toHaveLength(4);
    expect(breadcrumbs[0].label).toBe('Emp Root');
    expect(breadcrumbs[1].label).toBe('Emp Middle');
    expect(breadcrumbs[2].label).toBe('Emp Leaf');
    expect(breadcrumbs[0].href).toContain('filters%5BcategoryIds%5D=cat-1');
    expect(breadcrumbs[1].href).toContain('filters%5BcategoryIds%5D=cat-2');
    expect(breadcrumbs[2].href).toContain('filters%5BcategoryIds%5D=cat-3');
    expect(breadcrumbs[3].label).toBe('Product Name');
    expect(breadcrumbs[3].href).toBe('/product/prod-123');
  });

  it('falls back to BI snapshot when nav path misses', () => {
    const biSnapshot: BatteryIncludedCategoryTreeSnapshot = {
      roots: [],
      byId: {
        'cat-3': {
          id: 'cat-3',
          labelPath: 'Snapshot Root > Snapshot Mid > Snapshot Leaf',
          displayPath: 'snapshot-root > snapshot-mid > snapshot-leaf',
          leafLabel: 'Snapshot Leaf',
          publicationAnchorId: 'root-id',
          count: 2,
          idPath: ['cat-1', 'cat-2', 'cat-3'],
        },
      },
      byFacetValue: {},
      countsById: {},
    };
    const breadcrumbs = generateVisibleBreadcrumbForPdp(product, 'en', 'batteryincluded', biSnapshot, null, []);

    expect(breadcrumbs).toHaveLength(4);
    expect(breadcrumbs[0].label).toBe('Snapshot Root');
    expect(breadcrumbs[1].label).toBe('Snapshot Mid');
    expect(breadcrumbs[2].label).toBe('Snapshot Leaf');
    expect(breadcrumbs[2].href).toContain('filters%5B_product_i18n.categoryBreadcrumbs.displayPath%5D=');
  });

  it('falls back to provided Emporix ancestor trail when nav and BI miss', () => {
    const emporixAncestorTrail: Category[] = [
      { id: 'root', name: { en: 'Root' } } as Category,
      { id: 'level-1', name: { en: 'Level 1' } } as Category,
      { id: 'level-2', name: { en: 'Level 2' } } as Category,
      { id: 'leaf', name: { en: 'Leaf' } } as Category,
    ];

    const breadcrumbs = generateVisibleBreadcrumbForPdp(product, 'en', 'emporix', null, emporixAncestorTrail, []);

    expect(breadcrumbs).toHaveLength(5);
    expect(breadcrumbs[0].label).toBe('Root');
    expect(breadcrumbs[0].href).toContain('filters%5BcategoryIds%5D=root');
    expect(breadcrumbs[1].label).toBe('Level 1');
    expect(breadcrumbs[1].href).toContain('filters%5BcategoryIds%5D=level-1');
    expect(breadcrumbs[2].label).toBe('Level 2');
    expect(breadcrumbs[2].href).toContain('filters%5BcategoryIds%5D=level-2');
    expect(breadcrumbs[3].label).toBe('Leaf');
    expect(breadcrumbs[3].href).toContain('filters%5BcategoryIds%5D=leaf');
    expect(breadcrumbs[4].label).toBe('Product Name');
    expect(breadcrumbs[4].href).toBe('/product/prod-123');
  });

  it('renders product-only fallback when no nav path and no fallback ancestry exists', () => {
    const productNoCategory = { ...product, primaryCategory: undefined, categories: [] } as unknown as Product;
    const breadcrumbs = generateVisibleBreadcrumbForPdp(productNoCategory, 'en', 'batteryincluded', null, null, []);

    expect(breadcrumbs).toHaveLength(1);
    expect(breadcrumbs[0].label).toBe('Product Name');
    expect(breadcrumbs[0].href).toBe('/product/prod-123');
  });
});
