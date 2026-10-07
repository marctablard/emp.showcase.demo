import { ADDRESS_TYPE } from '@/lib/common/address-type-constants';
import type { AddressType } from '@/platform/services/model/common';
import type { CustomerAddress } from '@/platform/services/model/customer/customer';

export interface ResolveAutoCheckoutAddressBookInput {
  isB2BWithLegalEntity: boolean;
  addressType?: AddressType;
  customerAddresses: CustomerAddress[] | undefined;
  customerLoading: boolean;
  legalEntityAddresses: CustomerAddress[] | undefined;
  legalEntityLoading: boolean;
}

export interface ResolveAutoCheckoutAddressBookResult {
  addresses: CustomerAddress[];
  loading: boolean;
}

function otherAddressType(addressType: AddressType): AddressType {
  return addressType === ADDRESS_TYPE.SHIPPING ? ADDRESS_TYPE.BILLING : ADDRESS_TYPE.SHIPPING;
}

function filterByAddressType(
  addresses: CustomerAddress[] | undefined,
  addressType: AddressType | undefined,
): CustomerAddress[] {
  if (!addresses?.length) {
    return [];
  }
  if (!addressType) {
    return addresses;
  }
  return addresses.filter((address) => address.tags.includes(addressType));
}

/**
 * Exclusive-role: tags include `addressType` and do not include the other of SHIPPING/BILLING.
 */
function isExclusiveRole(address: CustomerAddress, addressType: AddressType): boolean {
  return address.tags.includes(addressType) && !address.tags.includes(otherAddressType(addressType));
}

function hasExclusiveRole(addresses: CustomerAddress[], addressType: AddressType | undefined): boolean {
  if (!addressType) {
    return false;
  }
  return addresses.some((address) => isExclusiveRole(address, addressType));
}

function exclusiveCustomerRows(
  addresses: CustomerAddress[] | undefined,
  addressType: AddressType | undefined,
): CustomerAddress[] {
  return filterByAddressType(addresses, addressType).filter((address) =>
    addressType ? isExclusiveRole(address, addressType) : true,
  );
}

function dedupeById(addresses: CustomerAddress[]): CustomerAddress[] {
  const seen = new Set<string>();
  const result: CustomerAddress[] = [];
  for (const address of addresses) {
    if (address.id != null && seen.has(address.id)) {
      continue;
    }
    if (address.id != null) {
      seen.add(address.id);
    }
    result.push(address);
  }
  return result;
}

function loadingEmpty(): ResolveAutoCheckoutAddressBookResult {
  return { addresses: [], loading: true };
}

/**
 * Pure checkout `auto` book: customer-only when not B2B+LE; empty or dual-tagged-only
 * legal-entity books fall back to / append the customer book.
 */
export function resolveAutoCheckoutAddressBook(
  input: ResolveAutoCheckoutAddressBookInput,
): ResolveAutoCheckoutAddressBookResult {
  const {
    isB2BWithLegalEntity,
    addressType,
    customerAddresses,
    customerLoading,
    legalEntityAddresses,
    legalEntityLoading,
  } = input;

  if (!isB2BWithLegalEntity) {
    if (customerLoading) {
      return loadingEmpty();
    }
    return { addresses: filterByAddressType(customerAddresses, addressType), loading: false };
  }

  if (legalEntityLoading) {
    return loadingEmpty();
  }

  const filteredLegalEntity = filterByAddressType(legalEntityAddresses, addressType);
  const needsCustomerBook = filteredLegalEntity.length === 0 || !hasExclusiveRole(filteredLegalEntity, addressType);

  if (needsCustomerBook && customerLoading) {
    return loadingEmpty();
  }

  if (filteredLegalEntity.length === 0) {
    return { addresses: filterByAddressType(customerAddresses, addressType), loading: false };
  }

  if (hasExclusiveRole(filteredLegalEntity, addressType)) {
    return { addresses: filteredLegalEntity, loading: false };
  }

  return {
    addresses: dedupeById([...filteredLegalEntity, ...exclusiveCustomerRows(customerAddresses, addressType)]),
    loading: false,
  };
}
