'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isEqual } from 'lodash';
import { checkout } from '@/lib/client/checkout';
import { ADDRESS_TYPE } from '@/lib/common/address-type-constants';
import { resolveLegalEntityIdFromSessionAndCustomer } from '@/lib/common/legal-entity-context';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { PaymentMode } from '@/platform/services/model';
import type { Cart } from '@/platform/services/model/cart/cart';
import type {
  CheckoutAddress,
  CheckoutPaymentMethod,
  CheckoutRequest,
  CheckoutResponse,
  ContactData,
  OrderShipping,
} from '@/platform/services/model/checkout';
import type { AddressType } from '@/platform/services/model/common';
import type { CustomerAddress } from '@/platform/services/model/customer/customer';
import type { ShippingMethod } from '@/platform/services/model/shipping';
import { useCheckoutStore } from '@/providers/StoreProvider';
import { useCart } from '../cart/useCart';
import { useAddresses } from '../customer/useAddresses';
import useCustomer from '../customer/useCustomer';
import { useSession as useShopSession } from '../session/useSession';
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
  submitShippingMethod: (method: ShippingMethod | null) => void;
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
  const { addresses: customerAddresses } = useAddresses();
  const { session: shopSession } = useShopSession();
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

  const submitContactData = useCallback(
    (contactData: ContactData) => {
      // TODO validation!
      setContactData(contactData);
    },
    [setContactData],
  );

  const submitShippingAddress = useCallback(
    (address: CheckoutAddress) => {
      if (isEqual(shippingAddress, address)) {
        return;
      }

      const countryOrPostalChanged =
        !shippingAddress || address.country !== shippingAddress.country || address.zipCode !== shippingAddress.zipCode;

      if (checkoutCart?.id && countryOrPostalChanged) {
        updateShippingInfo({
          contactName: address.contactName,
          companyName: address.companyName,
          street: address.street,
          streetNumber: address.streetNumber,
          streetAppendix: address.streetAppendix,
          zipCode: address.zipCode,
          city: address.city,
          country: address.country,
          state: address.state,
          contactPhone: address.contactPhone,
        });
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
    (method: ShippingMethod | null) => {
      if (!method) {
        setShippingMethod(null);
        return;
      }
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
      getLogger().error({ err }, 'Error processing checkout');
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
      getLogger().error({ err }, 'Error processing quote checkout');
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

  const shippingCountry = shippingAddress?.country;
  const shippingZip = shippingAddress?.zipCode;
  const checkoutCartId = checkoutCart?.id;
  const orderAmount = checkoutCart?.totalPrice?.amount;
  const orderCurrency = checkoutCart?.totalPrice?.currency;

  const lastShippingRatesKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!checkoutCartId || !shippingCountry || !shippingZip) {
      lastShippingRatesKeyRef.current = null;
      clearShippingMethods();
      return;
    }

    const amountKey =
      orderAmount !== undefined && orderCurrency !== undefined && orderCurrency !== ''
        ? `${orderCurrency}:${Number.isFinite(orderAmount) ? (Math.round(orderAmount * 100) / 100).toFixed(2) : String(orderAmount)}`
        : '';

    const ratesKey = `${checkoutCartId}|${shippingCountry}|${shippingZip}|${amountKey}`;
    if (ratesKey === lastShippingRatesKeyRef.current) {
      return;
    }
    lastShippingRatesKeyRef.current = ratesKey;

    // Drop stale rates and any previously selected method synchronously so the
    // auto-selection effect cannot re-pick from the previous list while the new
    // fetch is in flight.
    clearShippingMethods();
    if (shippingMethod) {
      submitShippingMethod(null);
    }

    const orderValue =
      orderAmount !== undefined && orderCurrency !== undefined && orderCurrency !== ''
        ? { amount: orderAmount, currency: orderCurrency }
        : undefined;
    void fetchShippingMethods(shippingCountry, shippingZip, orderValue);
  }, [
    checkoutCartId,
    shippingCountry,
    shippingZip,
    orderAmount,
    orderCurrency,
    fetchShippingMethods,
    clearShippingMethods,
    shippingMethod,
    submitShippingMethod,
  ]);

  useEffect(() => {
    if (!checkoutCartId) {
      return;
    }

    if (availableShippingMethods.length === 0) {
      // Clear stale shipping method when no methods are available for this currency/zone
      submitShippingMethod(null);
      return;
    }

    let newShippingMethod: ShippingMethod | null = null;
    if (shippingMethod) {
      newShippingMethod = availableShippingMethods.find((method) => method.id === shippingMethod.methodId) || null;
    }
    if (!newShippingMethod) {
      newShippingMethod = [...availableShippingMethods].sort(
        (a, b) => (a.cost?.amount || 0) - (b.cost?.amount || 0),
      )[0];
    }
    submitShippingMethod(newShippingMethod);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shippingMethod excluded: this effect SETS it, including it would cause an infinite loop
  }, [availableShippingMethods, checkoutCartId, submitShippingMethod]);

  // B2C-only address prefill: when the user has a default customer address and
  // no shipping/billing has been picked yet, seed it from the profile. B2B
  // users (carrying a legalEntityId) must choose a legal-entity location
  // explicitly — no prefill so the wrong company address never becomes the
  // default silently.
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (prefilledRef.current) {
      return;
    }
    if (!customer) {
      return;
    }
    const hasLegalEntity = Boolean(resolveLegalEntityIdFromSessionAndCustomer(shopSession, customer));
    const isB2B = customer.businessModel === 'B2B' || hasLegalEntity;
    if (isB2B) {
      return;
    }
    if (!customerAddresses || customerAddresses.length === 0) {
      return;
    }
    const pickForTag = (tag: AddressType): CustomerAddress | undefined => {
      const tagged = customerAddresses.filter((addr) => addr.tags.includes(tag));
      if (tagged.length === 0) {
        return undefined;
      }
      return tagged.find((addr) => addr.isDefault) ?? tagged[0];
    };
    const shippingSource = pickForTag(ADDRESS_TYPE.SHIPPING);
    const billingSource = pickForTag(ADDRESS_TYPE.BILLING);
    const applyIfEmpty = (
      current: CheckoutAddress | null,
      source: CustomerAddress | undefined,
      type: 'SHIPPING' | 'BILLING',
      submit: (addr: CheckoutAddress) => void,
    ): boolean => {
      if (!source || current) {
        return false;
      }
      if (type === ADDRESS_TYPE.SHIPPING && !source.tags.includes(ADDRESS_TYPE.SHIPPING)) {
        return false;
      }
      if (type === ADDRESS_TYPE.BILLING && !source.tags.includes(ADDRESS_TYPE.BILLING)) {
        return false;
      }
      submit({
        id: source.id,
        contactName: source.contactName,
        companyName: source.companyName,
        street: source.street,
        streetNumber: source.streetNumber,
        streetAppendix: source.streetAppendix,
        zipCode: source.zipCode,
        city: source.city,
        country: source.country,
        state: source.state,
        contactPhone: source.contactPhone,
        type,
      });
      return true;
    };
    const appliedShipping = applyIfEmpty(shippingAddress, shippingSource, ADDRESS_TYPE.SHIPPING, submitShippingAddress);
    const appliedBilling = applyIfEmpty(billingAddress, billingSource, ADDRESS_TYPE.BILLING, submitBillingAddress);
    if (appliedShipping || appliedBilling) {
      prefilledRef.current = true;
    }
  }, [
    customer,
    customerAddresses,
    shopSession,
    shippingAddress,
    billingAddress,
    submitShippingAddress,
    submitBillingAddress,
  ]);

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
