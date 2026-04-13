import { getLogger } from '@/lib/logger/use-logger-client';
import { CustomerUpdateDto, PasswordChangeDto } from '@/platform/services/customer/CustomerService';
import { Customer, CustomerAddress } from '@/platform/services/model/customer/customer';

/**
 * Fetch the current customer information
 * @returns {Promise<Customer|null>} The customer or null if not logged in
 */
export async function fetchCurrentCustomer(): Promise<Customer | null> {
  try {
    const response = await fetch('/api/customer/current');

    // If we get a 204, it means no customer is logged in
    if (response.status === 204) {
      return null;
    }

    // For other error codes, throw an error
    if (!response.ok) {
      throw new Error(`Failed to fetch customer: ${response.statusText}`);
    }

    const customer = await response.json();
    return customer;
  } catch (error) {
    getLogger().error({ err: error }, 'Error fetching customer');
    return null;
  }
}

/**
 * Fetch addresses for the current customer
 * @returns {Promise<CustomerAddress[]>} Array of customer addresses
 */
export async function fetchCustomerAddresses(): Promise<CustomerAddress[]> {
  try {
    const response = await fetch('/api/customer/current/addresses');

    // For error codes, throw an error
    if (!response.ok) {
      throw new Error(`Failed to fetch customer addresses: ${response.statusText}`);
    }

    const addresses = await response.json();
    return addresses;
  } catch (error) {
    getLogger().error({ err: error }, 'Error fetching customer addresses');
    return [];
  }
}

/**
 * Legal entity location addresses for B2B checkout (not profile /customer addresses).
 */
export async function fetchLegalEntityCheckoutAddresses(): Promise<CustomerAddress[]> {
  try {
    const response = await fetch('/api/customer/current/legal-entity-addresses');
    if (!response.ok) {
      throw new Error(`Failed to fetch legal entity addresses: ${response.statusText}`);
    }
    return (await response.json()) as CustomerAddress[];
  } catch (error) {
    getLogger().error({ err: error }, 'Error fetching legal entity checkout addresses');
    return [];
  }
}

/**
 * Create a new address for the current customer
 * @param {CustomerAddress} address - The address data to save
 * @returns {Promise<CustomerAddress>} The saved address with ID
 */
export async function createCustomerAddress(address: CustomerAddress): Promise<CustomerAddress> {
  try {
    const response = await fetch('/api/customer/current/addresses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(address),
    });

    if (!response.ok) {
      throw new Error(`Failed to create customer address: ${response.statusText}`);
    }

    const savedAddress = await response.json();
    return savedAddress;
  } catch (error) {
    getLogger().error({ err: error }, 'Error creating customer address');
    throw error;
  }
}

/**
 * Update an existing customer address
 * @param {string} id - The ID of the address to update
 * @param {CustomerAddress} address - The updated address data
 * @returns {Promise<CustomerAddress>} The updated address
 */
export async function updateCustomerAddress(id: string, address: CustomerAddress): Promise<CustomerAddress> {
  try {
    const response = await fetch(`/api/customer/current/addresses/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(address),
    });

    if (!response.ok) {
      throw new Error(`Failed to update customer address: ${response.statusText}`);
    }

    const updatedAddress = await response.json();
    return updatedAddress;
  } catch (error) {
    getLogger().error({ err: error, addressId: id }, 'Error updating customer address');
    throw error;
  }
}

/**
 * Delete a customer address
 * @param {string} id - The ID of the address to delete
 * @returns {Promise<void>}
 */
export async function deleteCustomerAddress(id: string): Promise<void> {
  try {
    const response = await fetch(`/api/customer/current/addresses/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete customer address: ${response.statusText}`);
    }
  } catch (error) {
    getLogger().error({ err: error, addressId: id }, 'Error deleting customer address');
    throw error;
  }
}

/**
 * Change the password of the current customer
 * @param {PasswordChangeDto} passwordData - Object containing current and new password
 * @returns {Promise<void>}
 */
export async function changeCustomerPassword(passwordData: PasswordChangeDto): Promise<void> {
  try {
    const response = await fetch('/api/customer/current/password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(passwordData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to change password: ${response.statusText} - ${errorText}`);
    }
  } catch (error) {
    getLogger().error({ err: error }, 'Error changing customer password');
    throw error;
  }
}

/**
 * Update the current customer's profile
 * @param {CustomerUpdateDto} profileData - The profile data to update
 * @returns {Promise<Customer>} The updated customer profile
 */
export async function updateCustomerProfile(profileData: CustomerUpdateDto): Promise<Customer> {
  try {
    const response = await fetch('/api/customer/current/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update profile: ${response.statusText} - ${errorText}`);
    }

    const updatedCustomer = await response.json();
    return updatedCustomer;
  } catch (error) {
    getLogger().error({ err: error }, 'Error updating customer profile');
    throw error;
  }
}
