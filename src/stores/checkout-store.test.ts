/**
 * @jest-environment jsdom
 */
import type { CheckoutAddress, CheckoutPaymentMethod, ContactData } from '@/platform/services/model/checkout';
import { createCheckoutStore } from './checkout-store';

const shippingAddress: CheckoutAddress = {
  type: 'SHIPPING',
  country: 'CH',
  zipCode: '6300',
  city: 'Zug',
};

const billingAddress: CheckoutAddress = {
  type: 'BILLING',
  country: 'CH',
  zipCode: '6300',
  city: 'Zug',
};

const contactData: ContactData = {
  userId: 'buyer-1',
  firstName: 'Buyer',
  lastName: 'One',
  email: 'buyer@example.com',
  emailConfirmation: 'buyer@example.com',
};

const paymentMethod: CheckoutPaymentMethod = {
  id: 'invoice',
  code: 'invoice',
  active: true,
  provider: 'invoice',
};

describe('checkout-store reset', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('clears addresses by default', () => {
    const store = createCheckoutStore();
    store.getState().setShippingAddress(shippingAddress);
    store.getState().setBillingAddress(billingAddress);
    store.getState().setPaymentMethod(paymentMethod);
    store.getState().setShippingMethod({ methodId: 'm1', zoneId: 'z1', methodName: 'Standard', amount: 5 });

    store.getState().reset();

    expect(store.getState().shippingAddress).toBeNull();
    expect(store.getState().billingAddress).toBeNull();
    expect(store.getState().paymentMethod).toBeNull();
    expect(store.getState().shippingMethod).toBeNull();
  });

  it('keeps buyer addresses for sequential approvals and drops the shipping method', () => {
    const store = createCheckoutStore();
    store.getState().setContactData(contactData);
    store.getState().setShippingAddress(shippingAddress);
    store.getState().setBillingAddress(billingAddress);
    store.getState().setPaymentMethod(paymentMethod);
    store.getState().setShippingMethod({ methodId: 'm1', zoneId: 'z1', methodName: 'Standard', amount: 5 });

    store.getState().reset({ keepAddresses: true });

    expect(store.getState().shippingAddress).toEqual(shippingAddress);
    expect(store.getState().billingAddress).toEqual(billingAddress);
    expect(store.getState().paymentMethod).toEqual(paymentMethod);
    expect(store.getState().contactData).toEqual(contactData);
    expect(store.getState().shippingMethod).toBeNull();
  });
});
