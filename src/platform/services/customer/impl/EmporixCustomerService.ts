import { inject } from 'inversify';
import { isAnonymousProfileCustomerId } from '@/lib/common/customer-identity';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCustomerApi } from '@/platform/integrations/emporix/customer/EmporixCustomerApi';
import type { EmporixIamApi } from '@/platform/integrations/emporix/iam/EmporixIamApi';
import { EmporixAddress } from '@/platform/integrations/emporix/model';
import { EmporixGroup } from '@/platform/integrations/emporix/model/iam';
import type { EmporixSessionContextApi } from '@/platform/integrations/emporix/session/EmporixSessionContextApi';
import type { LoggerService } from '../../logger/LoggerService';
import EmporixAddressMapper from '../../model/common/impl/EmporixAddressMapper';
import { Customer, CustomerAddress } from '../../model/customer/customer';
import { CustomerRole } from '../../model/customer/roles';
import { CustomerService, CustomerUpdateDto, PasswordChangeDto } from '../CustomerService';

enum B2BRole {
  ADMIN = 'Admin',
  BUYER = 'Buyer',
  REQUESTER = 'Requester',
}
/**
 * Emporix implementation of the CustomerService
 * Currently returns null for getCurrentCustomer as requested
 */
@injectable('CustomerService', 'Singleton')
export class EmporixCustomerService implements CustomerService {
  constructor(
    @inject('EmporixCustomerApi') private customerApi: EmporixCustomerApi,
    @inject('EmporixSessionContextApi') private sessionContextApi: EmporixSessionContextApi,
    @inject('EmporixAddressMapper') private addressMapper: EmporixAddressMapper,
    @inject('EmporixIamApi') private iamApi: EmporixIamApi,
    @inject('LoggerService') private logger: LoggerService,
  ) {}

  /**
   * Get the current logged-in customer
   * @returns Promise with the current customer or null if not logged in
   */
  async getCustomer(customerId?: string): Promise<Customer | null> {
    if (customerId) {
      throw new Error('Not implemented');
    }
    try {
      const response = await this.customerApi.getCustomerProfile();
      // return null for Anonymous for clear differentiation
      if (!response || isAnonymousProfileCustomerId(response.id)) {
        return null;
      }
      const iamResponse = await this.iamApi.getUserGroups(response.id);
      // TODO more finegrained role-management
      const roles = iamResponse.items
        .filter((group: EmporixGroup) => group.code)
        .map((group: EmporixGroup) => group.code);
      roles.push(CustomerRole.CUSTOMER);
      roles.push(response.businessModel ? CustomerRole.B2B : CustomerRole.B2C);

      if (response.businessModel === 'B2B') {
        for (const group of iamResponse.items) {
          if (!group.b2b?.role) continue;
          switch (group.b2b.role) {
            case B2BRole.ADMIN:
              if (!roles.includes(CustomerRole.B2B_ADMIN)) roles.push(CustomerRole.B2B_ADMIN);
              break;
            case B2BRole.BUYER:
              if (!roles.includes(CustomerRole.B2B_BUYER)) roles.push(CustomerRole.B2B_BUYER);
              break;
            case B2BRole.REQUESTER:
              if (!roles.includes(CustomerRole.B2B_REQUESTER)) roles.push(CustomerRole.B2B_REQUESTER);
              break;
          }
        }
      }
      return {
        id: response.id,
        email: response.contactEmail || '',
        title: response.title,
        firstName: response.firstName,
        lastName: response.lastName,
        company: response.company,
        language: response.preferredLanguage,
        currency: response.preferredCurrency,
        contactPhone: response.contactPhone,
        businessModel: response.businessModel,
        lastLogin: response.lastLogin ? new Date(response.lastLogin) : undefined,
        legalEntityId: response.b2b?.legalEntities?.[0]?.id,
        roles: roles,
      };
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error : String(error),
          customerId,
        },
        'Error fetching customer',
      );
      return null;
    }
  }

  async getAddresses(customerId?: string): Promise<CustomerAddress[]> {
    if (!customerId) {
      const addresses = await this.customerApi.getCustomerAddresses();
      return addresses.map((address) => this.mapToCustomerAddress(address));
    }
    throw new Error('Not implemented');
  }

  /**
   * Create a new address for the current customer
   * @param address The address data to create
   * @returns Promise with the created address including its ID
   */
  async createAddress(address: CustomerAddress): Promise<CustomerAddress> {
    try {
      // Convert service model to Emporix model
      const emporixAddress = this.mapFromCustomerAddress(address);

      // Create address using API
      const result = await this.customerApi.addCustomerAddress(emporixAddress);

      // Get all addresses to find the newly created one
      const addresses = await this.customerApi.getCustomerAddresses();
      const createdAddress = addresses.find((addr) => addr.id === result.id);

      if (!createdAddress) {
        throw new Error('Failed to retrieve created address');
      }

      // Convert back to service model
      return this.mapToCustomerAddress(createdAddress);
    } catch (error) {
      this.logger.error({ err: error instanceof Error ? error : String(error) }, 'Error creating customer address');
      throw new Error(`Failed to create address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing address
   * @param addressId The ID of the address to update
   * @param address The address data to update
   * @returns Promise with the updated address
   */
  async updateAddress(addressId: string, address: CustomerAddress): Promise<CustomerAddress> {
    try {
      // Convert service model to Emporix model
      const emporixAddress = this.mapFromCustomerAddress(address);
      // Update address using API
      await this.customerApi.updateCustomerAddress(addressId, emporixAddress);
      // Get all addresses to find the updated one
      const addresses = await this.customerApi.getCustomerAddresses();
      const updatedAddress = addresses.find((addr) => addr.id === addressId);

      if (!updatedAddress) {
        throw new Error('Failed to retrieve updated address');
      }

      // Convert back to service model
      return this.mapToCustomerAddress(updatedAddress);
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error : String(error),
          addressId,
        },
        'Error updating customer address',
      );
      throw new Error(`Failed to update address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete an address
   * @param addressId The ID of the address to delete
   * @returns Promise that resolves when deletion is complete
   */
  async deleteAddress(addressId: string): Promise<void> {
    try {
      // Delete address using API
      await this.customerApi.deleteCustomerAddress(addressId);
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error : String(error),
          addressId,
        },
        'Error deleting customer address',
      );
      throw new Error(`Failed to delete address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Change the password of the current customer
   * @param passwordData Object containing the current and new password
   * @returns Promise that resolves when the password change is complete
   */
  async changePassword(passwordData: PasswordChangeDto): Promise<void> {
    try {
      // Call the CustomerApi to change the password
      await this.customerApi.changePassword(passwordData);
    } catch (error) {
      this.logger.error({ err: error instanceof Error ? error : String(error) }, 'Error changing customer password');
      throw new Error(`Failed to change password: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  passwordReset(email: string): Promise<void> {
    return this.customerApi.passwordReset(email);
  }

  passwordResetUpdate(token: string, password: string): Promise<void> {
    return this.customerApi.passwordResetUpdate(token, password);
  }

  /**
   * Update the current customer's profile
   * @param customerData Customer profile data to update
   * @returns Promise that resolves with the updated customer profile
   */
  async updateCustomerProfile(customerData: CustomerUpdateDto): Promise<Customer> {
    try {
      // Update the customer profile via the API
      await this.customerApi.updateCustomerProfile(customerData);

      // Fetch the updated profile to return the new values
      const updatedProfile = await this.customerApi.getCustomerProfile();

      // Convert to the service Customer model
      return {
        id: updatedProfile.id,
        email: updatedProfile.contactEmail || '',
        firstName: updatedProfile.firstName,
        lastName: updatedProfile.lastName,
        company: updatedProfile.company,
        language: updatedProfile.preferredLanguage,
        currency: updatedProfile.preferredCurrency,
        contactPhone: updatedProfile.contactPhone,
      };
    } catch (error) {
      this.logger.error({ err: error instanceof Error ? error : String(error) }, 'Error updating customer profile');
      throw new Error(`Failed to update customer profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private mapFromCustomerAddress(source: CustomerAddress): EmporixAddress {
    const emporixAddress = this.addressMapper.mapToSource(source);
    emporixAddress.tags = source.tags || [];
    return emporixAddress;
  }

  private mapToCustomerAddress(source: EmporixAddress): CustomerAddress {
    const address = this.addressMapper.mapToService(source);
    const customerAddress: CustomerAddress = {
      ...address,
      tags: source?.tags || [],
    };
    return customerAddress;
  }
}

export default EmporixCustomerService;
