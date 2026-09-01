import {
  CREATED_APPROVAL_ID_QUERY_PARAM,
  PENDING_APPROVAL_CONFIRMATION_SEGMENT,
  isPendingApprovalConfirmationSegment,
  pendingApprovalConfirmationPath,
  resolveCreatedApprovalId,
} from './confirmation-constants';

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

  it('builds the pending-approval confirmation path with the created approval id', () => {
    expect(pendingApprovalConfirmationPath('6a968e55295fcf269f09c3ed')).toBe(
      `/confirmation/${PENDING_APPROVAL_CONFIRMATION_SEGMENT}?${CREATED_APPROVAL_ID_QUERY_PARAM}=6a968e55295fcf269f09c3ed`,
    );
  });

  it('omits the query when createApproval did not return an id', () => {
    expect(pendingApprovalConfirmationPath()).toBe(`/confirmation/${PENDING_APPROVAL_CONFIRMATION_SEGMENT}`);
    expect(pendingApprovalConfirmationPath('   ')).toBe(`/confirmation/${PENDING_APPROVAL_CONFIRMATION_SEGMENT}`);
  });

  it('reads the first non-empty approvalId search param', () => {
    expect(resolveCreatedApprovalId('6a968e55295fcf269f09c3ed')).toBe('6a968e55295fcf269f09c3ed');
    expect(resolveCreatedApprovalId(['6a968e55295fcf269f09c3ed', 'other'])).toBe('6a968e55295fcf269f09c3ed');
    expect(resolveCreatedApprovalId(['', 'other'])).toBeUndefined();
    expect(resolveCreatedApprovalId(undefined)).toBeUndefined();
  });
});
