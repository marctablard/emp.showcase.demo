/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { notify } from '@/components/ui/toast-notification';
import QuoteRequestDialog from './quote-request-dialog';

const push = jest.fn();
const clearCart = jest.fn();
const applyShippingDestinationToCart = jest.fn();
const resetCheckout = jest.fn();
const toast = jest.fn();
const useCheckoutMock = jest.fn();
const useGlobalSyncReadyMock = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { total?: string }) =>
    values?.total != null ? `${key} ${values.total}` : key,
  useLocale: () => 'en',
}));

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push,
  }),
}));

jest.mock('@/hooks/cart/useCart', () => ({
  useCart: () => ({
    clearCart,
  }),
}));

jest.mock('@/hooks/checkout/useCheckout', () => ({
  useCheckout: () => useCheckoutMock(),
}));

jest.mock('@/hooks/ui/useToast', () => ({
  useToast: () => ({ toast }),
}));

jest.mock('@/hooks/common/useGlobalSyncReady', () => ({
  useGlobalSyncReady: () => useGlobalSyncReadyMock(),
}));

jest.mock('@/components/ui/toast-notification', () => ({
  ToastType: { Warning: 'warning', Success: 'success', Error: 'error', Info: 'info' },
  notify: jest.fn(),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    error: jest.fn(),
  }),
}));

jest.mock('@/components/address/address-selector', () => ({
  AddressSelector: ({
    triggerElement,
    onSelect,
    onOpenChange,
    addressType,
  }: {
    triggerElement: React.ReactNode;
    onSelect: (address: { id: string; country: string; zipCode: string; city: string; contactName: string }) => void;
    onOpenChange?: (open: boolean) => void;
    addressType?: string;
  }) => (
    <div>
      {triggerElement}
      <button
        type="button"
        data-testid={`quote-addressbook-pick-${addressType ?? 'any'}-DE`}
        onClick={() => {
          onOpenChange?.(true);
          onSelect({
            id: 'addr-de',
            country: 'DE',
            zipCode: '10115',
            city: 'Berlin',
            contactName: 'Vitalii Buyer',
          });
          onOpenChange?.(false);
        }}
      >
        pick DE
      </button>
      <button
        type="button"
        data-testid={`quote-addressbook-pick-${addressType ?? 'any'}-CH`}
        onClick={() => {
          onOpenChange?.(true);
          onSelect({
            id: 'addr-ch',
            country: 'CH',
            zipCode: '63000',
            city: 'Zug',
            contactName: 'Swiss Office',
          });
          onOpenChange?.(false);
        }}
      >
        pick CH
      </button>
    </div>
  ),
}));

jest.mock('@/components/checkout/checkout-address', () => () => <div>CheckoutAddress</div>);
jest.mock('@/components/checkout/shipping-method', () => () => <div>ShippingMethod</div>);

describe('QuoteRequestDialog', () => {
  beforeEach(() => {
    clearCart.mockReset();
    applyShippingDestinationToCart.mockReset().mockResolvedValue(undefined);
    resetCheckout.mockReset();
    push.mockReset();
    toast.mockReset();
    (notify as jest.Mock).mockReset();
    useGlobalSyncReadyMock.mockReturnValue({ ready: true });
    useCheckoutMock.mockReturnValue({
      checkoutCart: { id: 'cart-1', items: [{ id: 'item-1' }], totalPrice: { amount: 82.3, currency: 'EUR' } },
      shippingAddress: { id: 'shipping-1', country: 'CH', zipCode: '6300' },
      billingAddress: { id: 'billing-1' },
      shippingMethod: { amount: 5, methodId: 'method-1', zoneId: 'zone-1', taxCode: 'STANDARD' },
      submitShippingAddress: jest.fn(),
      submitBillingAddress: jest.fn(),
      applyShippingDestinationToCart,
      reset: resetCheckout,
    });
    global.fetch = jest.fn();
  });

  it('submits the standard request-only quote payload with the entered inputs and applies success side effects', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ quoteId: 'Q-1000' }),
    });

    const onOpenChange = jest.fn();
    render(<QuoteRequestDialog open onOpenChange={onOpenChange} />);

    fireEvent.change(screen.getByTestId('quote-reference'), { target: { value: 'REF-42' } });
    fireEvent.change(screen.getByTestId('quote-comment'), { target: { value: 'Need expedited review' } });

    fireEvent.click(screen.getByTestId('quote-sendButton'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const [, request] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(String(request.body))).toMatchObject({
      cartId: 'cart-1',
      billingAddressId: 'billing-1',
      shippingAddressId: 'shipping-1',
      intent: 'REQUEST',
      reference: 'REF-42',
      userComment: 'Need expedited review',
    });

    expect(applyShippingDestinationToCart).toHaveBeenCalledWith(
      expect.objectContaining({ country: 'CH', zipCode: '6300' }),
    );
    expect(applyShippingDestinationToCart.mock.invocationCallOrder[0]).toBeLessThan(
      (global.fetch as jest.Mock).mock.invocationCallOrder[0],
    );
    expect(clearCart).toHaveBeenCalledWith({ deleteCart: true });
    expect(resetCheckout).toHaveBeenCalledWith({ keepAddresses: true });
    expect(push).toHaveBeenCalledWith('/account/quotes/Q-1000');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not clear the cart or redirect when the quote request fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue({ error: 'Failed to create quote' }),
    });

    render(<QuoteRequestDialog open onOpenChange={jest.fn()} />);

    fireEvent.click(screen.getByTestId('quote-sendButton'));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'failedTitle',
          description: 'Failed to create quote',
        }),
      );
    });

    expect(clearCart).not.toHaveBeenCalled();
    expect(resetCheckout).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('does not create a quote when the selected shipping address has no country and zip', async () => {
    useCheckoutMock.mockReturnValue({
      checkoutCart: { id: 'cart-1', items: [{ id: 'item-1' }] },
      shippingAddress: { id: 'shipping-1' },
      billingAddress: { id: 'billing-1' },
      shippingMethod: { amount: 5, methodId: 'method-1', zoneId: 'zone-1', taxCode: 'STANDARD' },
      submitShippingAddress: jest.fn(),
      submitBillingAddress: jest.fn(),
      applyShippingDestinationToCart,
      reset: resetCheckout,
    });

    render(<QuoteRequestDialog open onOpenChange={jest.fn()} />);
    fireEvent.click(screen.getByTestId('quote-sendButton'));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'failedTitle',
          description: 'failedDescription',
        }),
      );
    });

    expect(applyShippingDestinationToCart).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(clearCart).not.toHaveBeenCalled();
  });

  it('writes leftover checkout ship-to onto the current cart when the dialog opens', () => {
    render(<QuoteRequestDialog open onOpenChange={jest.fn()} />);

    expect(applyShippingDestinationToCart).toHaveBeenCalledWith(
      expect.objectContaining({ country: 'CH', zipCode: '6300' }),
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fills a shipping address-book pick without closing the quote dialog', () => {
    const onOpenChange = jest.fn();
    const submitShippingAddress = jest.fn();
    useCheckoutMock.mockReturnValue({
      checkoutCart: { id: 'cart-1', items: [{ id: 'item-1' }], totalPrice: { amount: 82.3, currency: 'EUR' } },
      shippingAddress: { id: 'shipping-1', country: 'DE', zipCode: '10115' },
      billingAddress: { id: 'billing-1' },
      shippingMethod: { amount: 5, methodId: 'method-1', zoneId: 'zone-1', taxCode: 'STANDARD' },
      submitShippingAddress,
      submitBillingAddress: jest.fn(),
      applyShippingDestinationToCart,
      reset: resetCheckout,
    });

    render(<QuoteRequestDialog open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByTestId('quote-addressbook-pick-SHIPPING-CH'));

    expect(submitShippingAddress).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'addr-ch', country: 'CH', zipCode: '63000', type: 'SHIPPING' }),
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText('title')).toBeInTheDocument();
  });

  it('notifies when an address-book pick from DE to CH changes the cart total', async () => {
    const deCart = { id: 'cart-1', items: [{ id: 'item-1' }], totalPrice: { amount: 82.3, currency: 'EUR' } };
    const chCart = { id: 'cart-1', items: [{ id: 'item-1' }], totalPrice: { amount: 119.05, currency: 'CHF' } };
    const checkoutState = {
      checkoutCart: deCart,
      shippingAddress: { id: 'addr-de', country: 'DE', zipCode: '10115' },
      billingAddress: { id: 'billing-1' },
      shippingMethod: { amount: 5, methodId: 'method-1', zoneId: 'zone-1', taxCode: 'STANDARD' },
      submitShippingAddress: jest.fn(),
      submitBillingAddress: jest.fn(),
      applyShippingDestinationToCart,
      reset: resetCheckout,
    };
    useCheckoutMock.mockImplementation(() => checkoutState);

    const { rerender } = render(<QuoteRequestDialog open onOpenChange={jest.fn()} />);
    fireEvent.click(screen.getByTestId('quote-addressbook-pick-SHIPPING-CH'));
    expect(checkoutState.submitShippingAddress).toHaveBeenCalledWith(
      expect.objectContaining({ country: 'CH', zipCode: '63000' }),
    );

    checkoutState.checkoutCart = chCart;
    checkoutState.shippingAddress = { id: 'addr-ch', country: 'CH', zipCode: '63000' };
    rerender(<QuoteRequestDialog open onOpenChange={jest.fn()} />);

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/totalChanged/),
          type: 'info',
        }),
      );
    });
    expect(String((notify as jest.Mock).mock.calls[0][0].title)).toMatch(/119|CHF|Fr/);
    expect(screen.getByText('title')).toBeInTheDocument();
  });

  it('waits until country sync finishes before notifying about a DE to CH total change', async () => {
    const deCart = { id: 'cart-1', items: [{ id: 'item-1' }], totalPrice: { amount: 82.3, currency: 'EUR' } };
    const chCart = { id: 'cart-1', items: [{ id: 'item-1' }], totalPrice: { amount: 119.05, currency: 'CHF' } };
    const checkoutState = {
      checkoutCart: deCart,
      shippingAddress: { id: 'addr-de', country: 'DE', zipCode: '10115' },
      billingAddress: { id: 'billing-1' },
      shippingMethod: { amount: 5, methodId: 'method-1', zoneId: 'zone-1', taxCode: 'STANDARD' },
      submitShippingAddress: jest.fn(),
      submitBillingAddress: jest.fn(),
      applyShippingDestinationToCart,
      reset: resetCheckout,
    };
    useCheckoutMock.mockImplementation(() => checkoutState);
    useGlobalSyncReadyMock.mockReturnValue({ ready: false, reason: 'session-mutation' });

    const { rerender } = render(<QuoteRequestDialog open onOpenChange={jest.fn()} />);
    fireEvent.click(screen.getByTestId('quote-addressbook-pick-SHIPPING-CH'));
    checkoutState.checkoutCart = chCart;
    rerender(<QuoteRequestDialog open onOpenChange={jest.fn()} />);

    expect(notify).not.toHaveBeenCalled();
    expect(screen.getByText('title')).toBeInTheDocument();

    useGlobalSyncReadyMock.mockReturnValue({ ready: true });
    rerender(<QuoteRequestDialog open onOpenChange={jest.fn()} />);

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/totalChanged/),
          type: 'info',
        }),
      );
    });
  });

  it('does not notify when an address-book pick keeps the same country and zip', async () => {
    const deCart = { id: 'cart-1', items: [{ id: 'item-1' }], totalPrice: { amount: 82.3, currency: 'EUR' } };
    const laterCart = { id: 'cart-1', items: [{ id: 'item-1' }], totalPrice: { amount: 154.7, currency: 'EUR' } };
    const checkoutState = {
      checkoutCart: deCart,
      shippingAddress: { id: 'addr-de', country: 'DE', zipCode: '10115' },
      billingAddress: { id: 'billing-1' },
      shippingMethod: { amount: 5, methodId: 'method-1', zoneId: 'zone-1', taxCode: 'STANDARD' },
      submitShippingAddress: jest.fn(),
      submitBillingAddress: jest.fn(),
      applyShippingDestinationToCart,
      reset: resetCheckout,
    };
    useCheckoutMock.mockImplementation(() => checkoutState);

    const { rerender } = render(<QuoteRequestDialog open onOpenChange={jest.fn()} />);
    fireEvent.click(screen.getByTestId('quote-addressbook-pick-SHIPPING-DE'));
    checkoutState.checkoutCart = laterCart;
    rerender(<QuoteRequestDialog open onOpenChange={jest.fn()} />);

    await waitFor(() => {
      expect(checkoutState.submitShippingAddress).toHaveBeenCalled();
    });
    expect(notify).not.toHaveBeenCalled();
  });

  it('does not notify when a DE to CH address-book pick keeps the same total', async () => {
    const deCart = { id: 'cart-1', items: [{ id: 'item-1' }], totalPrice: { amount: 100, currency: 'EUR' } };
    const chCart = { id: 'cart-1', items: [{ id: 'item-1' }], totalPrice: { amount: 100, currency: 'EUR' } };
    const checkoutState = {
      checkoutCart: deCart,
      shippingAddress: { id: 'addr-de', country: 'DE', zipCode: '10115' },
      billingAddress: { id: 'billing-1' },
      shippingMethod: { amount: 5, methodId: 'method-1', zoneId: 'zone-1', taxCode: 'STANDARD' },
      submitShippingAddress: jest.fn(),
      submitBillingAddress: jest.fn(),
      applyShippingDestinationToCart,
      reset: resetCheckout,
    };
    useCheckoutMock.mockImplementation(() => checkoutState);

    const { rerender } = render(<QuoteRequestDialog open onOpenChange={jest.fn()} />);
    fireEvent.click(screen.getByTestId('quote-addressbook-pick-SHIPPING-CH'));
    checkoutState.checkoutCart = chCart;
    rerender(<QuoteRequestDialog open onOpenChange={jest.fn()} />);

    await waitFor(() => {
      expect(checkoutState.submitShippingAddress).toHaveBeenCalled();
    });
    expect(notify).not.toHaveBeenCalled();
  });

  it('shows the request-only dialog copy and never renders inquiry-only controls', () => {
    render(<QuoteRequestDialog open onOpenChange={jest.fn()} />);

    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('subtitle')).toBeInTheDocument();
    expect(screen.queryByText('inquiryTitle')).not.toBeInTheDocument();
    expect(screen.queryByText('inquirySubtitle')).not.toBeInTheDocument();
    expect(screen.queryByText('approverLabel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quote-partial-failure-alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('quote-sendButton')).toHaveTextContent('sendQuote');
  });
});
