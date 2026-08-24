/**
 * IAM (Identity and Access Management) related interfaces for Emporix API
 */
import { EmporixLocalizedString, EmporixMetadata, EmporixMixins } from './common';

/**
 * Permission entity
 */
export interface EmporixPermission {
  id?: string;
  code?: string;
  name?: EmporixLocalizedString;
  description?: EmporixLocalizedString;
  applicableResources?: string[];
  metadata?: EmporixMetadata;
}

/**
 * Role entity
 */
export interface EmporixRole {
  id?: string;
  name?: EmporixLocalizedString;
  description?: EmporixLocalizedString;
  permissions: EmporixPermission[];
  metadata?: EmporixMetadata;
}

/**
 * Resource entity
 */
export interface EmporixResource {
  id?: string;
  code?: string;
  name?: EmporixLocalizedString;
  description?: EmporixLocalizedString;
  type?: string;
  metadata?: EmporixMetadata;
}

/**
 * Access Control entity
 */
export interface EmporixAccessControl {
  id?: string;
  roleId?: string;
  resourceId?: string;
  name?: EmporixLocalizedString;
  role?: EmporixRole;
  resource?: EmporixResource;
  metadata?: EmporixMetadata;
  scopes?: string[];
}

/**
 * Group entity
 */
export interface EmporixGroup {
  id?: string;
  name?: EmporixLocalizedString;
  description?: EmporixLocalizedString;
  accessControls?: string[];
  templates?: string[];
  code?: string;
  userType?: 'CUSTOMER' | 'EMPLOYEE';
  mixins?: EmporixMixins;
  metadata?: EmporixMetadata;
  b2b?: {
    role?: string;
    legalEntityId?: string;
  };
}

/**
 * Group Assignment entity
 */
export interface EmporixGroupAssignmentRequest {
  userId: string;
  userType?: 'CUSTOMER' | 'EMPLOYEE';
}

/**
 * User entity
 */
export interface EmporixIamUser {
  id?: string;
  userType?: 'CUSTOMER' | 'EMPLOYEE';
  firstName?: string;
  lastName?: string;
  contactEmail?: string;
  groupIds?: string[];
  groups?: EmporixGroup[];
  roleId?: string;
  resourceId?: string;
  name?: EmporixLocalizedString;
  role?: EmporixRole;
  resource?: EmporixResource;
  metadata?: EmporixMetadata;
  scopes?: string[];
}

/**
 * Group-user assignment returned by GET /iam/{tenant}/groups/{groupId}/users.
 */
export interface EmporixIamGroupUserAssignment {
  id?: string;
  groupId?: string;
  userId?: string;
  userType?: 'CUSTOMER' | 'EMPLOYEE';
}
