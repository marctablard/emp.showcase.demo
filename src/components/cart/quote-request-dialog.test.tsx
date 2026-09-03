/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import QuoteRequestDialog from './quote-request-dialog';

const push = jest.fn();
const clearCart = jest.fn();
const applyShippingDestinationToCart = jest.fn();
const resetCheckout = jest.fn();
const toast = jest.fn();
const useCheckoutMock = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
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

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    error: jest.fn(),
  }),
}));

jest.mock('@/components/address/address-selector', () => ({
  AddressSelector: ({ triggerElement }: { triggerElement: React.ReactNode }) => <div>{triggerElement}</div>,
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
    useCheckoutMock.mockReturnValue({
      checkoutCart: { id: 'cart-1', items: [{ id: 'item-1' }] },
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
