/**
 * Synthetic confirmation URL segment when checkout created an approval request
 * instead of an order. Must match navigation from checkout after createApproval.
 */
export const PENDING_APPROVAL_CONFIRMATION_SEGMENT = 'ApprovalRequested' as const;
