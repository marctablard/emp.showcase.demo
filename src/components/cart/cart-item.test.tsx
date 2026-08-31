/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { PRODUCT_NO_IMAGE_SRC } from '@/lib/common/product-image';
import type { Cart, CartItem } from '@/platform/services/model/cart/cart.d';
import { CartItemRow } from './cart-item';

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
  useLocale: () => 'en',
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} {...props} />,
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@/hooks/useL10n', () => ({
  useL10n: () => ({
    l10n: (value: unknown) => (typeof value === 'string' ? value : '-'),
  }),
}));

jest.mock('@/hooks/cart/useCart', () => ({
  useCart: () => ({
    updateItemQuantity: jest.fn(),
    removeItem: jest.fn(),
    loading: false,
  }),
}));

jest.mock('@/hooks/notifications/useNotifications', () => ({
  useNotifications: () => ({
    registerNotificationListener: jest.fn(() => 'sub-1'),
    unregisterNotificationListener: jest.fn(),
    markNotificationAsRead: jest.fn(),
  }),
}));

jest.mock('@/hooks/product/useAvailability', () => ({
  useAvailability: () => ({ availability: { availableQuantity: 5 } }),
}));

jest.mock('@/hooks/wishlist/useWishlistAddWithAuth', () => ({
  useWishlistAddWithAuth: () => ({
    addToWishlist: jest.fn(),
    isAdding: false,
    loginDialog: null,
  }),
}));

const cart: Cart = {
  id: 'cart-1',
  currency: 'EUR',
  site: 'main',
  items: [],
  totalPrice: { amount: 100, currency: 'EUR' },
  subTotalPrice: { amount: 100, currency: 'EUR' },
  tax: { amount: 19, netValue: 100, grossValue: 119, currency: 'EUR' },
};

function buildItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'item-1',
    quantity: 1,
    price: { amount: 100, currency: 'EUR' },
    product: {
      id: 'prod-1',
      name: 'Widget',
      images: [],
    },
    ...overrides,
  };
}

describe('CartItemRow empty thumbnail', () => {
  it('renders no_image_alt when product images are empty', () => {
    render(<CartItemRow cart={cart} item={buildItem()} />);

    const image = screen.getByRole('img', { name: 'product.noImage' });
    expect(image).toHaveAttribute('src', PRODUCT_NO_IMAGE_SRC);
    expect(image).toHaveAttribute('src', '/images/no_image_alt.png');
    expect(document.querySelector('.lucide-shopping-cart')).not.toBeInTheDocument();
  });

  it('renders no_image_alt when product images are missing', () => {
    render(
      <CartItemRow
        cart={cart}
        item={buildItem({
          product: { id: 'prod-1', name: 'Widget' },
        })}
      />,
    );

    expect(screen.getByRole('img', { name: 'product.noImage' })).toHaveAttribute('src', '/images/no_image_alt.png');
    expect(document.querySelector('.lucide-shopping-cart')).not.toBeInTheDocument();
  });

  it('renders no_image_alt when the product image URL is blank', () => {
    render(
      <CartItemRow
        cart={cart}
        item={buildItem({
          product: {
            id: 'prod-1',
            name: 'Widget',
            images: [{ url: '   ' }],
          },
        })}
      />,
    );

    expect(screen.getByRole('img', { name: 'product.noImage' })).toHaveAttribute('src', PRODUCT_NO_IMAGE_SRC);
  });

  it('renders the product image when images are present', () => {
    render(
      <CartItemRow
        cart={cart}
        item={buildItem({
          product: {
            id: 'prod-1',
            name: 'Widget',
            images: [{ url: 'https://cdn.example.com/widget.jpg' }],
          },
        })}
      />,
    );

    expect(screen.getByRole('img', { name: 'Widget' })).toHaveAttribute('src', 'https://cdn.example.com/widget.jpg');
    expect(screen.queryByRole('img', { name: 'product.noImage' })).not.toBeInTheDocument();
  });
});
