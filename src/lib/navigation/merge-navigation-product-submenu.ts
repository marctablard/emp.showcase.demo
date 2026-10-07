import { ALL_PRODUCTS_NAVIGATION_ITEM_ID, type MenuItem, type SubMenuItem } from '@/data/navigation-menu';

export function mergeNavigationProductSubmenu(item: MenuItem, apiSubmenu: SubMenuItem[] | null | undefined): MenuItem {
  if (item.id !== ALL_PRODUCTS_NAVIGATION_ITEM_ID) {
    return item;
  }
  if (apiSubmenu?.length) {
    return { ...item, submenuItems: apiSubmenu };
  }
  return {
    ...item,
    href: '/browse',
    hasSubmenu: false,
    submenuItems: [],
  };
}
