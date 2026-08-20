'use server';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentCustomer } from '@/lib/ssr/customer';
import type { CompanyService } from '@/platform/services/company/CompanyService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Customer } from '@/platform/services/model/customer/customer';
import { CustomerRole } from '@/platform/services/model/customer/roles';
import type { CompanyUser } from '@/platform/services/model/user-management/company-user';
import type { UserManagementService } from '@/platform/services/user-management/UserManagementService';
import ssr from '@/platform/ssr';

const getUserManagementService = () => ssr.get<UserManagementService>('UserManagementService');
const getCompanyService = () => ssr.get<CompanyService>('CompanyService');
const getLogger = () => ssr.get<LoggerService>('LoggerService');

export interface SsrCompanyUsersPageResult {
  items: CompanyUser[];
  totalCount?: number;
}

/**
 * Redirect unauthenticated and non-admin visitors away from User Management pages.
 *
 * `src/proxy.ts` `accountRegex` only matches one `/account/{segment}` path, so
 * nested routes (`/account/users/new`, `/account/users/[id]`) are not proxy-gated.
 * This helper must redirect when the customer is null as well as when roles lack
 * `B2B_ADMIN`.
 */
export async function requireB2bAdmin(): Promise<Customer> {
  const customer = await getCurrentCustomer();
  if (customer == null || customer.roles?.includes(CustomerRole.B2B_ADMIN) !== true) {
    redirect('/account');
  }
  return customer;
}

/**
 * Get a company user by id for the selected legal entity.
 * Cached to prevent multiple fetches in a single request.
 */
export const getCompanyUserById = cache(async (userId: string): Promise<CompanyUser | null | undefined> => {
  try {
    const userManagementService = getUserManagementService();
    return await userManagementService.getUser(userId);
  } catch (error) {
    getLogger().error(
      { error: error instanceof Error ? error.message : String(error), userId },
      'SSR getCompanyUserById failed',
    );
    return undefined;
  }
});

/**
 * List company users of the selected legal entity with optional pagination, sort, and search.
 * Cached to prevent multiple fetches in a single request.
 */
export const getCompanyUsers = cache(
  async (
    pageNumber?: number,
    pageSize?: number,
    sort?: string,
    query?: string,
  ): Promise<SsrCompanyUsersPageResult | undefined> => {
    try {
      const userManagementService = getUserManagementService();
      const { items, totalCount } = await userManagementService.listUsers(pageNumber, pageSize, sort, query);
      return { items, totalCount };
    } catch (error) {
      getLogger().error(
        { error: error instanceof Error ? error.message : String(error), pageNumber, pageSize, sort, query },
        'SSR getCompanyUsers failed',
      );
      return undefined;
    }
  },
);

/**
 * Whether the current customer has more than one company.
 * Used later for Q24 checkbox visibility. Does not load other-company users.
 */
export const hasMultipleCompanies = cache(async (): Promise<boolean> => {
  try {
    const companies = await getCompanyService().getCompanies();
    return companies.length > 1;
  } catch (error) {
    getLogger().error(
      { error: error instanceof Error ? error.message : String(error) },
      'SSR hasMultipleCompanies failed',
    );
    return false;
  }
});

export interface HeaderCompany {
  id: string;
  name: string;
}

/**
 * Header companies for the edit-user read-only other-LE group list.
 * `{ id, name }` only — do not pass `Company.onboarding.updatedAt` Dates across RSC.
 */
export const getHeaderCompanies = cache(async (): Promise<HeaderCompany[]> => {
  try {
    const companies = await getCompanyService().getCompanies();
    return companies.map((company) => ({ id: company.id, name: company.name }));
  } catch (error) {
    getLogger().error(
      { error: error instanceof Error ? error.message : String(error) },
      'SSR getHeaderCompanies failed',
    );
    return [];
  }
});
