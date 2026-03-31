import { ALL_PRODUCTS_NAVIGATION_ITEM_ID, type MenuItem } from '@/data/navigation-menu';
import { mergeNavigationProductSubmenu } from './merge-navigation-product-submenu';

describe('mergeNavigationProductSubmenu', () => {
  const servicesItem: MenuItem = {
    id: 'services',
    labelKey: 'services',
    href: '/services',
    hasSubmenu: true,
    submenuItems: [{ label: 'X', href: '/x' }],
  };

  const allProductsItem: MenuItem = {
    id: ALL_PRODUCTS_NAVIGATION_ITEM_ID,
    labelKey: 'allProducts',
    hasSubmenu: true,
  };

  it('returns item unchanged when not all-products', () => {
    expect(mergeNavigationProductSubmenu(servicesItem, [{ label: 'A', href: '/a' }])).toEqual(servicesItem);
  });

  it('injects API submenu for all-products when API returns items', () => {
    const api = [{ label: 'Cat', href: '/browse?filters%5BcategoryIds%5D=1' }];
    expect(mergeNavigationProductSubmenu(allProductsItem, api)).toEqual({
      ...allProductsItem,
      submenuItems: api,
    });
  });

  it('leaves all-products unchanged when API submenu is empty or null', () => {
    expect(mergeNavigationProductSubmenu(allProductsItem, null)).toEqual(allProductsItem);
    expect(mergeNavigationProductSubmenu(allProductsItem, [])).toEqual(allProductsItem);
  });
});
