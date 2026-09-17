/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { MobileMenuNavigation } from '@/components/header/mobile/menu-navigation';
import { NavigationProductSubmenuProvider } from '@/components/header/navigation-product-submenu-context';
import {
  ANONYMOUS_PRODUCTS_MODE,
  type ProductsModeContextValue,
  ProductsModeProvider,
} from '@/components/navigation/products-mode-context';
import type { SubMenuItem } from '@/data/navigation-menu';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    if (key === 'allProducts') {
      return 'All Products';
    }
    if (key === 'assignedProducts') {
      return 'Assigned Products';
    }
    if (key === 'services') {
      return 'Services';
    }
    if (key === 'solutions') {
      return 'Solutions';
    }
    if (key === 'onlinePlaner') {
      return 'Online Planer';
    }
    if (key === 'aboutUs') {
      return 'About Us';
    }
    if (key === 'serviceAndContact') {
      return 'Service & Contact';
    }
    if (key === 'settings') {
      return 'Settings';
    }
    if (key === 'locationSettings') {
      return 'Location Settings';
    }
    if (key === 'seeAllCategories') {
      return 'See all categories';
    }
    if (key === 'back') {
      return 'Back';
    }
    if (key === 'openSubcategoriesFor') {
      return `Open subcategories for ${values?.name ?? ''}`;
    }
    return key;
  },
}));

jest.mock('@/components/header/common/header-promo', () => ({
  HeaderPromo: () => <div data-testid="header-promo" />,
}));

jest.mock('@/components/header/mobile/location-settings-dialog', () => ({
  LocationSettingsDialog: () => null,
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const SEGMENTED_PRODUCTS_MODE: ProductsModeContextValue = {
  mode: 'assigned',
  isSegmented: true,
  canToggleAllProducts: false,
};

function renderMobileMenu(
  submenuItems: SubMenuItem[],
  totalRootCategoryCount: number,
  onClose = jest.fn(),
  productsMode: ProductsModeContextValue = ANONYMOUS_PRODUCTS_MODE,
) {
  render(
    <ProductsModeProvider value={productsMode}>
      <NavigationProductSubmenuProvider submenuItems={submenuItems} totalRootCategoryCount={totalRootCategoryCount}>
        <MobileMenuNavigation onClose={onClose} />
      </NavigationProductSubmenuProvider>
    </ProductsModeProvider>,
  );

  return { onClose };
}

describe('MobileMenuNavigation', () => {
  const singleCategory: SubMenuItem[] = [{ id: 'storage', label: 'Storage', href: '/browse/storage' }];

  it('labels the products item "All Products" when the customer is not segmented', () => {
    renderMobileMenu(singleCategory, 1);

    const trigger = screen.getByTestId('headerMobile-allProductsMenu');

    expect(trigger).toHaveTextContent('All Products');
    expect(trigger).toHaveAccessibleName('Open subcategories for All Products');
    expect(screen.queryByText('Assigned Products')).not.toBeInTheDocument();
  });

  it('labels the products item "Assigned Products" for a segmented customer', () => {
    renderMobileMenu(singleCategory, 1, jest.fn(), SEGMENTED_PRODUCTS_MODE);

    const trigger = screen.getByTestId('headerMobile-allProductsMenu');

    expect(trigger).toHaveTextContent('Assigned Products');
    expect(trigger).toHaveAccessibleName('Open subcategories for Assigned Products');
    expect(screen.queryByText('All Products')).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(screen.getByRole('link', { name: 'Assigned Products' })).toHaveAttribute('href', '/browse');
    expect(screen.getByRole('link', { name: 'Storage' })).toBeInTheDocument();
  });

  it('uses the right arrow button for expansion and keeps the category label as a link', () => {
    const submenuItems: SubMenuItem[] = [
      {
        id: 'solar',
        label: 'Solar',
        href: '/browse/solar',
        hasSubmenu: true,
        submenuItems: [
          {
            id: 'panels',
            label: 'Panels',
            href: '/browse/panels',
          },
        ],
      },
      {
        id: 'storage',
        label: 'Storage',
        href: '/browse/storage',
      },
    ];

    const { onClose } = renderMobileMenu(submenuItems, 2);

    fireEvent.click(screen.getByRole('button', { name: 'Open subcategories for All Products' }));

    const solarLink = screen.getByRole('link', { name: 'Solar' });

    expect(solarLink).toHaveAttribute('href', '/browse/solar');
    expect(screen.getByRole('button', { name: 'Open subcategories for Solar' })).toBeInTheDocument();

    fireEvent.click(solarLink);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows only the current branch after drilling into a category', () => {
    const submenuItems: SubMenuItem[] = [
      {
        id: 'solar',
        label: 'Solar',
        href: '/browse/solar',
        hasSubmenu: true,
        submenuItems: [
          {
            id: 'panels',
            label: 'Panels',
            href: '/browse/panels',
          },
        ],
      },
      {
        id: 'storage',
        label: 'Storage',
        href: '/browse/storage',
      },
    ];

    renderMobileMenu(submenuItems, 2);

    fireEvent.click(screen.getByRole('button', { name: 'Open subcategories for All Products' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open subcategories for Solar' }));

    expect(screen.getByRole('link', { name: 'Panels' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Storage' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Solar' })).toHaveAttribute('href', '/browse/solar');
  });
});
