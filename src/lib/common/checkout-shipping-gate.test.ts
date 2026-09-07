import {
  canCollapseCheckoutShipping,
  checkoutShippingBlockReason,
  checkoutShippingMessageKey,
} from './checkout-shipping-gate';

describe('checkoutShippingBlockReason', () => {
  it('requires country and zip before collapse', () => {
    expect(checkoutShippingBlockReason({})).toBe('address');
    expect(checkoutShippingBlockReason({ country: 'CH' })).toBe('address');
    expect(checkoutShippingBlockReason({ country: '   ', zipCode: '6300' })).toBe('address');
    expect(checkoutShippingBlockReason({ country: 'CH', zipCode: '   ' })).toBe('address');
    expect(checkoutShippingBlockReason({ country: 'CH', zipCode: '6300', methodsLoading: true })).toBe('loading');
  });

  it('blocks when findSite returned no methods or nothing is picked', () => {
    expect(checkoutShippingBlockReason({ country: 'CH', zipCode: '6300', methodIds: [] })).toBe('no-methods');
    expect(checkoutShippingBlockReason({ country: 'CH', zipCode: '6300', methodIds: ['dhl'] })).toBe('pick-method');
    expect(
      checkoutShippingBlockReason({
        country: 'CH',
        zipCode: '6300',
        methodIds: ['dhl'],
        selectedMethodId: 'other',
      }),
    ).toBe('pick-method');
  });

  it('allows collapse only for a real picked method', () => {
    expect(
      canCollapseCheckoutShipping({
        country: 'CH',
        zipCode: '6300',
        methodIds: ['dhl'],
        selectedMethodId: 'dhl',
      }),
    ).toBe(true);
  });
});

describe('checkoutShippingMessageKey', () => {
  it('maps each block reason to checkout.shipping copy', () => {
    expect(checkoutShippingMessageKey('address')).toBe('enterShippingAddressFirst');
    expect(checkoutShippingMessageKey('loading')).toBe('loading');
    expect(checkoutShippingMessageKey('no-methods')).toBe('noShippingMethodsAvailable');
    expect(checkoutShippingMessageKey('pick-method')).toBe('selectShippingMethod');
  });
});
