import { PENDING_APPROVAL_CONFIRMATION_SEGMENT, isPendingApprovalConfirmationSegment } from './confirmation-constants';

describe('confirmation-constants', () => {
  it('keeps the canonical pending-approval sentinel value', () => {
    expect(PENDING_APPROVAL_CONFIRMATION_SEGMENT).toBe('ApprovalRequested');
  });

  it('detects the pending-approval sentinel', () => {
    expect(isPendingApprovalConfirmationSegment(PENDING_APPROVAL_CONFIRMATION_SEGMENT)).toBe(true);
  });

  it('rejects any other route segment, including real-looking order ids', () => {
    expect(isPendingApprovalConfirmationSegment('real-order-123')).toBe(false);
    expect(isPendingApprovalConfirmationSegment('approvalrequested')).toBe(false);
    expect(isPendingApprovalConfirmationSegment('')).toBe(false);
    expect(isPendingApprovalConfirmationSegment(undefined)).toBe(false);
    expect(isPendingApprovalConfirmationSegment(null)).toBe(false);
  });
});
