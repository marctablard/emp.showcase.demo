/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { notify } from '@/components/ui/toast-notification';
import { PRODUCT_NO_IMAGE_SRC } from '@/lib/common/product-image';
import { formatCurrency } from '@/lib/utils';
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

function currencyText(amount: number, currency = 'EUR'): string {
  return formatCurrency(amount, currency).replace(/\s+/g, ' ');
}

function matchesCurrency(amount: number, currency = 'EUR') {
  const expected = formatCurrency(amount, currency).replace(/[\s\u00a0\u202f]+/g, '');
  return (_content: string, element: Element | null) =>
    (element?.textContent ?? '').replace(/[\s\u00a0\u202f]+/g, '') === expected;
}

function spanIncludesCurrency(amount: number, currency = 'EUR') {
  const expected = formatCurrency(amount, currency).replace(/[\s\u00a0\u202f]+/g, '');
  return (_content: string, element: Element | null) =>
    element?.tagName === 'SPAN' && (element.textContent ?? '').replace(/[\s\u00a0\u202f]+/g, '').includes(expected);
}

describe('CartItemRow line coupons', () => {
  beforeAll(() => {
    class ResizeObserverMock {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    Object.defineProperty(window, 'ResizeObserver', {
      writable: true,
      configurable: true,
      value: ResizeObserverMock,
    });
  });

  it('shows the struck original net and each coupon saving', () => {
    render(
      <CartItemRow
        cart={cart}
        item={buildItem({
          tax: { amount: 811.12, currency: 'EUR', netValue: 4269.05, grossValue: 5080.17 },
          price: { amount: 5080.17, currency: 'EUR' },
          originalNet: 4750.95,
          couponDiscounts: [
            { code: 'VKTEST-PROMO01', amount: 6.8, currency: 'EUR', type: 'ABSOLUTE' },
            { code: '10POFF', amount: 475.1, currency: 'EUR', type: 'PERCENT' },
            { code: 'E2E-FREE_SHIPPING-E7902DA5', amount: 0, currency: 'EUR', type: 'FREE_SHIPPING' },
          ],
        })}
      />,
    );

    expect(screen.getByTestId('cart-item-originalNet-prod-1')).toHaveTextContent(currencyText(4750.95));
    expect(screen.getByTestId('cart-item-coupon-prod-1-10POFF')).toHaveTextContent('10POFF');
    expect(screen.getByTestId('cart-item-couponAmount-prod-1-10POFF')).toHaveTextContent(currencyText(-475.1));
    expect(screen.getByTestId('cart-item-couponAmount-prod-1-VKTEST-PROMO01')).toHaveTextContent(currencyText(-6.8));
    expect(screen.queryByText('E2E-FREE_SHIPPING-E7902DA5')).not.toBeInTheDocument();
    const discountedNet = screen.getByText(matchesCurrency(4269.05));
    expect(discountedNet).toHaveClass('text-text-error');
    expect(screen.getByTestId('cart-item-coupon-prod-1-10POFF').querySelector('svg')).toHaveClass('text-icon-neutral');
    expect(screen.getByText(spanIncludesCurrency(5080.17))).toBeInTheDocument();
    expect(
      document.querySelector('.sm\\:grid-cols-\\[120px_minmax\\(0\\,1fr\\)_auto_1\\.5rem_auto\\]'),
    ).toBeInTheDocument();
    expect(document.querySelector('.sm\\:col-start-3')).toHaveTextContent('cart.qty: 1');
  });

  it('keeps the icon, code, and amount on one line and truncates a long code', async () => {
    const code = 'VKTEST-PROMO01-EXTRA';

    render(
      <CartItemRow
        cart={cart}
        item={buildItem({
          tax: { amount: 1, currency: 'EUR', netValue: 10, grossValue: 11.9 },
          price: { amount: 11.9, currency: 'EUR' },
          originalNet: 20,
          couponDiscounts: [{ code, amount: 6.8, currency: 'EUR', type: 'ABSOLUTE' }],
        })}
      />,
    );

    const row = screen.getByTestId(`cart-item-coupon-prod-1-${code}`);
    expect(row).toHaveClass('flex-nowrap', 'justify-start', 'sm:justify-end');
    expect(screen.getByTestId(`cart-item-couponAmount-prod-1-${code}`)).toHaveClass('order-1', 'sm:order-none');
    expect(row.textContent?.replace(/\s+/g, ' ')).toContain(`VKTEST-PROMO01-E…${currencyText(-6.8)}`);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.focus(screen.getByTestId(`cart-item-couponCode-prod-1-${code}`));

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent(code);
    });
  });

  it('keeps a plain net and gross when the line has no coupon', () => {
    render(
      <CartItemRow
        cart={cart}
        item={buildItem({
          tax: { amount: 19, currency: 'EUR', netValue: 100, grossValue: 119 },
        })}
      />,
    );

    expect(screen.queryByTestId('cart-item-originalNet-prod-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId(/cart-item-coupon-/)).not.toBeInTheDocument();
    const net = screen.getByText(matchesCurrency(100));
    expect(net).toBeInTheDocument();
    expect(net).not.toHaveClass('text-text-error');
  });

  it('strikes the goods net when a fee lifts the payable net above the original price', () => {
    render(
      <CartItemRow
        cart={cart}
        item={buildItem({
          tax: { amount: 20, currency: 'EUR', netValue: 110, grossValue: 130 },
          price: { amount: 130, currency: 'EUR' },
          originalNet: 100,
          couponDiscounts: [{ code: 'SAVE10', amount: 10, currency: 'EUR', type: 'ABSOLUTE' }],
        })}
      />,
    );

    expect(screen.getByTestId('cart-item-originalNet-prod-1')).toHaveTextContent(currencyText(100));
    expect(screen.getByTestId('cart-item-coupon-prod-1-SAVE10')).toBeInTheDocument();
    expect(screen.getByText(matchesCurrency(110))).not.toHaveClass('text-text-error');
  });
});

describe('CartItemRow quantity restore', () => {
  beforeEach(() => {
    mockUpdateItemQuantity.mockReset();
    mockRemoveItem.mockReset();
    mockUpdateItemQuantity.mockResolvedValue(undefined);
    mockRemoveItem.mockResolvedValue({ leftoverCouponsCleared: true });
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

  it('does not toast leftover coupons when empty-cart coupon cleanup failed', async () => {
    mockRemoveItem.mockResolvedValueOnce({ leftoverCouponsCleared: false });
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
