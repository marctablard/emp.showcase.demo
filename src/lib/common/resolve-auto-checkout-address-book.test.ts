import { ADDRESS_TYPE } from '@/lib/common/address-type-constants';
import type { AddressType } from '@/platform/services/model/common';
import type { CustomerAddress } from '@/platform/services/model/customer/customer';
import {
  type ResolveAutoCheckoutAddressBookInput,
  resolveAutoCheckoutAddressBook,
} from './resolve-auto-checkout-address-book';

function address(id: string, tags: string[], source: CustomerAddress['source']): CustomerAddress {
  return {
    id,
    contactName: id,
    street: 'Main St',
    zipCode: '10115',
    city: 'Berlin',
    country: 'DE',
    tags,
    source,
  };
}

const customerShippingOnly = address('cust-ship', [ADDRESS_TYPE.SHIPPING], 'customer');
const customerBillingOnly = address('cust-bill', [ADDRESS_TYPE.BILLING], 'customer');
const customerDual = address('cust-dual', [ADDRESS_TYPE.SHIPPING, ADDRESS_TYPE.BILLING], 'customer');
const leDualHq = address('le-hq', [ADDRESS_TYPE.SHIPPING, ADDRESS_TYPE.BILLING], 'legalEntity');
const leShippingWarehouse = address('le-wh', [ADDRESS_TYPE.SHIPPING], 'legalEntity');
const leBillingOnly = address('le-bill', [ADDRESS_TYPE.BILLING], 'legalEntity');

const customerBook = [customerShippingOnly, customerBillingOnly, customerDual];

function resolve(
  overrides: Partial<ResolveAutoCheckoutAddressBookInput> &
    Pick<ResolveAutoCheckoutAddressBookInput, 'isB2BWithLegalEntity' | 'addressType'>,
) {
  return resolveAutoCheckoutAddressBook({
    customerAddresses: customerBook,
    customerLoading: false,
    legalEntityAddresses: [],
    legalEntityLoading: false,
    ...overrides,
  });
}

function ids(result: ReturnType<typeof resolveAutoCheckoutAddressBook>): string[] {
  return result.addresses.map((row) => row.id as string);
}

describe('resolveAutoCheckoutAddressBook', () => {
  describe('not B2B+LE (B2C / customer-only)', () => {
    it('returns customer rows filtered by SHIPPING', () => {
      const result = resolve({ isB2BWithLegalEntity: false, addressType: ADDRESS_TYPE.SHIPPING });
      expect(result.loading).toBe(false);
      expect(ids(result)).toEqual(['cust-ship', 'cust-dual']);
    });

    it('returns customer rows filtered by BILLING', () => {
      const result = resolve({ isB2BWithLegalEntity: false, addressType: ADDRESS_TYPE.BILLING });
      expect(result.loading).toBe(false);
      expect(ids(result)).toEqual(['cust-bill', 'cust-dual']);
    });

    it('ignores legal-entity rows when not B2B+LE', () => {
      const result = resolve({
        isB2BWithLegalEntity: false,
        addressType: ADDRESS_TYPE.SHIPPING,
        legalEntityAddresses: [leShippingWarehouse],
      });
      expect(ids(result)).toEqual(['cust-ship', 'cust-dual']);
    });

    it('returns loading and no rows while the customer book is loading', () => {
      const result = resolve({
        isB2BWithLegalEntity: false,
        addressType: ADDRESS_TYPE.SHIPPING,
        customerLoading: true,
      });
      expect(result).toEqual({ addresses: [], loading: true });
    });
  });

  describe('B2B+LE empty filtered company book', () => {
    it('returns customer SHIPPING-only (and dual-tagged) rows for shipping', () => {
      const result = resolve({
        isB2BWithLegalEntity: true,
        addressType: ADDRESS_TYPE.SHIPPING,
        legalEntityAddresses: [],
      });
      expect(result.loading).toBe(false);
      expect(ids(result)).toEqual(['cust-ship', 'cust-dual']);
    });

    it('returns customer BILLING-only (and dual-tagged) rows for billing', () => {
      const result = resolve({
        isB2BWithLegalEntity: true,
        addressType: ADDRESS_TYPE.BILLING,
        legalEntityAddresses: [leShippingWarehouse],
      });
      expect(result.loading).toBe(false);
      expect(ids(result)).toEqual(['cust-bill', 'cust-dual']);
    });

    it('returns loading and no rows while customer addresses load on the fallback path', () => {
      const result = resolve({
        isB2BWithLegalEntity: true,
        addressType: ADDRESS_TYPE.SHIPPING,
        legalEntityAddresses: [],
        customerLoading: true,
      });
      expect(result).toEqual({ addresses: [], loading: true });
    });
  });

  describe('B2B+LE dual-tagged-only company book', () => {
    it('appends customer exclusive SHIPPING rows and keeps the LE row', () => {
      const result = resolve({
        isB2BWithLegalEntity: true,
        addressType: ADDRESS_TYPE.SHIPPING,
        legalEntityAddresses: [leDualHq],
      });
      expect(result.loading).toBe(false);
      expect(ids(result)).toEqual(['le-hq', 'cust-ship']);
    });

    it('appends customer exclusive BILLING rows and keeps the LE row', () => {
      const result = resolve({
        isB2BWithLegalEntity: true,
        addressType: ADDRESS_TYPE.BILLING,
        legalEntityAddresses: [leDualHq],
      });
      expect(result.loading).toBe(false);
      expect(ids(result)).toEqual(['le-hq', 'cust-bill']);
    });

    it('does not drop the dual-tagged LE row when appending', () => {
      const result = resolve({
        isB2BWithLegalEntity: true,
        addressType: ADDRESS_TYPE.SHIPPING,
        legalEntityAddresses: [leDualHq],
      });
      expect(result.addresses).toContainEqual(leDualHq);
    });

    it('dedupes appended customer rows that share an id with an LE row', () => {
      const sameIdCustomer = address('le-hq', [ADDRESS_TYPE.SHIPPING], 'customer');
      const result = resolve({
        isB2BWithLegalEntity: true,
        addressType: ADDRESS_TYPE.SHIPPING,
        legalEntityAddresses: [leDualHq],
        customerAddresses: [sameIdCustomer, customerShippingOnly],
      });
      expect(ids(result)).toEqual(['le-hq', 'cust-ship']);
    });

    it('returns loading and no rows while customer addresses load on the append path', () => {
      const result = resolve({
        isB2BWithLegalEntity: true,
        addressType: ADDRESS_TYPE.SHIPPING,
        legalEntityAddresses: [leDualHq],
        customerLoading: true,
      });
      expect(result).toEqual({ addresses: [], loading: true });
    });
  });

  describe('B2B+LE exclusive-role company location', () => {
    it('returns LE only when an exclusive SHIPPING warehouse exists', () => {
      const result = resolve({
        isB2BWithLegalEntity: true,
        addressType: ADDRESS_TYPE.SHIPPING,
        legalEntityAddresses: [leShippingWarehouse],
      });
      expect(result.loading).toBe(false);
      expect(ids(result)).toEqual(['le-wh']);
    });

    it('does not append customer shipping rows beside an exclusive SHIPPING warehouse', () => {
      const result = resolve({
        isB2BWithLegalEntity: true,
        addressType: ADDRESS_TYPE.SHIPPING,
        legalEntityAddresses: [leDualHq, leShippingWarehouse],
      });
      expect(ids(result)).toEqual(['le-hq', 'le-wh']);
    });

    it('returns LE only for an exclusive BILLING location', () => {
      const result = resolve({
        isB2BWithLegalEntity: true,
        addressType: ADDRESS_TYPE.BILLING,
        legalEntityAddresses: [leBillingOnly],
      });
      expect(ids(result)).toEqual(['le-bill']);
    });

    it('does not wait for the customer book when an exclusive-role LE row exists', () => {
      const result = resolve({
        isB2BWithLegalEntity: true,
        addressType: ADDRESS_TYPE.SHIPPING,
        legalEntityAddresses: [leShippingWarehouse],
        customerLoading: true,
      });
      expect(result.loading).toBe(false);
      expect(ids(result)).toEqual(['le-wh']);
    });
  });

  describe('B2B legal-entity loading', () => {
    it('returns loading and no rows while the legal-entity book is loading', () => {
      const result = resolve({
        isB2BWithLegalEntity: true,
        addressType: ADDRESS_TYPE.SHIPPING,
        legalEntityLoading: true,
        customerAddresses: customerBook,
        customerLoading: false,
      });
      expect(result).toEqual({ addresses: [], loading: true });
    });
  });

  describe('tag filter by addressType', () => {
    it.each<[AddressType, string[]]>([
      [ADDRESS_TYPE.SHIPPING, ['cust-ship', 'cust-dual']],
      [ADDRESS_TYPE.BILLING, ['cust-bill', 'cust-dual']],
    ])('filters customer book for %s', (addressType, expectedIds) => {
      const result = resolve({ isB2BWithLegalEntity: false, addressType });
      expect(ids(result)).toEqual(expectedIds);
    });
  });
});
