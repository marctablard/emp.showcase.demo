'use server';

import { cache } from 'react';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Customer } from '@/platform/services/model/customer/customer';
import ssr from '@/platform/ssr';

/**
 * Get the customer service instance from the platform container
 */
const getCustomerService = () => ssr.get<CustomerService>('CustomerService');
const getLogger = () => ssr.get<LoggerService>('LoggerService');

/**
 * Get the current customer
 * This function is cached to prevent multiple customer fetches in a single request
 */
export const getCurrentCustomer = cache(async (): Promise<Customer | null | undefined> => {
  try {
    const customer = await getCustomerService().getCustomer();
    return customer;
  } catch (error) {
    getLogger().error(
      { error: error instanceof Error ? error.message : String(error) },
      'SSR getCurrentCustomer failed',
    );
    return undefined;
  }
});

/**
 * Check if a user is logged in
 * This is a convenience method that can be used in server components
 */
export async function isLoggedIn(): Promise<boolean> {
  const customer = await getCurrentCustomer();
  return customer !== null;
}
