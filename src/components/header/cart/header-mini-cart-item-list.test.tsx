/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { PRODUCT_NO_IMAGE_SRC } from '@/lib/common/product-image';
import type { Cart, CartItem } from '@/platform/services/model/cart/cart.d';
import { HeaderMiniCartItemList } from './header-mini-cart-item-list';

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
  useLocale: () => 'en',
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} {...props} />,
}));

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/hooks/useL10n', () => ({
  useL10n: () => ({
    l10n: (value: unknown) => (typeof value === 'string' ? value : '-'),
  }),
}));

jest.mock('@/hooks/notifications/useNotifications', () => ({
  useNotifications: () => ({
    registerNotificationListener: jest.fn(() => 'sub-1'),
    unregisterNotificationListener: jest.fn(),
  }),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    debug: jest.fn(),
  }),
}));

const baseCart: Omit<Cart, 'items'> = {
  id: 'cart-1',
  currency: 'EUR',
  site: 'main',
  totalPrice: { amount: 100, currency: 'EUR' },
  subTotalPrice: { amount: 100, currency: 'EUR' },
  tax: { amount: 19, netValue: 100, grossValue: 119, currency: 'EUR' },
};

function buildItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'item-1',
    quantity: 2,
    price: { amount: 50, currency: 'EUR' },
    product: {
      id: 'prod-1',
      name: 'Widget',
      images: [],
    },
    ...overrides,
  };
}

function buildCart(items: CartItem[]): Cart {
  return { ...baseCart, items };
}

describe('HeaderMiniCartItemList empty thumbnail', () => {
  it('renders no_image_alt when product images are empty', () => {
    render(<HeaderMiniCartItemList cart={buildCart([buildItem()])} />);

    const image = screen.getByRole('img', { name: 'product.noImage' });
    expect(image).toHaveAttribute('src', PRODUCT_NO_IMAGE_SRC);
    expect(image).toHaveAttribute('src', '/images/no_image_alt.png');
    expect(document.querySelector('.lucide-shopping-cart')).not.toBeInTheDocument();
  });

  it('renders no_image_alt when product images are missing', () => {
    render(
      <HeaderMiniCartItemList
        cart={buildCart([
          buildItem({
            product: { id: 'prod-1', name: 'Widget' },
          }),
        ])}
      />,
    );

    expect(screen.getByRole('img', { name: 'product.noImage' })).toHaveAttribute('src', '/images/no_image_alt.png');
    expect(document.querySelector('.lucide-shopping-cart')).not.toBeInTheDocument();
  });

  it('renders no_image_alt when the product image URL is blank', () => {
    render(
      <HeaderMiniCartItemList
        cart={buildCart([
          buildItem({
            product: {
              id: 'prod-1',
              name: 'Widget',
              images: [{ url: '   ' }],
            },
          }),
        ])}
      />,
    );

    expect(screen.getByRole('img', { name: 'product.noImage' })).toHaveAttribute('src', PRODUCT_NO_IMAGE_SRC);
  });

  it('renders the product image when images are present', () => {
    render(
      <HeaderMiniCartItemList
        cart={buildCart([
          buildItem({
            product: {
              id: 'prod-1',
              name: 'Widget',
              images: [{ url: 'https://cdn.example.com/widget.jpg' }],
            },
          }),
        ])}
      />,
    );

    expect(screen.getByRole('img', { name: 'Widget' })).toHaveAttribute('src', 'https://cdn.example.com/widget.jpg');
    expect(screen.queryByRole('img', { name: 'product.noImage' })).not.toBeInTheDocument();
    expect(document.querySelector('.lucide-shopping-cart')).not.toBeInTheDocument();
  });
});
