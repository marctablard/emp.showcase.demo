import { ApprovalAlreadyExistsError } from '@/platform/services/approval/errors';
import type {
  ApprovalAction,
  ApprovalCreateRequest,
  ApprovalId,
  ApprovalPermittedRequest,
  ApprovalPermittedResponse,
  ApprovalResourceType,
  ApprovalUser,
} from '@/platform/services/model/approval';

export interface ApprovalRequirementRequest {
  resourceId: string;
  resourceType?: ApprovalResourceType;
  action?: ApprovalAction;
}

function getApprovalApiErrorMessage(errorData: { details?: string; error?: string }, fallback: string): string {
  return errorData.details || errorData.error || fallback;
}

/**
 * Check if a cart requires approval
 * @param input The resource to check
 * @returns Promise with boolean indicating if approval is required
 */
export async function requiresApproval(input: string | ApprovalRequirementRequest): Promise<boolean> {
  const params = new URLSearchParams();

  if (typeof input === 'string') {
    params.set('cartId', input);
  } else {
    params.set('resourceId', input.resourceId);
    if (input.resourceType) {
      params.set('resourceType', input.resourceType);
    }
    if (input.action) {
      params.set('action', input.action);
    }
  }

  const response = await fetch(`/api/approval/requires-approval?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(getApprovalApiErrorMessage(errorData, 'Failed to check approval requirements'));
  }

  const result = await response.json();
  return result === true;
}

/**
 * Check whether an approval action is permitted and whether an existing approval is linked
 * @param request The approval permission request context
 * @returns Promise with approval permission details
 */
export async function checkApprovalPermitted(request: ApprovalPermittedRequest): Promise<ApprovalPermittedResponse> {
  const response = await fetch('/api/approval/permitted', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(getApprovalApiErrorMessage(errorData, 'Failed to check approval permission'));
  }

  return response.json();
}

/**
 * Search for users who can approve a specific resource
 * @param resourceType The type of resource (e.g., 'cart', 'order')
 * @param resourceId The ID of the resource
 * @param action The action being performed (e.g., 'checkout')
 * @returns Promise with array of approval users
 */
export async function searchApprovalUsers(
  resourceType: ApprovalResourceType,
  resourceId: string,
  action: ApprovalAction,
): Promise<ApprovalUser[]> {
  const response = await fetch(
    `/api/approval/users?resourceType=${encodeURIComponent(resourceType)}&resourceId=${encodeURIComponent(resourceId)}&action=${encodeURIComponent(action)}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(getApprovalApiErrorMessage(errorData, 'Failed to search approval users'));
  }

  return response.json();
}

/**
 * Create a new approval request
 * @param approval The approval request data
 * @returns Promise with the created approval ID
 */
export async function createApproval(approval: ApprovalCreateRequest): Promise<ApprovalId> {
  const response = await fetch('/api/approval', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(approval),
  });

  if (!response.ok) {
    const errorData = await response.json();

    if (response.status === 409 && errorData.code === 'APPROVAL_ALREADY_EXISTS' && errorData.approvalId) {
      throw new ApprovalAlreadyExistsError(errorData.approvalId, errorData.error);
    }

    throw new Error(getApprovalApiErrorMessage(errorData, 'Failed to create approval request'));
  }

  return response.json();
}
