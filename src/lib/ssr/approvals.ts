'use server';

import { cache } from 'react';
import { ApprovalService } from '@/platform/services/approval/ApprovalService';
import { Approval } from '@/platform/services/model/approval';
import ssr from '@/platform/ssr';

/**
 * Get the approval service instance from the platform container
 */
const getApprovalService = () => ssr.get<ApprovalService>('ApprovalService');

/**
 * Get a specific approval by ID
 * This function is cached to prevent multiple approval fetches in a single request
 */
export const getApprovalById = cache(async (approvalId: string): Promise<Approval | null | undefined> => {
  try {
    const approvalService = getApprovalService();
    return await approvalService.getApproval(approvalId);
  } catch (_error) {
    return undefined;
  }
});

/**
 * Get all approvals for the current customer with optional pagination
 * This function is cached to prevent multiple approval fetches in a single request
 */
export const getApprovals = cache(async (pageSize?: number, pageNumber?: number): Promise<Approval[] | undefined> => {
  try {
    const approvalService = getApprovalService();
    const approvals = await approvalService.getApprovals(pageSize, pageNumber);
    return approvals;
  } catch (_error) {
    return undefined;
  }
});
