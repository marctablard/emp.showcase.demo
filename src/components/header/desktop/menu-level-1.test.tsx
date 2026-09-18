/**
 * @jest-environment jsdom
 */
import React from 'react';
import { NextIntlClientProvider } from 'next-intl';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { MenuLevel1 } from '@/components/header/desktop/menu-level-1';
import {
  ANONYMOUS_PRODUCTS_MODE,
  type ProductsModeContextValue,
  ProductsModeProvider,
} from '@/components/navigation/products-mode-context';
import { ALL_PRODUCTS_NAVIGATION_ITEM_ID } from '@/data/navigation-menu';

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const messages = {
  layout: {
    header: {
      allProducts: 'All Products',
      assignedProducts: 'Assigned Products',
      services: 'Services',
      solutions: 'Solutions',
      onlinePlaner: 'Online Planer',
      aboutUs: 'About Us',
    },
  },
};

const SEGMENTED_PRODUCTS_MODE: ProductsModeContextValue = {
  mode: 'assigned',
  isSegmented: true,
  canToggleAllProducts: false,
};

function renderMenuLevel1(productsMode: ProductsModeContextValue, onMenuHover = jest.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProductsModeProvider value={productsMode}>
        <MenuLevel1 onMenuHover={onMenuHover} />
      </ProductsModeProvider>
    </NextIntlClientProvider>,
  );

  return { onMenuHover };
}

describe('MenuLevel1', () => {
  it('labels the products trigger "All Products" when the customer is not segmented', () => {
    renderMenuLevel1(ANONYMOUS_PRODUCTS_MODE);

    const trigger = screen.getByTestId('header-allProductsMenu');

    expect(trigger).toHaveTextContent('All Products');
    expect(screen.queryByText('Assigned Products')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Services' })).toBeInTheDocument();
  });

  it('labels the products trigger "Assigned Products" for a segmented customer', () => {
    renderMenuLevel1(SEGMENTED_PRODUCTS_MODE);

    const trigger = screen.getByTestId('header-allProductsMenu');

    expect(trigger).toHaveTextContent('Assigned Products');
    expect(screen.queryByText('All Products')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Services' })).toBeInTheDocument();
  });

  it('falls back to "All Products" outside a ProductsModeProvider', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <MenuLevel1 />
      </NextIntlClientProvider>,
    );

    expect(screen.getByTestId('header-allProductsMenu')).toHaveTextContent('All Products');
  });

  it('keeps the trigger wired to the flyout regardless of the label', () => {
    const { onMenuHover } = renderMenuLevel1(SEGMENTED_PRODUCTS_MODE);

    fireEvent.click(screen.getByTestId('header-allProductsMenu'));

    expect(onMenuHover).toHaveBeenCalledTimes(1);
    expect(onMenuHover).toHaveBeenCalledWith(expect.objectContaining({ id: ALL_PRODUCTS_NAVIGATION_ITEM_ID }));
  });
});
