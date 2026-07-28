import type { Approval } from '@/platform/services/model/approval';

/**
 * Resolves the destination for the Approval ID / row / Action arrow. Preserves the
 * exact pre-existing routing semantics:
 * - A QUOTE approval where the current user is the designated approver (and not
 *   also the requestor) routes to the standalone approval review page.
 * - Other QUOTE approvals route to the quote detail page.
 * - CART (and any other non-QUOTE) approvals route to the approval detail page.
 *
 * Kept in a server-safe module (no client-only imports) so the canonical approval
 * detail route can reuse the same decision and avoid diverging routing logic.
 */
export function getApprovalHref(approval: Approval, currentUserId?: string): string {
  if (
    approval.resourceType === 'QUOTE' &&
    currentUserId &&
    approval.approver.userId === currentUserId &&
    approval.requestor.userId !== currentUserId
  ) {
    return `/account/approval/${approval.id}`;
  }

  if (approval.resourceType === 'QUOTE') {
    return `/account/quotes/${approval.resource.id}`;
  }

  return `/account/approvals/${approval.id}`;
}
