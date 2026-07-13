import type { Category } from '@/platform/services/model/category';
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

  it('builds cumulative display-path hrefs in BI mode using snapshot data', () => {
    const biSnapshot: BatteryIncludedCategoryTreeSnapshot = {
      roots: [],
      byId: {
        'cat-3': {
          id: 'cat-3',
          labelPath: 'Root > Middle > Leaf',
          displayPath: 'Root > Middle > Leaf',
          leafLabel: 'Leaf',
          publicationAnchorId: 'root-id',
          count: 5,
          idPath: ['cat-1', 'cat-2', 'cat-3'],
        },
      },
      byFacetValue: {},
      countsById: {},
    };

    const breadcrumbs = generateVisibleBreadcrumbForPdp(product, 'en', 'batteryincluded', biSnapshot);

    expect(breadcrumbs).toHaveLength(4);
    expect(breadcrumbs[0].label).toBe('Root');
    expect(breadcrumbs[0].href).toBe('/browse?filters%5B_product_i18n.categoryBreadcrumbs.displayPath%5D=Root');
    expect(breadcrumbs[1].label).toBe('Middle');
    expect(breadcrumbs[1].href).toBe(
      '/browse?filters%5B_product_i18n.categoryBreadcrumbs.displayPath%5D=Root+%3E+Middle',
    );
    expect(breadcrumbs[2].label).toBe('Leaf');
    expect(breadcrumbs[2].href).toBe(
      '/browse?filters%5B_product_i18n.categoryBreadcrumbs.displayPath%5D=Root+%3E+Middle+%3E+Leaf',
    );
    expect(breadcrumbs[3].label).toBe('Product Name');
    expect(breadcrumbs[3].href).toBe('/product/prod-123');
  });

  it('gracefully falls back to Emporix category-id browse links when BI lookup is missing but category ancestry exists', () => {
    const biSnapshotMissingEntry: BatteryIncludedCategoryTreeSnapshot = {
      roots: [],
      byId: {},
      byFacetValue: {},
      countsById: {},
    };

    const breadcrumbs = generateVisibleBreadcrumbForPdp(product, 'en', 'batteryincluded', biSnapshotMissingEntry);

    expect(breadcrumbs).toHaveLength(4);
    expect(breadcrumbs[0].label).toBe('Cat 1');
    expect(breadcrumbs[1].label).toBe('Cat 2');
    expect(breadcrumbs[2].label).toBe('Cat 3');
    expect(breadcrumbs[0].href).toContain('filters%5BcategoryIds%5D=cat-1');
    expect(breadcrumbs[3].label).toBe('Product Name');
    expect(breadcrumbs[3].href).toBe('/product/prod-123');
  });

  it('renders Home > product when neither BI nor labeled ancestry is available', () => {
    const productNoCategory = { ...product, primaryCategory: undefined, categories: [] } as unknown as Product;

    const breadcrumbs = generateVisibleBreadcrumbForPdp(productNoCategory, 'en', 'batteryincluded', null);

    expect(breadcrumbs).toHaveLength(1);
    expect(breadcrumbs[0].label).toBe('Product Name');
    expect(breadcrumbs[0].href).toBe('/product/prod-123');
  });

  it('uses parent-chain ordering and category-id browse links directly in Emporix mode', () => {
    const breadcrumbs = generateVisibleBreadcrumbForPdp(product, 'en', 'emporix', null);

    expect(breadcrumbs).toHaveLength(4);
    expect(breadcrumbs[0].label).toBe('Cat 1');
    expect(breadcrumbs[2].label).toBe('Cat 3');
    expect(breadcrumbs[2].href).toContain('filters%5BcategoryIds%5D=cat-3');
    expect(breadcrumbs[3].label).toBe('Product Name');
  });
});
