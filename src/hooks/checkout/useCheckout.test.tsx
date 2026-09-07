import { act, renderHook } from '@testing-library/react';
import { checkout } from '@/lib/client/checkout';
import type { CheckoutAddress } from '@/platform/services/model/checkout';
import { checkoutAddressToCartShipping, hasCheckoutShippingDestination, useCheckout } from './useCheckout';

const mockUseCheckoutStore = jest.fn();
const mockUseCart = jest.fn();
const mockUseCustomer = jest.fn();
const mockUseShippingMethods = jest.fn();
const mockUseSite = jest.fn();
const mockUseAddresses = jest.fn();
const mockUseShopSession = jest.fn();

jest.mock('@/providers/StoreProvider', () => ({
  useCheckoutStore: () => mockUseCheckoutStore(),
}));

jest.mock('../cart/useCart', () => ({
  useCart: () => mockUseCart(),
}));

jest.mock('../customer/useCustomer', () => ({
  __esModule: true,
  default: () => mockUseCustomer(),
  useCustomer: () => mockUseCustomer(),
}));

jest.mock('../customer/useAddresses', () => ({
  useAddresses: () => mockUseAddresses(),
}));

jest.mock('../session/useSession', () => ({
  useSession: () => mockUseShopSession(),
}));

jest.mock('../shipping/useShippingMethods', () => ({
  useShippingMethods: () => mockUseShippingMethods(),
}));

jest.mock('../site/useSite', () => ({
  useSite: () => mockUseSite(),
}));

jest.mock('@/lib/client/checkout', () => ({
  checkout: jest.fn(),
}));

type ShippingAddress = {
  country: string;
  zipCode: string;
} | null;

type CheckoutCart = {
  id: string;
  totalPrice: { amount: number; currency: string };
  subTotalPrice?: { amount: number; currency: string };
} | null;

type SelectedMethod = {
  methodId: string;
  zoneId: string;
  methodName: string;
  amount: number;
  taxCode: string;
} | null;

const buildCheckoutStoreValue = (overrides: {
  shippingAddress: ShippingAddress;
  shippingMethod: SelectedMethod;
  setShippingMethod: jest.Mock;
}) => ({
  contactData: null,
  billingAddress: null,
  shippingAddress: overrides.shippingAddress,
  paymentMethod: null,
  shippingMethod: overrides.shippingMethod,
  setContactData: jest.fn(),
  setBillingAddress: jest.fn(),
  setShippingAddress: jest.fn(),
  setPaymentMethod: jest.fn(),
  setShippingMethod: overrides.setShippingMethod,
  reset: jest.fn(),
});

const buildCartValue = (
  cart: CheckoutCart,
  updateShippingInfo: jest.Mock = jest.fn(),
  updateShippingMethod: jest.Mock = jest.fn(),
) => ({
  cart,
  loading: false,
  updateShippingInfo,
  updateShippingMethod,
  clearCart: jest.fn(),
});

const buildCheckoutAddress = (type: 'SHIPPING' | 'BILLING', country: string, zipCode: string): CheckoutAddress => ({
  contactName: 'Test Buyer',
  street: 'Bahnhofstrasse',
  zipCode,
  city: country === 'CH' ? 'Zug' : 'Berlin',
  country,
  type,
});

const buildShippingMethodsValue = (overrides: {
  methods: Array<{ id: string; name?: string; cost?: { amount: number } }>;
  clearShippingMethods: jest.Mock;
  fetchShippingMethods: jest.Mock;
}) => ({
  shippingMethods: overrides.methods,
  clearShippingMethods: overrides.clearShippingMethods,
  fetchShippingMethods: overrides.fetchShippingMethods,
  loading: false,
  error: null,
});

describe('useCheckout', () => {
  const DE_ADDRESS: ShippingAddress = { country: 'DE', zipCode: '10115' };
  const CH_ADDRESS: ShippingAddress = { country: 'CH', zipCode: '6300' };
  const CART: CheckoutCart = {
    id: 'cart-1',
    totalPrice: { amount: 100, currency: 'EUR' },
  };
  const SELECTED_METHOD: SelectedMethod = {
    methodId: 'de-standard',
    zoneId: 'zone-de',
    methodName: 'DE Standard',
    amount: 5,
    taxCode: 'vat',
  };

  beforeEach(() => {
    mockUseCustomer.mockReturnValue({ customer: null });
    mockUseSite.mockReturnValue({ paymentModes: [], site: null });
    mockUseAddresses.mockReturnValue({ addresses: [] });
    mockUseShopSession.mockReturnValue({ session: null, setCountry: jest.fn() });
  });

  it('clears previous methods and selected method before fetching when country changes', () => {
    const clearShippingMethods = jest.fn();
    const fetchShippingMethods = jest.fn().mockResolvedValue(undefined);
    const setShippingMethod = jest.fn();

    mockUseCheckoutStore.mockReturnValue(
      buildCheckoutStoreValue({
        shippingAddress: DE_ADDRESS,
        shippingMethod: SELECTED_METHOD,
        setShippingMethod,
      }),
    );
    mockUseCart.mockReturnValue(buildCartValue(CART));
    mockUseShippingMethods.mockReturnValue(
      buildShippingMethodsValue({
        methods: [{ id: 'de-standard', name: 'DE Standard', cost: { amount: 5 } }],
        clearShippingMethods,
        fetchShippingMethods,
      }),
    );

    const { rerender } = renderHook(() => useCheckout());

    expect(fetchShippingMethods).toHaveBeenLastCalledWith('DE', '10115', { amount: 100, currency: 'EUR' });
    clearShippingMethods.mockClear();
    setShippingMethod.mockClear();
    fetchShippingMethods.mockClear();

    mockUseCheckoutStore.mockReturnValue(
      buildCheckoutStoreValue({
        shippingAddress: CH_ADDRESS,
        shippingMethod: SELECTED_METHOD,
        setShippingMethod,
      }),
    );
    mockUseShippingMethods.mockReturnValue(
      buildShippingMethodsValue({
        methods: [{ id: 'de-standard', name: 'DE Standard', cost: { amount: 5 } }],
        clearShippingMethods,
        fetchShippingMethods,
      }),
    );

    act(() => {
      rerender();
    });

    expect(clearShippingMethods).toHaveBeenCalled();
    expect(setShippingMethod).toHaveBeenCalledWith(null);
    expect(fetchShippingMethods).toHaveBeenCalledWith('CH', '6300', { amount: 100, currency: 'EUR' });

    const clearOrderIdx = clearShippingMethods.mock.invocationCallOrder[0];
    const fetchOrderIdx = fetchShippingMethods.mock.invocationCallOrder[0];
    expect(clearOrderIdx).toBeLessThan(fetchOrderIdx);
  });

  it('does not refetch or clear when the same country/zip is rendered again', () => {
    const clearShippingMethods = jest.fn();
    const fetchShippingMethods = jest.fn().mockResolvedValue(undefined);
    const setShippingMethod = jest.fn();

    mockUseCheckoutStore.mockReturnValue(
      buildCheckoutStoreValue({
        shippingAddress: DE_ADDRESS,
        shippingMethod: SELECTED_METHOD,
        setShippingMethod,
      }),
    );
    mockUseCart.mockReturnValue(buildCartValue(CART));
    mockUseShippingMethods.mockReturnValue(
      buildShippingMethodsValue({
        methods: [{ id: 'de-standard', name: 'DE Standard', cost: { amount: 5 } }],
        clearShippingMethods,
        fetchShippingMethods,
      }),
    );

    const { rerender } = renderHook(() => useCheckout());

    expect(fetchShippingMethods).toHaveBeenCalledTimes(1);
    clearShippingMethods.mockClear();
    setShippingMethod.mockClear();
    fetchShippingMethods.mockClear();

    act(() => {
      rerender();
    });

    expect(fetchShippingMethods).not.toHaveBeenCalled();
    expect(clearShippingMethods).not.toHaveBeenCalled();
    expect(setShippingMethod).not.toHaveBeenCalled();
  });

  it('does not auto-select a shipping method after a fresh fetch', () => {
    const clearShippingMethods = jest.fn();
    const fetchShippingMethods = jest.fn().mockResolvedValue(undefined);
    const setShippingMethod = jest.fn();
    const freshMethod = { id: 'ch-express', name: 'CH Express', cost: { amount: 9 } };

    mockUseCheckoutStore.mockReturnValue(
      buildCheckoutStoreValue({
        shippingAddress: CH_ADDRESS,
        shippingMethod: null,
        setShippingMethod,
      }),
    );
    mockUseCart.mockReturnValue(buildCartValue(CART));
    mockUseShippingMethods.mockReturnValue(
      buildShippingMethodsValue({
        methods: [freshMethod],
        clearShippingMethods,
        fetchShippingMethods,
      }),
    );

    renderHook(() => useCheckout());

    const autoSelected = setShippingMethod.mock.calls
      .map(([payload]) => payload)
      .filter((payload) => payload && payload.methodId === freshMethod.id);
    expect(autoSelected).toHaveLength(0);
  });

  it('clears a selected method that is no longer in the findSite list', () => {
    const setShippingMethod = jest.fn();

    mockUseCheckoutStore.mockReturnValue(
      buildCheckoutStoreValue({
        shippingAddress: CH_ADDRESS,
        shippingMethod: SELECTED_METHOD,
        setShippingMethod,
      }),
    );
    mockUseCart.mockReturnValue(buildCartValue(CART));
    mockUseShippingMethods.mockReturnValue(
      buildShippingMethodsValue({
        methods: [{ id: 'other-method', name: 'Other', cost: { amount: 3 } }],
        clearShippingMethods: jest.fn(),
        fetchShippingMethods: jest.fn().mockResolvedValue(undefined),
      }),
    );

    renderHook(() => useCheckout());

    expect(setShippingMethod).toHaveBeenCalledWith(null);
  });

  it('calls updateShippingInfo when the shipping-address country changes', () => {
    const updateShippingInfo = jest.fn();
    const setCountry = jest.fn();
    const clearShippingMethods = jest.fn();
    const fetchShippingMethods = jest.fn().mockResolvedValue(undefined);
    const setShippingMethod = jest.fn();
    mockUseShopSession.mockReturnValue({ session: { country: 'DE' }, setCountry });

    mockUseCheckoutStore.mockReturnValue(
      buildCheckoutStoreValue({
        shippingAddress: DE_ADDRESS,
        shippingMethod: SELECTED_METHOD,
        setShippingMethod,
      }),
    );
    mockUseCart.mockReturnValue(buildCartValue(CART, updateShippingInfo));
    mockUseShippingMethods.mockReturnValue(
      buildShippingMethodsValue({
        methods: [{ id: 'de-standard', name: 'DE Standard', cost: { amount: 5 } }],
        clearShippingMethods,
        fetchShippingMethods,
      }),
    );

    const { result } = renderHook(() => useCheckout());

    act(() => {
      result.current.submitShippingAddress(buildCheckoutAddress('SHIPPING', 'CH', '6300'));
    });

    expect(updateShippingInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        country: 'CH',
        zipCode: '6300',
      }),
    );
    expect(setCountry).toHaveBeenCalledWith('CH');
  });

  it('normalizes shipping-address country before setCountry', () => {
    const setCountry = jest.fn();
    mockUseShopSession.mockReturnValue({ session: { country: 'DE' }, setCountry });
    mockUseCheckoutStore.mockReturnValue(
      buildCheckoutStoreValue({
        shippingAddress: DE_ADDRESS,
        shippingMethod: SELECTED_METHOD,
        setShippingMethod: jest.fn(),
      }),
    );
    mockUseCart.mockReturnValue(buildCartValue(CART));
    mockUseShippingMethods.mockReturnValue(
      buildShippingMethodsValue({
        methods: [],
        clearShippingMethods: jest.fn(),
        fetchShippingMethods: jest.fn().mockResolvedValue(undefined),
      }),
    );

    const { result } = renderHook(() => useCheckout());

    act(() => {
      result.current.submitShippingAddress(buildCheckoutAddress('SHIPPING', ' ch ', '6300'));
    });

    expect(setCountry).toHaveBeenCalledWith('CH');
  });

  it('does not call setCountry when only country casing differs', () => {
    const setCountry = jest.fn();
    mockUseShopSession.mockReturnValue({ session: { country: 'CH' }, setCountry });
    mockUseCheckoutStore.mockReturnValue(
      buildCheckoutStoreValue({
        shippingAddress: DE_ADDRESS,
        shippingMethod: SELECTED_METHOD,
        setShippingMethod: jest.fn(),
      }),
    );
    mockUseCart.mockReturnValue(buildCartValue(CART));
    mockUseShippingMethods.mockReturnValue(
      buildShippingMethodsValue({
        methods: [],
        clearShippingMethods: jest.fn(),
        fetchShippingMethods: jest.fn().mockResolvedValue(undefined),
      }),
    );

    const { result } = renderHook(() => useCheckout());
    setCountry.mockClear();

    act(() => {
      result.current.submitShippingAddress(buildCheckoutAddress('SHIPPING', 'ch', '6300'));
    });

    expect(setCountry).not.toHaveBeenCalled();
  });

  it('does not call updateShippingInfo when submitBillingAddress is used', () => {
    const updateShippingInfo = jest.fn();
    const clearShippingMethods = jest.fn();
    const fetchShippingMethods = jest.fn().mockResolvedValue(undefined);
    const setShippingMethod = jest.fn();

    mockUseCheckoutStore.mockReturnValue(
      buildCheckoutStoreValue({
        shippingAddress: CH_ADDRESS,
        shippingMethod: SELECTED_METHOD,
        setShippingMethod,
      }),
    );
    mockUseCart.mockReturnValue(buildCartValue(CART, updateShippingInfo));
    mockUseShippingMethods.mockReturnValue(
      buildShippingMethodsValue({
        methods: [{ id: 'ch-express', name: 'CH Express', cost: { amount: 9 } }],
        clearShippingMethods,
        fetchShippingMethods,
      }),
    );

    const { result } = renderHook(() => useCheckout());
    updateShippingInfo.mockClear();

    act(() => {
      result.current.submitBillingAddress(buildCheckoutAddress('BILLING', 'DE', '10115'));
    });

    expect(updateShippingInfo).not.toHaveBeenCalled();
  });

  it('applies leftover persisted ship-to onto a new cart as a first selection', () => {
    const updateShippingInfo = jest.fn().mockResolvedValue(undefined);
    const setCountry = jest.fn();
    mockUseShopSession.mockReturnValue({ session: { country: 'DE' }, setCountry });
    mockUseCheckoutStore.mockReturnValue(
      buildCheckoutStoreValue({
        shippingAddress: CH_ADDRESS,
        shippingMethod: SELECTED_METHOD,
        setShippingMethod: jest.fn(),
      }),
    );
    mockUseCart.mockReturnValue(buildCartValue(CART, updateShippingInfo));
    mockUseShippingMethods.mockReturnValue(
      buildShippingMethodsValue({
        methods: [{ id: 'ch-express', name: 'CH Express', cost: { amount: 9 } }],
        clearShippingMethods: jest.fn(),
        fetchShippingMethods: jest.fn().mockResolvedValue(undefined),
      }),
    );

    renderHook(() => useCheckout());

    expect(updateShippingInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        country: 'CH',
        zipCode: '6300',
      }),
    );
    expect(setCountry).toHaveBeenCalledWith('CH');
  });

  it('does not re-write leftover ship-to for the same cart after it was already applied', () => {
    const updateShippingInfo = jest.fn().mockResolvedValue(undefined);
    mockUseCheckoutStore.mockReturnValue(
      buildCheckoutStoreValue({
        shippingAddress: CH_ADDRESS,
        shippingMethod: SELECTED_METHOD,
        setShippingMethod: jest.fn(),
      }),
    );
    mockUseCart.mockReturnValue(buildCartValue(CART, updateShippingInfo));
    mockUseShippingMethods.mockReturnValue(
      buildShippingMethodsValue({
        methods: [{ id: 'ch-express', name: 'CH Express', cost: { amount: 9 } }],
        clearShippingMethods: jest.fn(),
        fetchShippingMethods: jest.fn().mockResolvedValue(undefined),
      }),
    );

    const { result } = renderHook(() => useCheckout());
    updateShippingInfo.mockClear();

    act(() => {
      result.current.submitShippingAddress(buildCheckoutAddress('SHIPPING', 'CH', '6300'));
    });

    expect(updateShippingInfo).not.toHaveBeenCalled();
  });

  it('re-applies leftover ship-to when the cart id changes', () => {
    const updateShippingInfo = jest.fn().mockResolvedValue(undefined);
    mockUseCheckoutStore.mockReturnValue(
      buildCheckoutStoreValue({
        shippingAddress: CH_ADDRESS,
        shippingMethod: SELECTED_METHOD,
        setShippingMethod: jest.fn(),
      }),
    );
    mockUseCart.mockReturnValue(buildCartValue(CART, updateShippingInfo));
    mockUseShippingMethods.mockReturnValue(
      buildShippingMethodsValue({
        methods: [{ id: 'ch-express', name: 'CH Express', cost: { amount: 9 } }],
        clearShippingMethods: jest.fn(),
        fetchShippingMethods: jest.fn().mockResolvedValue(undefined),
      }),
    );

    const { rerender } = renderHook(() => useCheckout());
    expect(updateShippingInfo).toHaveBeenCalledTimes(1);

    mockUseCart.mockReturnValue(buildCartValue({ ...CART, id: 'cart-2' }, updateShippingInfo));
    rerender();

    expect(updateShippingInfo).toHaveBeenCalledTimes(2);
    expect(updateShippingInfo).toHaveBeenLastCalledWith(
      expect.objectContaining({
        country: 'CH',
        zipCode: '6300',
      }),
    );
  });

  it('hasCheckoutShippingDestination requires both country and zip', () => {
    expect(hasCheckoutShippingDestination({ country: 'CH', zipCode: '6300' })).toBe(true);
    expect(hasCheckoutShippingDestination({ country: 'CH', zipCode: '' })).toBe(false);
    expect(hasCheckoutShippingDestination({ country: '', zipCode: '6300' })).toBe(false);
    expect(hasCheckoutShippingDestination(null)).toBe(false);
  });

  it('applyShippingDestinationToCart writes country+zip even when checkout already has that address', async () => {
    const updateShippingInfo = jest.fn().mockResolvedValue(undefined);
    const setShippingMethod = jest.fn();

    mockUseCheckoutStore.mockReturnValue(
      buildCheckoutStoreValue({
        shippingAddress: CH_ADDRESS,
        shippingMethod: SELECTED_METHOD,
        setShippingMethod,
      }),
    );
    mockUseCart.mockReturnValue(buildCartValue(CART, updateShippingInfo));
    mockUseShippingMethods.mockReturnValue(
      buildShippingMethodsValue({
        methods: [{ id: 'ch-express', name: 'CH Express', cost: { amount: 9 } }],
        clearShippingMethods: jest.fn(),
        fetchShippingMethods: jest.fn().mockResolvedValue(undefined),
      }),
    );

    const { result } = renderHook(() => useCheckout());

    await act(async () => {
      await result.current.applyShippingDestinationToCart(buildCheckoutAddress('SHIPPING', 'CH', '6300'));
    });

    expect(updateShippingInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        country: 'CH',
        zipCode: '6300',
      }),
    );
  });

  it('checkoutAddressToCartShipping trims zip and uppercases country', () => {
    expect(
      checkoutAddressToCartShipping({
        type: 'SHIPPING',
        country: ' ch ',
        zipCode: ' 6300 ',
        city: 'Zug',
      }),
    ).toEqual(
      expect.objectContaining({
        country: 'CH',
        zipCode: '6300',
        city: 'Zug',
      }),
    );
    expect(
      checkoutAddressToCartShipping({
        type: 'SHIPPING',
        country: '   ',
        zipCode: '   ',
      }),
    ).toEqual(
      expect.objectContaining({
        country: undefined,
        zipCode: undefined,
      }),
    );
  });

  it('applyShippingDestinationToCart no-ops without country and zip', async () => {
    const updateShippingInfo = jest.fn();
    const setShippingMethod = jest.fn();

    mockUseCheckoutStore.mockReturnValue(
      buildCheckoutStoreValue({
        shippingAddress: CH_ADDRESS,
        shippingMethod: SELECTED_METHOD,
        setShippingMethod,
      }),
    );
    mockUseCart.mockReturnValue(buildCartValue(CART, updateShippingInfo));
    mockUseShippingMethods.mockReturnValue(
      buildShippingMethodsValue({
        methods: [{ id: 'ch-express', name: 'CH Express', cost: { amount: 9 } }],
        clearShippingMethods: jest.fn(),
        fetchShippingMethods: jest.fn().mockResolvedValue(undefined),
      }),
    );

    const { result } = renderHook(() => useCheckout());
    updateShippingInfo.mockClear();

    await act(async () => {
      await result.current.applyShippingDestinationToCart(buildCheckoutAddress('SHIPPING', '', ''));
    });

    expect(updateShippingInfo).not.toHaveBeenCalled();
  });

  it('stores a newly selected shipping method without persisting it on the cart', () => {
    const updateShippingMethod = jest.fn();
    const setShippingMethod = jest.fn();
    const selected = { id: 'new-shipping-7', name: 'New Shipping 7%', zoneId: 'zone-de', cost: { amount: 20 } };

    mockUseCheckoutStore.mockReturnValue(
      buildCheckoutStoreValue({
        shippingAddress: DE_ADDRESS,
        shippingMethod: SELECTED_METHOD,
        setShippingMethod,
      }),
    );
    mockUseCart.mockReturnValue(buildCartValue(CART, jest.fn(), updateShippingMethod));
    mockUseShippingMethods.mockReturnValue(
      buildShippingMethodsValue({
        methods: [{ id: 'de-standard', name: 'DE Standard', zoneId: 'zone-de', cost: { amount: 5 } }, selected],
        clearShippingMethods: jest.fn(),
        fetchShippingMethods: jest.fn().mockResolvedValue(undefined),
      }),
    );

    const { result } = renderHook(() => useCheckout());

    act(() => {
      result.current.submitShippingMethod(selected);
    });

    expect(setShippingMethod).toHaveBeenCalledWith({
      methodId: 'new-shipping-7',
      zoneId: 'zone-de',
      methodName: 'New Shipping 7%',
      amount: 20,
      taxCode: undefined,
    });
    expect(updateShippingMethod).not.toHaveBeenCalled();
  });

  it('does not persist when the same shipping method is submitted again', () => {
    const updateShippingMethod = jest.fn();
    const setShippingMethod = jest.fn();

    mockUseCheckoutStore.mockReturnValue(
      buildCheckoutStoreValue({
        shippingAddress: DE_ADDRESS,
        shippingMethod: SELECTED_METHOD,
        setShippingMethod,
      }),
    );
    mockUseCart.mockReturnValue(buildCartValue(CART, jest.fn(), updateShippingMethod));
    mockUseShippingMethods.mockReturnValue(
      buildShippingMethodsValue({
        methods: [{ id: 'de-standard', name: 'DE Standard', zoneId: 'zone-de', cost: { amount: 5 } }],
        clearShippingMethods: jest.fn(),
        fetchShippingMethods: jest.fn().mockResolvedValue(undefined),
      }),
    );

    const { result } = renderHook(() => useCheckout());
    updateShippingMethod.mockClear();
    setShippingMethod.mockClear();

    act(() => {
      result.current.submitShippingMethod({
        id: 'de-standard',
        name: 'DE Standard',
        zoneId: 'zone-de',
        cost: { amount: 5 },
      });
    });

    expect(setShippingMethod).not.toHaveBeenCalled();
    expect(updateShippingMethod).not.toHaveBeenCalled();
  });

  it('does not refetch shipping methods when only the cart total changes', () => {
    const clearShippingMethods = jest.fn();
    const fetchShippingMethods = jest.fn().mockResolvedValue(undefined);
    const setShippingMethod = jest.fn();

    mockUseCheckoutStore.mockReturnValue(
      buildCheckoutStoreValue({
        shippingAddress: DE_ADDRESS,
        shippingMethod: SELECTED_METHOD,
        setShippingMethod,
      }),
    );
    mockUseCart.mockReturnValue(
      buildCartValue({
        id: 'cart-1',
        totalPrice: { amount: 100, currency: 'EUR' },
        subTotalPrice: { amount: 100, currency: 'EUR' },
      }),
    );
    mockUseShippingMethods.mockReturnValue(
      buildShippingMethodsValue({
        methods: [{ id: 'de-standard', name: 'DE Standard', cost: { amount: 5 } }],
        clearShippingMethods,
        fetchShippingMethods,
      }),
    );

    const { rerender } = renderHook(() => useCheckout());
    expect(fetchShippingMethods).toHaveBeenCalledTimes(1);
    clearShippingMethods.mockClear();
    fetchShippingMethods.mockClear();

    mockUseCart.mockReturnValue(
      buildCartValue({
        id: 'cart-1',
        totalPrice: { amount: 120, currency: 'EUR' },
        subTotalPrice: { amount: 100, currency: 'EUR' },
      }),
    );

    act(() => {
      rerender();
    });

    expect(fetchShippingMethods).not.toHaveBeenCalled();
    expect(clearShippingMethods).not.toHaveBeenCalled();
  });

  it('keeps leftover addresses after a sequential order checkout', async () => {
    const reset = jest.fn();
    const shipping = buildCheckoutAddress('SHIPPING', 'CH', '6300');
    const billing = buildCheckoutAddress('BILLING', 'CH', '6300');
    mockUseCheckoutStore.mockReturnValue({
      ...buildCheckoutStoreValue({
        shippingAddress: shipping,
        shippingMethod: SELECTED_METHOD,
        setShippingMethod: jest.fn(),
      }),
      billingAddress: billing,
      paymentMethod: { id: 'invoice', code: 'invoice', active: true, provider: 'invoice' },
      reset,
    });
    mockUseCart.mockReturnValue(buildCartValue(CART));
    mockUseCustomer.mockReturnValue({ customer: { id: 'c1' } });
    mockUseShippingMethods.mockReturnValue(
      buildShippingMethodsValue({
        methods: [{ id: 'de-standard', name: 'DE Standard', cost: { amount: 5 } }],
        clearShippingMethods: jest.fn(),
        fetchShippingMethods: jest.fn(),
      }),
    );
    (checkout as jest.Mock).mockResolvedValue({ orderId: 'ord-1' });

    const { result } = renderHook(() => useCheckout());
    await act(async () => {
      await result.current.processCheckout();
    });

    expect(reset).toHaveBeenCalledWith({ keepAddresses: true });
  });
});
