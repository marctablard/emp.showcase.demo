import type {
  EmporixCustomerAdmin,
  EmporixCustomerAdminCreateRequest,
  EmporixCustomerAdminUpdateRequest,
} from '../model/customer';

/**
 * Tenant-managed Customer Service API (GET/POST/PATCH/DELETE /customer/{tenant}/customers).
 * Read/write methods accept an explicit token type while preserving session defaults for existing callers.
 * Distinct from {@link EmporixCustomerApi} (`/me` customer-managed client).
 */
export interface EmporixCustomerAdminApi {
  /**
   * List tenant-managed customers
   * @param pageNumber Optional page number (default: 1)
   * @param pageSize Optional page size (default: 60)
   * @param sort Optional raw sort string
   * @param query Optional raw `q` filter
   * @param tokenType Auth token type. Defaults to `'session'`; service is only for caller-constrained reads.
   * @returns Items plus optional total from the Count / x-total-count header (never page length)
   */
  getCustomers(
    pageNumber?: number,
    pageSize?: number,
    sort?: string,
    query?: string,
    tokenType?: 'service' | 'session',
  ): Promise<{ items: EmporixCustomerAdmin[]; totalCount?: number }>;

  /**
   * Get a tenant-managed customer by `{customerNumber}`
   * @param customerNumber Path identifier (may differ from create ResourceLocation.id)
   * @param tokenType Auth token type. Defaults to `'session'`.
   * @returns Customer or null when not found
   */
  getCustomer(customerNumber: string, tokenType?: 'service' | 'session'): Promise<EmporixCustomerAdmin | null>;

  /**
   * Invite-create a customer (`sendPasswordResetNotifications=true`, no password)
   * The caller scopes the customer session to the selected legal entity before this request.
   * @param customer Profile fields only; password and `b2b` are never sent
   * @param legalEntityId Selected legal entity used only for diagnostic correlation; it is not sent upstream
   * @returns ResourceLocation `{ id }`
   */
  createCustomer(customer: EmporixCustomerAdminCreateRequest, legalEntityId: string): Promise<{ id: string }>;

  /**
   * Patch a tenant-managed customer by `{customerNumber}`
   * @param customerNumber Path identifier
   * @param customer Fields to update (includes `active`)
   * @param tokenType Auth token type. Defaults to `'session'`.
   */
  updateCustomer(
    customerNumber: string,
    customer: EmporixCustomerAdminUpdateRequest,
    tokenType?: 'service' | 'session',
  ): Promise<void>;

  /**
   * Delete a tenant-managed customer by `{customerNumber}`
   * @param customerNumber Path identifier
   * @param tokenType Auth token type. Defaults to `'session'`.
   */
  deleteCustomer(customerNumber: string, tokenType?: 'service' | 'session'): Promise<void>;
}
