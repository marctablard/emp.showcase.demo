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
        hasSubmenu: true,
        submenuItems: [],
      },
      {
        label: 'Power Generators',
        href: '/product/ecoflow-extension-cable',
        hasSubmenu: true,
        submenuItems: [],
      },
      {
        label: 'Cables',
        href: '/product/ecoflow-extension-cable',
        hasSubmenu: true,
        submenuItems: [],
      },
    ],
  },
  {
    id: 'services',
    labelKey: 'services',
    href: '/services',
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
    id: 'about-us',
    labelKey: 'aboutUs',
    href: '/about-us',
  },
];

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
