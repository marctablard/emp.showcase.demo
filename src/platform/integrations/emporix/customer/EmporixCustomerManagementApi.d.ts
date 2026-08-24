import type { EmporixContactAssignment, EmporixLegalEntity, EmporixLocation } from '../model';

export interface EmporixCustomerManagementApi {
  getLegalEntityById(id: string): Promise<EmporixLegalEntity | null>;
  createLegalEntity(legalEntity: EmporixLegalEntity): Promise<EmporixLegalEntity>;
  updateLegalEntity(id: string, legalEntity: EmporixLegalEntity): Promise<EmporixLegalEntity>;
  getLegalEntities(): Promise<EmporixLegalEntity[]>;
  createContactAssignment(contactAssignment: EmporixContactAssignment): Promise<EmporixContactAssignment>;
  /**
   * Create a CONTACT membership assignment via documented
   * `POST customer-management/{tenant}/contact-assignments` with the default service client token.
   * Always sends `type: 'CONTACT'`. Do not use {@link createContactAssignment} (short URL) for User Management.
   */
  createLegalEntityContactAssignment(
    assignment: Pick<EmporixContactAssignment, 'legalEntity' | 'customer'>,
  ): Promise<{ id: string }>;
  updateContactAssignment(id: string, contactAssignment: EmporixContactAssignment): Promise<EmporixContactAssignment>;
  getContactAssignmentsByCustomerId(customerId: string): Promise<EmporixContactAssignment[]>;
  /**
   * List assignments for a legal entity via documented
   * `GET customer-management/{tenant}/contact-assignments?legalEntity.id=` with paging and a service token.
   * Does not filter by `type` so PRIMARY (and other) members are included.
   */
  getContactAssignmentsByLegalEntityId(
    legalEntityId: string,
    pageNumber?: number,
    pageSize?: number,
  ): Promise<{ items: EmporixContactAssignment[]; totalCount?: number }>;
  getContactAssignmentById(id: string): Promise<EmporixContactAssignment | null>;
  deleteContactAssignment(id: string): Promise<void>;
  createLocation(location: EmporixLocation): Promise<EmporixLocation>;
  updateLocation(id: string, location: EmporixLocation): Promise<EmporixLocation>;
  getLocations(): Promise<EmporixLocation[]>;
  getLocationById(id: string): Promise<EmporixLocation | null>;
  deleteLocation(id: string): Promise<void>;
}
