/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { CheckoutShipping } from './checkout-shipping';

const applyShippingDestinationToCart = jest.fn();
const useCheckoutMock = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/hooks/checkout/useCheckout', () => ({
  useCheckout: () => useCheckoutMock(),
}));

jest.mock('../address/address-selector', () => ({
  AddressSelector: () => null,
}));
jest.mock('../common/address-display', () => ({
  AddressDisplay: () => null,
}));
jest.mock('./checkout-address', () => () => null);
jest.mock('./shipping-method', () => () => null);
jest.mock('./checkout-validation-registry', () => ({
  useRegisterSectionExpander: jest.fn(),
}));
jest.mock('../ui/toast-notification', () => ({
  ToastType: { Error: 'error' },
  notify: jest.fn(),
}));

describe('CheckoutShipping leftover destination', () => {
  beforeEach(() => {
    applyShippingDestinationToCart.mockReset().mockResolvedValue(undefined);
  });

  it('writes leftover checkout ship-to onto the current cart on mount', () => {
    const shippingAddress = { type: 'SHIPPING', country: 'CH', zipCode: '6300' };
    useCheckoutMock.mockReturnValue({
      availableShippingMethods: [{ id: 'm1' }],
      checkoutCart: { id: 'cart-2' },
      shippingAddress,
      shippingMethod: { methodId: 'm1', methodName: 'Standard' },
      shippingMethodsLoading: false,
      submitShippingAddress: jest.fn(),
      applyShippingDestinationToCart,
    });

    render(<CheckoutShipping initialEdit={false} />);

    expect(applyShippingDestinationToCart).toHaveBeenCalledWith(shippingAddress);
  });

  it('does not write destination when checkout has no leftover ship-to', () => {
    useCheckoutMock.mockReturnValue({
      availableShippingMethods: [],
      checkoutCart: { id: 'cart-2' },
      shippingAddress: null,
      shippingMethod: null,
      shippingMethodsLoading: false,
      submitShippingAddress: jest.fn(),
      applyShippingDestinationToCart,
    });

    render(<CheckoutShipping initialEdit={false} />);

    expect(applyShippingDestinationToCart).not.toHaveBeenCalled();
  });
});
