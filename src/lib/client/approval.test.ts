import { ApprovalAlreadyExistsError } from '@/platform/services/approval/errors';
import { createApproval, searchApprovalUsers } from './approval';

describe('createApproval', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('reuses the shared duplicate approval error type for 409 responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409,
      json: jest.fn().mockResolvedValue({
        code: 'APPROVAL_ALREADY_EXISTS',
        approvalId: 'approval-1',
        error: 'Approval already exists for this quote',
      }),
    });

    await expect(
      createApproval({
        resourceId: 'quote-1',
        resourceType: 'QUOTE',
        action: 'CHECKOUT',
        approver: { userId: 'approver-1' },
      }),
    ).rejects.toEqual(
      expect.objectContaining({ approvalId: 'approval-1', message: 'Approval already exists for this quote' }),
    );

    await expect(
      createApproval({
        resourceId: 'quote-1',
        resourceType: 'QUOTE',
        action: 'CHECKOUT',
        approver: { userId: 'approver-1' },
      }),
    ).rejects.toBeInstanceOf(ApprovalAlreadyExistsError);
  });

  it('falls back to the api error field when details are absent', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValue({
        error: 'Selected approver is not permitted for this approval',
      }),
    });

    await expect(
      createApproval({
        resourceId: 'quote-1',
        resourceType: 'QUOTE',
        action: 'CHECKOUT',
        approver: { userId: 'approver-1' },
      }),
    ).rejects.toThrow('Selected approver is not permitted for this approval');
  });

  it('falls back to the api error field for approval user search failures', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue({
        error: 'Invalid approval search request',
      }),
    });

    await expect(searchApprovalUsers('QUOTE', 'quote-1', 'CHECKOUT')).rejects.toThrow(
      'Invalid approval search request',
    );
  });
});
