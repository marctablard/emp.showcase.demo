export type CheckoutShippingGateInput = {
  country?: string;
  zipCode?: string;
  methodsLoading?: boolean;
  methodIds?: string[];
  selectedMethodId?: string | null;
};

export type CheckoutShippingBlockReason = 'address' | 'loading' | 'no-methods' | 'pick-method';

export function checkoutShippingBlockReason(input: CheckoutShippingGateInput): CheckoutShippingBlockReason | null {
  const country = input.country?.trim();
  const zipCode = input.zipCode?.trim();
  if (!country || !zipCode) {
    return 'address';
  }
  if (input.methodsLoading) {
    return 'loading';
  }
  const methodIds = input.methodIds ?? [];
  if (methodIds.length === 0) {
    return 'no-methods';
  }
  const selected = input.selectedMethodId?.trim();
  if (!selected || !methodIds.includes(selected)) {
    return 'pick-method';
  }
  return null;
}

export function canCollapseCheckoutShipping(input: CheckoutShippingGateInput): boolean {
  return checkoutShippingBlockReason(input) === null;
}
