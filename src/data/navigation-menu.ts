export interface MenuItem {
  id: string;
  labelKey: string; // Translation key
  href?: string;
  hasSubmenu?: boolean;
  submenuItems?: SubMenuItem[];
}

export interface SubMenuItem {
  label: string;
  href: string;
  hasSubmenu?: boolean;
  submenuItems?: SubMenuItem[];
}

export const navigationMenuItems: MenuItem[] = [
  {
    id: 'all-products',
    labelKey: 'allProducts',
    hasSubmenu: true,
    submenuItems: [
      {
        label: 'Solar Panel',
        href: '/product/victron-bluesolar-55w',
        hasSubmenu: true,
        submenuItems: [
          { label: 'Solar type 1', href: '/product/victron-bluesolar-55w' },
          { label: 'Solar type 2', href: '/product/victron-bluesolar-55w' },
          { label: 'Solar type 3', href: '/product/victron-bluesolar-55w' },
          { label: 'Solar type 4', href: '/product/victron-bluesolar-55w' },
        ],
      },
      {
        label: 'Accessories',
        href: '/product/enjoysolar-200w-module',
        hasSubmenu: false,
        submenuItems: [],
      },
      {
        label: 'Power Generators',
        href: '/product/ecoflow-extension-cable',
        hasSubmenu: false,
        submenuItems: [],
      },
      {
        label: 'Cables',
        href: '/product/ecoflow-extension-cable',
        hasSubmenu: false,
        submenuItems: [],
      },
    ],
  },
  {
    id: 'services',
    labelKey: 'services',
    href: '/services',
    hasSubmenu: true,
    submenuItems: [
      {
        label: 'Solar Solutions',
        href: '#',
        hasSubmenu: false,
        submenuItems: [],
      },
      {
        label: 'Installations',
        href: '#',
        hasSubmenu: false,
        submenuItems: [],
      },
      {
        label: 'Renewable Energy',
        href: '#',
        hasSubmenu: false,
        submenuItems: [],
      },
      {
        label: 'Tech Services',
        href: '#',
        hasSubmenu: false,
        submenuItems: [],
      },
    ],
  },
  {
    id: 'solutions',
    labelKey: 'solutions',
    href: '/solutions',
  },
  {
    id: 'online-planer',
    labelKey: 'onlinePlaner',
    href: '/online-planer',
  },
  {
    id: 'configurator',
    labelKey: 'configurator',
    href: '/configurator',
  },
  {
    id: 'about-us',
    labelKey: 'aboutUs',
    href: '/about-us',
  },
];

/**
 * Returns a copy of navigationMenuItems where the "all-products" entry has its
 * submenuItems replaced by the dynamic category items fetched from Emporix.
 * If no category items are available the original hardcoded items are preserved.
 */
export function buildNavigationMenuItems(categoryItems: SubMenuItem[]): MenuItem[] {
  if (categoryItems.length === 0) return navigationMenuItems;
  return navigationMenuItems.map((item) =>
    item.id === 'all-products' ? { ...item, submenuItems: categoryItems } : item,
  );
}

export const serviceMenuItems: MenuItem[] = [
  {
    id: 'blog',
    labelKey: 'blog',
    href: '/blog',
  },
  {
    id: 'newsletter',
    labelKey: 'newsletter',
    href: '/newsletter',
  },
  {
    id: 'offerRequest',
    labelKey: 'offerRequest',
    href: '/offer-request',
  },
  {
    id: 'contact',
    labelKey: 'contact',
    href: '/contact',
  },
];
