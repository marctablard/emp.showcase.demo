import { getLogger } from '@/lib/logger/use-logger-client';
import type { Company } from '@/platform/services/model/company/company';

/**
 * Fetch the current Company information
 * @returns {Promise<Company|null>} The company or null if not logged in
 */
export async function fetchCurrentCompany(): Promise<Company | null> {
  try {
    const response = await fetch('/api/company/current');

    // If we get a 204, it means no company is logged in
    if (response.status === 204) {
      return null;
    }

    // For other error codes, throw an error
    if (!response.ok) {
      throw new Error(`Failed to fetch company: ${response.statusText}`);
    }

    const company = await response.json();
    return company;
  } catch (error) {
    getLogger().error({ err: error }, 'Error fetching company');
    return null;
  }
}
