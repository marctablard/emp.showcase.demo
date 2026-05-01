import { act, renderHook } from '@testing-library/react';
import { useCheckout } from './useCheckout';

const mockUseCheckoutStore = jest.fn();
const mockUseCart = jest.fn();
const mockUseCustomer = jest.fn();
const mockUseShippingMethods = jest.fn();
const mockUseSite = jest.fn();
const mockUseAddresses = jest.fn();
const mockUseShopSession = jest.fn();
const mockUseLegalEntityCheckoutAddresses = jest.fn();

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

jest.mock('../customer/useLegalEntityCheckoutAddresses', () => ({
  useLegalEntityCheckoutAddresses: (_skip?: boolean) => mockUseLegalEntityCheckoutAddresses(),
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

const buildCartValue = (cart: CheckoutCart) => ({
  cart,
  loading: false,
  updateShippingInfo: jest.fn(),
  clearCart: jest.fn(),
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
    mockUseShopSession.mockReturnValue({ session: null });
    mockUseLegalEntityCheckoutAddresses.mockReturnValue({ addresses: [], loading: false });
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

  it('prefills shipping and billing from the DEFAULT legal-entity location for B2B customers', () => {
    const setShippingAddress = jest.fn();
    const setBillingAddress = jest.fn();
    const setShippingMethod = jest.fn();

    mockUseCheckoutStore.mockReturnValue({
      contactData: null,
      billingAddress: null,
      shippingAddress: null,
      paymentMethod: null,
      shippingMethod: null,
      setContactData: jest.fn(),
      setBillingAddress,
      setShippingAddress,
      setPaymentMethod: jest.fn(),
      setShippingMethod,
      reset: jest.fn(),
    });
    mockUseCart.mockReturnValue(buildCartValue(null));
    mockUseShippingMethods.mockReturnValue(
      buildShippingMethodsValue({
        methods: [],
        clearShippingMethods: jest.fn(),
        fetchShippingMethods: jest.fn().mockResolvedValue(undefined),
      }),
    );
    mockUseCustomer.mockReturnValue({
      customer: { id: 'cust-1', businessModel: 'B2B', legalEntityId: 'le-1' },
    });
    mockUseShopSession.mockReturnValue({ session: { legalEntityId: 'le-1' } });
    mockUseLegalEntityCheckoutAddresses.mockReturnValue({
      loading: false,
      addresses: [
        {
          id: 'loc-hq',
          contactName: 'World Company HQ — OFFICE',
          companyName: 'World Company',
          street: 'Hauptstrasse',
          streetNumber: '10',
          streetAppendix: '',
          zipCode: '10501',
          city: 'Berlin',
          state: 'BE',
          country: 'DE',
          tags: ['BILLING', 'SHIPPING'],
          source: 'legalEntity',
          isDefault: true,
        },
      ],
    });

    renderHook(() => useCheckout());

    const shippingCall = setShippingAddress.mock.calls.find(([addr]) => addr.type === 'SHIPPING');
    expect(shippingCall).toBeDefined();
    expect(shippingCall![0]).toMatchObject({ id: 'loc-hq', city: 'Berlin', type: 'SHIPPING' });

    const billingCall = setBillingAddress.mock.calls.find(([addr]) => addr.type === 'BILLING');
    expect(billingCall).toBeDefined();
    expect(billingCall![0]).toMatchObject({ id: 'loc-hq', city: 'Berlin', type: 'BILLING' });
  });

  it('does not prefill addresses when no DEFAULT legal-entity location exists', () => {
    const setShippingAddress = jest.fn();
    const setBillingAddress = jest.fn();

    mockUseCheckoutStore.mockReturnValue({
      contactData: null,
      billingAddress: null,
      shippingAddress: null,
      paymentMethod: null,
      shippingMethod: null,
      setContactData: jest.fn(),
      setBillingAddress,
      setShippingAddress,
      setPaymentMethod: jest.fn(),
      setShippingMethod: jest.fn(),
      reset: jest.fn(),
    });
    mockUseCart.mockReturnValue(buildCartValue(null));
    mockUseShippingMethods.mockReturnValue(
      buildShippingMethodsValue({
        methods: [],
        clearShippingMethods: jest.fn(),
        fetchShippingMethods: jest.fn().mockResolvedValue(undefined),
      }),
    );
    mockUseCustomer.mockReturnValue({
      customer: { id: 'cust-1', businessModel: 'B2B', legalEntityId: 'le-1' },
    });
    mockUseShopSession.mockReturnValue({ session: { legalEntityId: 'le-1' } });
    mockUseLegalEntityCheckoutAddresses.mockReturnValue({
      loading: false,
      addresses: [
        {
          id: 'loc-branch',
          contactName: 'Branch Office',
          companyName: 'World Company',
          street: 'Nebenstrasse',
          streetNumber: '5',
          zipCode: '10502',
          city: 'Berlin',
          country: 'DE',
          tags: ['SHIPPING'],
          source: 'legalEntity',
          isDefault: false,
        },
      ],
    });

    renderHook(() => useCheckout());

    expect(setShippingAddress).not.toHaveBeenCalled();
    expect(setBillingAddress).not.toHaveBeenCalled();
  });

  it('auto-selects the only available shipping method after a fresh fetch', () => {
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

    const callArgs = setShippingMethod.mock.calls
      .map(([payload]) => payload)
      .filter((payload) => payload && payload.methodId === freshMethod.id);
    expect(callArgs.length).toBeGreaterThanOrEqual(1);
  });
});
