import { EmporixCustomer } from '../model/customer';
import { EmporixSessionContext } from '../model/session-context';

/**
 * Customer API Interface for Emporix
 * Based on the Customer Service (customer-managed) OpenAPI specification
 */
export interface EmporixCustomerApi {
  /**
   * Retrieves a customer's profile
   * @param expand Optional list of additional attributes to retrieve (e.g., 'addresses')
   * @returns Promise with the customer profile
   */
  getCustomerProfile(expand?: string): Promise<EmporixCustomer>;

  /**
   * Updates a customer's profile
   * @param customerData The customer data to update
   * @returns Promise that resolves when the update is complete
   */
  updateCustomerProfile(customerData: Partial<EmporixCustomer>): Promise<void>;

  /**
   * Deletes a customer's profile
   * @returns Promise that resolves when the deletion is complete
   */
  deleteCustomerProfile(): Promise<void>;

  /**
   * Retrieves a list of addresses for a customer
   * @returns Promise with the list of customer addresses
   */
  getCustomerAddresses(): Promise<EmporixCustomerAddress[]>;

  /**
   * Adds a new address to a customer's profile
   * @param address The address data to add
   * @returns Promise with the ID of the created address
   */
  addCustomerAddress(address: Partial<EmporixCustomerAddress>): Promise<{ id: string }>;

  /**
   * Retrieves a specific address by ID
   * @param addressId The address ID to retrieve
   * @returns Promise with the address data
   */
  getCustomerAddressById(addressId: string): Promise<EmporixCustomerAddress>;

  /**
   * Updates an existing address
   * @param addressId The address ID to update
   * @param address The address data to update
   * @returns Promise that resolves when the update is complete
   */
  updateCustomerAddress(addressId: string, address: Partial<EmporixCustomerAddress>): Promise<void>;

  /**
   * Deletes an address from a customer's profile
   * @param addressId The address ID to delete
   * @returns Promise that resolves when the deletion is complete
   */
  deleteCustomerAddress(addressId: string): Promise<void>;

  /**
   * Adds tags to a customer's address
   * @param addressId The address ID to add tags to
   * @param tags The tags to add (comma-separated)
   * @returns Promise that resolves when the tags are added
   */
  addAddressTags(addressId: string, tags: string[]): Promise<void>;

  /**
   * Deletes tags from a customer's address
   * @param addressId The address ID to remove tags from
   * @param tags The tags to remove (comma-separated)
   * @returns Promise that resolves when the tags are removed
   */
  deleteAddressTags(addressId: string, tags: string[]): Promise<void>;

  /**
   * Logs in a customer
   * @param username The customer's username
   * @param password The customer's password
   * @returns the Customer's Session Context
   */
  login(username: string, password: string): Promise<EmporixSessionContext>;

  /**
   * Registers a new customer
   * @param customerData The customer data for registration
   * @returns Promise with the created customer Id
   */
  signup(customerData: EmporixSignupRequest): Promise<{ id: string }>;

  /**
   * Changes a customer's password
   * @param passwordData Object containing current and new password
   * @returns Promise that resolves when the password change is complete
   */
  changePassword(passwordData: EmporixPasswordChangeRequest): Promise<void>;

  /**
   * Request a password reset for a customer's email address
   * @param email The customer's email address
   * @returns Promise that resolves when the password reset request is complete
   */
  passwordReset(email: string): Promise<void>;

  /**
   * Update a password reset for a customer's email address
   * @param token The password reset token
   * @param password The new password
   * @returns Promise that resolves when the password reset update is complete
   */
  passwordResetUpdate(token: string, password: string): Promise<void>;
}
