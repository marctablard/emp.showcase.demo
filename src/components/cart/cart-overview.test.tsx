/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Cart } from '@/platform/services/model/cart/cart';
import { CartOverview } from './cart-overview';

const useCartMock = jest.fn();
const useGlobalSyncReadyMock = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

jest.mock('./cart-project-selector', () => ({
  CartProjectSelector: () => null,
}));

jest.mock('@/hooks/cart/useCart', () => ({
  useCart: () => useCartMock(),
}));

jest.mock('@/hooks/common/useGlobalSyncReady', () => ({
  useGlobalSyncReady: () => useGlobalSyncReadyMock(),
}));

jest.mock('@/hooks/customer/useCustomer', () => ({
  __esModule: true,
  default: () => ({ customer: { id: 'c1' } }),
}));

jest.mock('./cart-action', () => ({
  CartAction: () => <div>CartAction</div>,
}));

jest.mock('./cart-delivery', () => ({
  CartDelivery: () => null,
}));

jest.mock('./cart-empty', () => ({
  CartEmpty: () => <div>CartEmpty</div>,
}));

jest.mock('./cart-itemlist', () => ({
  CartItemList: () => <div>CartItemList</div>,
}));

jest.mock('./cart-summary', () => ({
  CartSummary: ({ onRequestQuote }: { onRequestQuote: () => void }) => (
    <button type="button" onClick={onRequestQuote}>
      open-quote
    </button>
  ),
}));

jest.mock('./quote-request-dialog', () => ({
  __esModule: true,
  default: ({ open }: { open: boolean }) => <div data-testid="quote-request-dialog">{String(open)}</div>,
}));

const CART: Cart = {
  id: 'cart-1',
  currency: 'EUR',
  site: 'main',
  items: [{ id: 'item-1' } as Cart['items'][number]],
  totalPrice: { amount: 82.3, currency: 'EUR' },
  subTotalPrice: { amount: 82.3, currency: 'EUR' },
  tax: { amount: 0, currency: 'EUR', netValue: 82.3, grossValue: 82.3 },
};

describe('CartOverview quote dialog', () => {
  beforeEach(() => {
    useCartMock.mockReturnValue({ cart: CART });
    useGlobalSyncReadyMock.mockReturnValue({ ready: true });
  });

  it('keeps the quote dialog mounted when a country change starts a session mutation', () => {
    const { rerender } = render(<CartOverview />);
    fireEvent.click(screen.getByRole('button', { name: 'open-quote' }));
    expect(screen.getByTestId('quote-request-dialog')).toHaveTextContent('true');

    useGlobalSyncReadyMock.mockReturnValue({ ready: false, reason: 'session-mutation' });
    rerender(<CartOverview />);

    expect(screen.getByTestId('quote-request-dialog')).toHaveTextContent('true');
    expect(screen.getByText('title')).toBeInTheDocument();
  });
});
