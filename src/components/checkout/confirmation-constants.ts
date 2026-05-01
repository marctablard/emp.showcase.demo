/**
 * Synthetic confirmation URL segment when checkout created an approval request
 * instead of an order. Must match navigation from checkout after createApproval.
 */
export const PENDING_APPROVAL_CONFIRMATION_SEGMENT = 'ApprovalRequested' as const;

/**
 * Returns true when the given confirmation route segment refers to the synthetic
 * pending-approval sentinel rather than a real Emporix order id. Used by SSR and
 * client code to skip order/transition fetches that would otherwise 404 against
 * the upstream order service.
 */
export const isPendingApprovalConfirmationSegment = (value?: string | null): boolean =>
  value === PENDING_APPROVAL_CONFIRMATION_SEGMENT;
