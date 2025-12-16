'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { checkout } from '@/lib/client/checkout';
import { PaymentMode } from '@/platform/services/model';
import { Cart } from '@/platform/services/model/cart/cart';
import type {
  CheckoutAddress,
  CheckoutPaymentMethod,
  CheckoutRequest,
  CheckoutResponse,
  ContactData,
  OrderShipping,
} from '@/platform/services/model/checkout';
import { ShippingMethod } from '@/platform/services/model/shipping';
import { useCheckoutStore } from '@/providers/StoreProvider';
import { useCart } from '../cart/useCart';
import { useAddresses } from '../customer/useAddresses';
import useCustomer from '../customer/useCustomer';
import { useShippingMethods } from '../shipping/useShippingMethods';
import { useSite } from '../site/useSite';

interface UseCheckout {
  // Status
  loading: boolean;
  error: Error | null;
  // Data
  checkoutCart: Cart | null | undefined;
  contactData: ContactData | null;
  billingAddress: CheckoutAddress | null;
  shippingAddress: CheckoutAddress | null;
  orderResponse: CheckoutResponse | null;
  shippingMethod: OrderShipping | null;
  paymentMethod: CheckoutPaymentMethod | null;
  availableShippingMethods: ShippingMethod[];
  shippingMethodsLoading: boolean;
  // Data submission
  submitContactData: (contactData: ContactData) => void;
  submitShippingAddress: (address: CheckoutAddress) => void;
  submitBillingAddress: (address: CheckoutAddress) => void;
  submitPaymentMethod: (method: CheckoutPaymentMethod) => void;
  submitShippingMethod: (method: ShippingMethod) => void;
  // Operations
  createCheckoutData: () => CheckoutRequest | null;
  processCheckout: () => Promise<CheckoutResponse | null>;
  processQuoteCheckout: (quoteId: string, paymentMethod: CheckoutPaymentMethod) => Promise<CheckoutResponse | null>;
  reset: () => void;
}

/**
 * Hook for processing checkout operations
 *
 * @returns Checkout operations and state
 */
export const useCheckout = (): UseCheckout => {
  // Get checkout store data
  const {
    contactData,
    billingAddress,
    shippingAddress,
    paymentMethod,
    shippingMethod,
    setContactData,
    setBillingAddress,
    setShippingAddress,
    setPaymentMethod,
    setShippingMethod,
    reset: storeReset,
  } = useCheckoutStore();

  // Get cart from cart store
  const { cart: checkoutCart, updateShippingInfo, clearCart } = useCart();
  const { customer } = useCustomer();
  const { getDefaultAddress, loading: addressesLoading } = useAddresses();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [orderResponse, setOrderResponse] = useState<CheckoutResponse | null>(null);
  const {
    shippingMethods: availableShippingMethods,
    clearShippingMethods,
    fetchShippingMethods,
    loading: shippingMethodsLoading,
  } = useShippingMethods();
  const { paymentModes } = useSite();
  const searchParams = useSearchParams();
  const { status } = useSession();

  // Check for logout query parameter and reset store if present
  useEffect(() => {
    if (searchParams.has('logout')) {
      storeReset();
    }
  }, [searchParams, storeReset]);

  const submitContactData = useCallback(
    (contactData: ContactData) => {
      // TODO validation!
      setContactData(contactData);
    },
    [setContactData],
  );

  const submitShippingAddress = useCallback(
    (address: CheckoutAddress) => {
      // TODO validation!
      if (
        checkoutCart?.id &&
        (address.country != shippingAddress?.country || address.zipCode != shippingAddress?.zipCode)
      ) {
        updateShippingInfo(address.country, address.zipCode);
      }
      setShippingAddress(address);
    },
    [checkoutCart?.id, shippingAddress, setShippingAddress, updateShippingInfo],
  );

  const submitBillingAddress = useCallback(
    (address: CheckoutAddress) => {
      // TODO validation!
      setBillingAddress(address);
    },
    [setBillingAddress],
  );

  const submitPaymentMethod = useCallback(
    (method: CheckoutPaymentMethod) => {
      setPaymentMethod(method);
    },
    [setPaymentMethod],
  );

  const submitShippingMethod = useCallback(
    (method: ShippingMethod) => {
      setShippingMethod({
        methodId: method.id,
        zoneId: method.zoneId,
        methodName: method.name,
        amount: method.cost?.amount || 0,
        taxCode: method.taxCode,
      });
    },
    [setShippingMethod],
  );

  const createCheckoutData = () => {
    if (!checkoutCart) {
      setError(new Error('No cart available for checkout'));
      return null;
    }
    // Validate each required checkout component individually
    if (!shippingMethod) {
      setError(new Error('Missing shipping method'));
      return null;
    }

    if (!billingAddress) {
      setError(new Error('Missing billing address'));
      return null;
    }

    if (!shippingAddress) {
      setError(new Error('Missing shipping address'));
      return null;
    }

    if (!customer && !contactData) {
      setError(new Error('Missing contact information'));
      return null;
    }

    if (!paymentMethod) {
      setError(new Error('Missing payment method'));
      return null;
    }

    return {
      cartId: checkoutCart.id,
      shipping: shippingMethod,
      addresses: [billingAddress, shippingAddress],
      customer: contactData,
      paymentMethod: paymentMethod,
      summary: {
        termsAndConditions: true,
      },
    };
  };

  /**
   * Process a checkout for the current cart
   */
  const processCheckout = async (): Promise<CheckoutResponse | null> => {
    try {
      setLoading(true);
      setError(null);

      const checkoutData = createCheckoutData();
      if (!checkoutData) {
        throw new Error('Failed to create checkout data');
      }

      const checkoutResponse = await checkout(checkoutData);

      if (!checkoutResponse) {
        throw new Error('Failed to process checkout');
      }

      clearCart();
      setShippingMethod(null);
      setPaymentMethod(null);
      setShippingAddress(null);
      setBillingAddress(null);
      setOrderResponse(checkoutResponse);
      return checkoutResponse;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to process checkout');
      setError(error);
      console.error('Error processing checkout:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Process a checkout from a quote
   */
  const processQuoteCheckout = async (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    quoteId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    paymentMethod: CheckoutPaymentMethod,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    deliveryWindowId?: string,
  ): Promise<CheckoutResponse | null> => {
    try {
      setLoading(true);
      setError(null);

      throw new Error('Not implemented');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to process quote checkout');
      setError(error);
      console.error('Error processing quote checkout:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reset the checkout state
   */
  const reset = () => {
    setError(null);
    setOrderResponse(null);
    storeReset();
  };

  useEffect(() => {
    if (checkoutCart && shippingAddress) {
      if (shippingAddress.country && shippingAddress.zipCode) {
        fetchShippingMethods(shippingAddress.country, shippingAddress.zipCode, checkoutCart.totalPrice);
      }
    } else {
      clearShippingMethods();
    }
  }, [shippingAddress, checkoutCart, fetchShippingMethods, clearShippingMethods]);

  useEffect(() => {
    if (checkoutCart && availableShippingMethods.length > 0) {
      let newShippingMethod: ShippingMethod | null = null;
      if (shippingMethod) {
        newShippingMethod = availableShippingMethods.find((method) => method.id === shippingMethod.methodId) || null;
      }
      if (!newShippingMethod) {
        newShippingMethod = availableShippingMethods.sort((a, b) => (a.cost?.amount || 0) - (b.cost?.amount || 0))[0];
      }
      submitShippingMethod(newShippingMethod);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableShippingMethods, checkoutCart, submitShippingMethod]);

  useEffect(() => {
    if (checkoutCart && paymentModes && paymentModes.length > 0) {
      let newPaymentMethod: PaymentMode | null = null;
      if (paymentMethod) {
        newPaymentMethod = paymentModes.find((method) => method.id === paymentMethod.id) || null;
      }
      if (!newPaymentMethod) {
        newPaymentMethod = paymentModes[0];
      }
      submitPaymentMethod({
        ...newPaymentMethod,
        provider: 'none',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentModes, checkoutCart, submitPaymentMethod]);

  useEffect(() => {
    // Only load default addresses if we're not on the logout page
    // This prevents re-populating addresses after logout
    if (!addressesLoading && status === 'authenticated') {
      if (!shippingAddress) {
        const defaultShippingAddress = getDefaultAddress('SHIPPING');
        if (defaultShippingAddress) {
          submitShippingAddress({
            ...defaultShippingAddress,
            type: 'SHIPPING',
          });
        }
      }
      if (!billingAddress) {
        const defaultBillingAddress = getDefaultAddress('BILLING');
        if (defaultBillingAddress) {
          submitBillingAddress({
            ...defaultBillingAddress,
            type: 'BILLING',
          });
        }
      }
      setLoading(false);
    }
  }, [
    addressesLoading,
    shippingAddress,
    billingAddress,
    getDefaultAddress,
    submitBillingAddress,
    submitShippingAddress,
    setLoading,
    status,
  ]);

  return {
    loading,
    error,
    checkoutCart,
    contactData,
    billingAddress,
    shippingAddress,
    shippingMethod,
    paymentMethod,
    orderResponse,
    availableShippingMethods,
    shippingMethodsLoading,
    submitContactData,
    submitShippingAddress,
    submitBillingAddress,
    submitPaymentMethod,
    submitShippingMethod,
    createCheckoutData,
    processCheckout,
    processQuoteCheckout,
    reset,
  };
};
