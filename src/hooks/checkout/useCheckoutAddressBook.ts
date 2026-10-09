'use client';

import { useSession } from 'next-auth/react';
import { useAddresses } from '@/hooks/customer/useAddresses';
import useCustomer from '@/hooks/customer/useCustomer';
import { useLegalEntityCheckoutAddresses } from '@/hooks/customer/useLegalEntityCheckoutAddresses';
import { useSession as useShopSession } from '@/hooks/session/useSession';
import { resolveLegalEntityIdFromSessionAndCustomer } from '@/lib/common/legal-entity-context';
import {
  type ResolveAutoCheckoutAddressBookResult,
  resolveAutoCheckoutAddressBook,
} from '@/lib/common/resolve-auto-checkout-address-book';
import type { AddressType } from '@/platform/services/model/common';

export function useIsB2BWithLegalEntity(): boolean {
  const { status } = useSession();
  const { customer } = useCustomer();
  const { session: shopSession } = useShopSession();
  return (
    status === 'authenticated' &&
    customer?.businessModel === 'B2B' &&
    Boolean(resolveLegalEntityIdFromSessionAndCustomer(shopSession, customer))
  );
}

/**
 * Checkout `auto` address book: B2B+LE shoppers get the selected company's locations
 * (with customer-book fallback), everyone else the customer profile book.
 */
export function useCheckoutAddressBook(addressType?: AddressType): ResolveAutoCheckoutAddressBookResult {
  const isB2B = useIsB2BWithLegalEntity();
  const { addresses: customerAddresses, loading: customerLoading } = useAddresses();
  const { addresses: legalEntityAddresses, loading: legalEntityLoading } = useLegalEntityCheckoutAddresses(!isB2B);
  return resolveAutoCheckoutAddressBook({
    isB2BWithLegalEntity: isB2B,
    addressType,
    customerAddresses,
    customerLoading,
    legalEntityAddresses,
    legalEntityLoading,
  });
}
