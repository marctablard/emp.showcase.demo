export const ALL_PRODUCTS_NAVIGATION_ITEM_ID = 'all-products';

export interface MenuItem {
  id: string;
  labelKey: string; // Translation key
  href?: string;
  hasSubmenu?: boolean;
  submenuItems?: SubMenuItem[];
}

export interface SubMenuItem {
  id?: string;
  label: string;
  href: string;
  hasSubmenu?: boolean;
  submenuItems?: SubMenuItem[];
}

export const navigationMenuItems: MenuItem[] = [
  {
    id: ALL_PRODUCTS_NAVIGATION_ITEM_ID,
    labelKey: 'allProducts',
    hasSubmenu: true,
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
