/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Checkout from './checkout';

const push = jest.fn();
const clearCart = jest.fn();
const applyShippingDestinationToCart = jest.fn();
const resetCheckout = jest.fn();
const createCheckoutData = jest.fn();
const processCheckout = jest.fn();
const createApproval = jest.fn();
const useCheckoutMock = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push, refresh: jest.fn() }),
}));

jest.mock('@/hooks/cart/useCart', () => ({
  useCart: () => ({ clearCart }),
}));

jest.mock('@/hooks/checkout/useCheckout', () => ({
  useCheckout: () => useCheckoutMock(),
}));

jest.mock('@/hooks/customer/useCustomer', () => ({
  useCustomer: () => ({ customer: { id: 'customer-1' } }),
}));

jest.mock('@/lib/client/approval', () => ({
  createApproval: (...args: unknown[]) => createApproval(...args),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({ debug: jest.fn(), error: jest.fn() }),
}));

jest.mock('../ui/toast-notification', () => ({
  ToastType: { Error: 'error' },
  notify: jest.fn(),
}));

jest.mock('./checkout-itemlist', () => ({ CheckoutItemlist: () => null }));
jest.mock('./checkout-payment', () => ({ CheckoutPayment: () => null }));
jest.mock('./checkout-shipping', () => ({ CheckoutShipping: () => null }));
jest.mock('./contact-data', () => () => null);
jest.mock('./checkout-validation-registry', () => ({
  CheckoutValidationProvider: ({ children }: { children: import('react').ReactNode }) => children,
}));
jest.mock('./checkout-summary', () => ({
  __esModule: true,
  default: ({ onSubmit }: { onSubmit: (data?: { approverId: string; comment: string }) => void }) => (
    <button type="button" onClick={() => onSubmit({ approverId: 'approver-1', comment: 'please approve' })}>
      submit-approval
    </button>
  ),
}));

const shippingAddress = { type: 'SHIPPING' as const, country: 'CH', zipCode: '6300' };

describe('Checkout approval submit', () => {
  beforeEach(() => {
    push.mockReset();
    clearCart.mockReset();
    applyShippingDestinationToCart.mockReset().mockResolvedValue(undefined);
    resetCheckout.mockReset();
    processCheckout.mockReset();
    createApproval.mockReset().mockResolvedValue({ id: 'approval-1' });
    createCheckoutData.mockReset().mockReturnValue({
      cartId: 'cart-1',
      addresses: [shippingAddress],
      paymentMethod: { provider: 'invoice' },
      shipping: { methodId: 'm1', zoneId: 'z1', methodName: 'Standard', amount: 0 },
    });
    useCheckoutMock.mockReturnValue({
      loading: false,
      error: null,
      orderResponse: null,
      checkoutCart: { id: 'cart-1', currency: 'CHF' },
      shippingAddress,
      createCheckoutData,
      processCheckout,
      applyShippingDestinationToCart,
      reset: resetCheckout,
    });
  });

  it('writes cart destination before creating a CART approval and resets leftover checkout', async () => {
    render(<Checkout />);

    fireEvent.click(screen.getByRole('button', { name: 'submit-approval' }));

    await waitFor(() => {
      expect(createApproval).toHaveBeenCalledTimes(1);
    });

    expect(applyShippingDestinationToCart).toHaveBeenCalledWith(shippingAddress);
    expect(applyShippingDestinationToCart.mock.invocationCallOrder[0]).toBeLessThan(
      createApproval.mock.invocationCallOrder[0],
    );
    expect(createApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'CART',
        resourceId: 'cart-1',
        action: 'CHECKOUT',
      }),
    );
    expect(clearCart).toHaveBeenCalledWith({ deleteCart: true });
    expect(resetCheckout).toHaveBeenCalledWith({ keepAddresses: true });
    expect(push).toHaveBeenCalledWith('/confirmation/ApprovalRequested?approvalId=approval-1');
  });
});
