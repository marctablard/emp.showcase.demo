import { Company } from '../model/company/company';
import { CustomerAddress } from '../model/customer/customer';

/**
 * Service for company-related operations
 */
export interface CompanyService {
  /**
   * Get the Company
   * @param companyId The ID of the company to retrieve (or none for the current)
   * @returns Promise with the current company or null if not logged in
   */
  getCompany(companyId?: string): Promise<Company | null>;

  /**
   * Get all companies assigned to the current user
   * @returns Promise with array of companies
   */
  getCompanies(): Promise<Company[]>;

  /**
   * Addresses derived from the current session legal entity locations (Customer Management).
   * Used for B2B checkout address book; not persisted customer profile addresses.
   */
  getLegalEntityCheckoutAddresses(): Promise<CustomerAddress[]>;
}
