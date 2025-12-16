import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  createCustomerAddress,
  deleteCustomerAddress,
  fetchCustomerAddresses,
  updateCustomerAddress,
} from '@/lib/client/customer';
import { Address, AddressType } from '@/platform/services/model/common';
import { CustomerAddress } from '@/platform/services/model/customer/customer';
import { useCustomerStore } from '@/providers/StoreProvider';
import useCustomer from './useCustomer';

interface CustomerAddressesHook {
  addresses?: CustomerAddress[];
  loading: boolean;
  error: Error | null;
  fetchAddresses: () => Promise<void>;
  getDefaultAddress: (type: AddressType) => Address | null;
  createAddress: (address: CustomerAddress) => Promise<CustomerAddress>;
  updateAddress: (id: string, address: CustomerAddress) => Promise<CustomerAddress>;
  deleteAddress: (id: string) => Promise<void>;
}

/**
 * Hook for customer data
 * @returns Customer data and state
 */
export const useAddresses = (initialAddresses?: CustomerAddress[] | undefined): CustomerAddressesHook => {
  const { addresses, loading, getAddressLoading, setAddressLoading, setAddresses, getAddresses } = useCustomerStore();
  const { customer } = useCustomer();
  const { status } = useSession();
  if (initialAddresses && getAddresses() === undefined) {
    setAddresses(initialAddresses);
  }
  const [error, setError] = useState<Error | null>(null);

  const fetchAddresses = useCallback(async () => {
    try {
      setAddressLoading(true);
      setError(null);
      const addressData = await fetchCustomerAddresses();
      setAddresses(addressData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch addresses'));
      console.error('Error fetching addresses:', err);
    } finally {
      setAddressLoading(false);
    }
  }, [setAddressLoading, setAddresses]);

  /**
   * Get default address of specified type
   * @param type Address type (SHIPPING or BILLING)
   * @returns Default address of specified type or null if not found
   */
  const getDefaultAddress = useCallback(
    (type: AddressType): CustomerAddress | null => {
      if ((addresses || []).length === 0) {
        return null;
      }

      // If no default address of the specified type is found, just return the first address of that type
      const firstTypeAddress = (addresses || []).find((addr) => addr.types.includes(type));

      if (firstTypeAddress) {
        return firstTypeAddress;
      }

      return null;
    },
    [addresses],
  );

  // Create a new address
  const createAddress = useCallback(
    async (address: CustomerAddress): Promise<CustomerAddress> => {
      try {
        setAddressLoading(true);
        setError(null);
        const newAddress = await createCustomerAddress(address);
        // Update the addresses list
        const updatedAddresses = addresses ? [...addresses, newAddress] : [newAddress];
        setAddresses(updatedAddresses);
        return newAddress;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create address');
        setError(error);
        console.error('Error creating address:', err);
        throw error;
      } finally {
        setAddressLoading(false);
      }
    },
    [addresses, setAddressLoading, setAddresses],
  );

  // Update an existing address
  const updateAddress = useCallback(
    async (id: string, address: CustomerAddress): Promise<CustomerAddress> => {
      try {
        setAddressLoading(true);
        setError(null);
        const updatedAddress = await updateCustomerAddress(id, address);
        // Update the addresses list
        const updatedAddresses = addresses?.map((addr) => (addr.id === id ? updatedAddress : addr));
        setAddresses(updatedAddresses);
        return updatedAddress;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update address');
        setError(error);
        console.error('Error updating address:', err);
        throw error;
      } finally {
        setAddressLoading(false);
      }
    },
    [addresses, setAddressLoading, setAddresses],
  );

  // Delete an address
  const deleteAddress = useCallback(
    async (id: string): Promise<void> => {
      try {
        setAddressLoading(true);
        setError(null);
        await deleteCustomerAddress(id);
        // Remove the address from the list
        const updatedAddresses = addresses?.filter((addr) => addr.id !== id);
        setAddresses(updatedAddresses);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to delete address');
        setError(error);
        console.error('Error deleting address:', err);
        throw error;
      } finally {
        setAddressLoading(false);
      }
    },
    [addresses, setAddressLoading, setAddresses],
  );

  // Initialize customer on first render if not already initialized
  useEffect(() => {
    if (status !== 'authenticated') {
      if (getAddressLoading()) {
        setAddressLoading(false);
      }
      return;
    }

    if (customer && addresses === undefined && !getAddressLoading()) {
      setAddressLoading(true);
      // first try to grab the customer from the store
      const currentAddresses = getAddresses();
      if (currentAddresses !== undefined) {
        setAddresses(currentAddresses);
        setAddressLoading(false);
      } else {
        fetchAddresses();
      }
    }
  }, [customer, addresses, getAddresses, getAddressLoading, setAddressLoading, fetchAddresses, setAddresses, status]);

  return {
    addresses,
    loading,
    error,
    fetchAddresses,
    getDefaultAddress,
    createAddress,
    updateAddress,
    deleteAddress,
  };
};
