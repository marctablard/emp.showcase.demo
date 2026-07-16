/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { DesktopMenuFlyout } from '@/components/header/desktop/menu-flyout';
import { NavigationProductSubmenuProvider } from '@/components/header/navigation-product-submenu-context';
import { ALL_PRODUCTS_NAVIGATION_ITEM_ID, type MenuItem, type SubMenuItem } from '@/data/navigation-menu';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    if (key === 'allProducts') {
      return 'All Products';
    }
    if (key === 'allFromCategory') {
      return `All from ${values?.name ?? ''}`;
    }
    if (key === 'showAllCategories') {
      return 'Show all';
    }
    return key;
  },
}));

jest.mock('@/components/header/common/header-promo', () => ({
  HeaderPromo: () => <div data-testid="header-promo" />,
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function createLeaf(index: number): SubMenuItem {
  return {
    label: `Leaf ${index}`,
    href: `/browse/leaf-${index}`,
  };
}

function createParent(label: string, childrenCount: number): SubMenuItem {
  return {
    label,
    href: `/browse/${label.toLowerCase().replace(/\s+/g, '-')}`,
    hasSubmenu: true,
    submenuItems: Array.from({ length: childrenCount }, (_, index) => createLeaf(index + 1)),
  };
}

function createMenuItem(submenuItems: SubMenuItem[]): MenuItem {
  return {
    id: ALL_PRODUCTS_NAVIGATION_ITEM_ID,
    labelKey: 'allProducts',
    hasSubmenu: true,
    submenuItems,
  };
}

function renderFlyout(menuItem: MenuItem, totalRootCategoryCount: number) {
  return render(
    <NavigationProductSubmenuProvider
      submenuItems={menuItem.submenuItems ?? []}
      totalRootCategoryCount={totalRootCategoryCount}
    >
      <DesktopMenuFlyout menuItem={menuItem} />
    </NavigationProductSubmenuProvider>,
  );
}

function expectTopHeaderLinkStyles(link: HTMLElement) {
  expect(link).toHaveClass('hover:bg-surface-action-hover-2');
  expect(link).toHaveClass('text-text-headings');
  expect(link).toHaveClass('no-underline');
  expect(link).not.toHaveClass('underline');
}

function expectLowerCtaLinkStyles(link: HTMLElement) {
  expect(link).toHaveClass('hover:bg-surface-action-hover-2');
  expect(link).toHaveClass('text-text-action');
  expect(link).toHaveClass('underline');
  expect(link).not.toHaveClass('no-underline');
}

describe('DesktopMenuFlyout', () => {
  it('renders exactly one All Products link to /browse when the root list is not truncated', () => {
    const menuItem = createMenuItem([createParent('Solar', 2), createParent('Storage', 2)]);

    renderFlyout(menuItem, 2);

    const allProductsLinks = screen.getAllByRole('link', { name: 'All Products' });

    expect(allProductsLinks).toHaveLength(1);
    expect(allProductsLinks[0]).toHaveAttribute('href', '/browse');
    expectTopHeaderLinkStyles(allProductsLinks[0]);
    expect(screen.queryByRole('link', { name: 'Show all' })).not.toBeInTheDocument();
  });

  it('renders exactly one All Products link to /browse in the lower root CTA slot when the root list is truncated', () => {
    const menuItem = createMenuItem([createParent('Solar', 2), createParent('Storage', 2)]);

    renderFlyout(menuItem, 7);

    const allProductsLinks = screen.queryAllByRole('link', { name: 'All Products' });
    const showAllLinks = screen.getAllByRole('link', { name: 'Show all' });

    expect(allProductsLinks).toHaveLength(0);
    expect(showAllLinks).toHaveLength(1);
    expect(showAllLinks[0]).toHaveAttribute('href', '/browse');
    expectLowerCtaLinkStyles(showAllLinks[0]);
  });

  it('links the child-column All from header to the hovered parent href and removes the duplicate truncated CTA', () => {
    const parentItem = createParent('Solar Panels', 7);
    const menuItem = createMenuItem([parentItem, createParent('Storage', 2)]);

    renderFlyout(menuItem, 2);

    const hoveredParentLink = screen.getByRole('link', { name: 'Solar Panels' });

    fireEvent.mouseEnter(hoveredParentLink);

    const childColumnHeaderLink = screen.getByRole('link', { name: 'All from Solar Panels' });
    const childColumn = childColumnHeaderLink.parentElement;

    expect(childColumnHeaderLink).toHaveAttribute('href', hoveredParentLink.getAttribute('href'));
    expectTopHeaderLinkStyles(childColumnHeaderLink);
    expect(childColumn).not.toBeNull();
    expect(within(childColumn as HTMLElement).queryByRole('link', { name: 'Show all' })).not.toBeInTheDocument();
    expect(within(childColumn as HTMLElement).getAllByRole('link', { name: 'All from Solar Panels' })).toHaveLength(1);
  });
});
