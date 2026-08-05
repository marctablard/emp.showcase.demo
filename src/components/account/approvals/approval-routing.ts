import type { Approval } from '@/platform/services/model/approval';

/**
 * Canonical approval detail destination. Always `/account/approvals/:id` so
 * requestors and approvers can open the approval details page.
 *
 * Related quote navigation stays on dedicated Quote ID links (table column /
 * approval details resource link), not on the Approval ID / row destination.
 *
 * Kept in a server-safe module (no client-only imports) so list and detail
 * routes share a single source of truth.
 */
export function getApprovalHref(approval: Approval, _currentUserId?: string): string {
  return `/account/approvals/${approval.id}`;
}
