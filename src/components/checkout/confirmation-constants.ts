/**
 * Synthetic confirmation URL segment when checkout created an approval request
 * instead of an order. Must match navigation from checkout after createApproval.
 */
export const PENDING_APPROVAL_CONFIRMATION_SEGMENT = 'ApprovalRequested' as const;

/** Query param that carries the created approval id onto the confirmation page. */
export const CREATED_APPROVAL_ID_QUERY_PARAM = 'approvalId' as const;

/**
 * Returns true when the given confirmation route segment refers to the synthetic
 * pending-approval sentinel rather than a real Emporix order id. Used by SSR and
 * client code to skip order/transition fetches that would otherwise 404 against
 * the upstream order service.
 */
export const isPendingApprovalConfirmationSegment = (value?: string | null): boolean =>
  value === PENDING_APPROVAL_CONFIRMATION_SEGMENT;

export function resolveCreatedApprovalId(value?: string | string[] | null): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') {
    return undefined;
  }

  const id = raw.trim();
  return id.length > 0 ? id : undefined;
}

export function pendingApprovalConfirmationPath(approvalId?: string): string {
  const base = `/confirmation/${PENDING_APPROVAL_CONFIRMATION_SEGMENT}`;
  const id = resolveCreatedApprovalId(approvalId);
  if (!id) {
    return base;
  }

  return `${base}?${CREATED_APPROVAL_ID_QUERY_PARAM}=${encodeURIComponent(id)}`;
}
