import { GET, POST } from './route';

jest.mock('@/platform/server', () => {
  const services = new Map<string, unknown>();
  return {
    __esModule: true,
    default: {
      get: jest.fn((id: string) => services.get(id)),
      __services: services,
    },
  };
});

const mockedServer = jest.requireMock('@/platform/server') as {
  default: { get: jest.Mock; __services: Map<string, unknown> };
};

describe('/api/approval', () => {
  const approvalService = {
    getApprovals: jest.fn(),
    createApproval: jest.fn(),
  };
  const logger = {
    error: jest.fn(),
  };

  beforeEach(() => {
    approvalService.getApprovals.mockReset();
    approvalService.createApproval.mockReset();
    logger.error.mockReset();
    mockedServer.default.__services.clear();
    mockedServer.default.__services.set('ApprovalService', approvalService);
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  it('defaults GET sorting to metadata.modifiedAt:desc for approvals listing', async () => {
    approvalService.getApprovals.mockResolvedValueOnce([{ id: 'approval-1' }]);

    const response = await GET({ url: 'https://example.test/api/approval' } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([{ id: 'approval-1' }]);
    expect(approvalService.getApprovals).toHaveBeenCalledWith(1, 60, 'metadata.modifiedAt:desc', undefined);
  });

  it('creates a quote approval for a valid request', async () => {
    approvalService.createApproval.mockResolvedValueOnce({ id: 'approval-1' });

    const response = await POST({
      json: jest.fn().mockResolvedValue({
        resourceId: 'quote-1',
        resourceType: 'QUOTE',
        action: 'CHECKOUT',
        approver: { userId: 'approver-1' },
        comment: 'Please review',
      }),
    } as never);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ id: 'approval-1' });
    expect(approvalService.createApproval).toHaveBeenCalledWith({
      resourceId: 'quote-1',
      resourceType: 'QUOTE',
      action: 'CHECKOUT',
      approver: { userId: 'approver-1' },
      comment: 'Please review',
    });
  });

  it('returns 400 for an invalid approval request', async () => {
    const response = await POST({
      json: jest.fn().mockResolvedValue({
        resourceId: 'quote-1',
        resourceType: 'ORDER',
        action: 'CHECKOUT',
        approver: { userId: 'approver-1' },
      }),
    } as never);

    expect(response.status).toBe(400);
    expect(approvalService.createApproval).not.toHaveBeenCalled();
  });

  it('returns 409 with the linked approval when a duplicate is detected', async () => {
    const { ApprovalAlreadyExistsError } = await import('@/platform/services/approval/errors');
    approvalService.createApproval.mockRejectedValueOnce(new ApprovalAlreadyExistsError('approval-1'));

    const response = await POST({
      json: jest.fn().mockResolvedValue({
        resourceId: 'quote-1',
        resourceType: 'QUOTE',
        action: 'CHECKOUT',
        approver: { userId: 'approver-1' },
      }),
    } as never);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Approval already exists',
      code: 'APPROVAL_ALREADY_EXISTS',
      approvalId: 'approval-1',
    });
  });

  it('returns 403 when the selected approver is not permitted', async () => {
    const { ApprovalApproverNotPermittedError } = await import('@/platform/services/approval/errors');
    approvalService.createApproval.mockRejectedValueOnce(new ApprovalApproverNotPermittedError('approver-2'));

    const response = await POST({
      json: jest.fn().mockResolvedValue({
        resourceId: 'quote-1',
        resourceType: 'QUOTE',
        action: 'CHECKOUT',
        approver: { userId: 'approver-2' },
      }),
    } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Selected approver is not permitted for this approval',
      code: 'APPROVER_NOT_PERMITTED',
      approverId: 'approver-2',
    });
  });
});
