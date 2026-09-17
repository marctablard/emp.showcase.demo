/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { notify } from '@/components/ui/toast-notification';
import { PRODUCT_NO_IMAGE_SRC } from '@/lib/common/product-image';
import type { Cart, CartItem } from '@/platform/services/model/cart/cart.d';
import { CartMutationCancelledError } from '@/stores/cart-store';
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

const mockUpdateItemQuantity = jest.fn();
const mockRemoveItem = jest.fn();

jest.mock('@/hooks/cart/useCart', () => ({
  useCart: () => ({
    updateItemQuantity: mockUpdateItemQuantity,
    removeItem: mockRemoveItem,
    loading: false,
  }),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('@/components/ui/toast-notification', () => ({
  ToastType: { Info: 'info' },
  notify: jest.fn(),
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
    expect(image).toHaveClass('object-contain');
    expect(image.closest('.bg-surface-image-background')).toBeInTheDocument();
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

describe('CartItemRow quantity restore', () => {
  beforeEach(() => {
    mockUpdateItemQuantity.mockReset();
    mockRemoveItem.mockReset();
    mockUpdateItemQuantity.mockResolvedValue(undefined);
    mockRemoveItem.mockResolvedValue(undefined);
    (notify as jest.Mock).mockClear();
  });

  it('restores the server quantity when an increase fails', async () => {
    mockUpdateItemQuantity.mockRejectedValueOnce(new Error('upstream'));

    render(<CartItemRow cart={cart} item={buildItem({ quantity: 2 })} showQty />);

    fireEvent.click(screen.getByTestId('cart-item-increase-prod-1'));

    await waitFor(() => {
      expect(mockUpdateItemQuantity).toHaveBeenCalledWith('item-1', 3);
    });
    expect(screen.getByTestId('cart-item-quantity-prod-1')).toHaveDisplayValue('2');
  });

  it('restores the server quantity when remove fails', async () => {
    mockRemoveItem.mockRejectedValueOnce(new Error('upstream'));

    render(<CartItemRow cart={cart} item={buildItem({ quantity: 1 })} showQty />);

    fireEvent.click(screen.getByTestId('cart-item-remove-prod-1'));

    await waitFor(() => {
      expect(mockRemoveItem).toHaveBeenCalledWith('item-1');
    });
    expect(screen.getByTestId('cart-item-quantity-prod-1')).toHaveDisplayValue('1');
  });

  it('toasts leftover coupons only after a confirmed last-item remove', async () => {
    const lastItem = buildItem();
    const lastItemCart: Cart = {
      ...cart,
      items: [lastItem],
      discounts: [{ code: 'SAVE10', discountIndex: 0, amount: 1, currency: 'EUR' }],
    };

    render(<CartItemRow cart={lastItemCart} item={lastItem} showQty />);
    fireEvent.click(screen.getByTestId('cart-item-remove-prod-1'));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'cart.couponsRemovedFromEmptyCart',
        }),
      );
    });
  });

  it('does not toast leftover coupons when last-item remove is cancelled by a cart reset', async () => {
    mockRemoveItem.mockRejectedValueOnce(new CartMutationCancelledError('removeItem'));
    const lastItem = buildItem();
    const lastItemCart: Cart = {
      ...cart,
      items: [lastItem],
      discounts: [{ code: 'SAVE10', discountIndex: 0, amount: 1, currency: 'EUR' }],
    };

    render(<CartItemRow cart={lastItemCart} item={lastItem} showQty />);
    fireEvent.click(screen.getByTestId('cart-item-remove-prod-1'));

    await waitFor(() => {
      expect(mockRemoveItem).toHaveBeenCalledWith('item-1');
    });
    expect(notify).not.toHaveBeenCalled();
    expect(screen.getByTestId('cart-item-quantity-prod-1')).toHaveDisplayValue('1');
  });
});
