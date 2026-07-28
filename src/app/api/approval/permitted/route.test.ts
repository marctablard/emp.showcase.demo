import { POST } from './route';

jest.mock('@/platform/core/utils/debug-utils', () => ({
  withApiRouteDebug: (handler: unknown) => handler,
}));

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

describe('POST /api/approval/permitted', () => {
  const approvalService = {
    checkApprovalPermitted: jest.fn(),
  };
  const logger = {
    error: jest.fn(),
  };

  beforeEach(() => {
    approvalService.checkApprovalPermitted.mockReset();
    logger.error.mockReset();
    mockedServer.default.__services.clear();
    mockedServer.default.__services.set('ApprovalService', approvalService);
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  it('returns the permitted response for valid quote approval checks', async () => {
    approvalService.checkApprovalPermitted.mockResolvedValueOnce({
      action: 'CHECKOUT',
      permitted: false,
      approvalId: 'approval-1',
    });

    const response = await POST({
      json: jest.fn().mockResolvedValue({
        resourceId: 'quote-1',
        resourceType: 'QUOTE',
        action: 'CHECKOUT',
      }),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      action: 'CHECKOUT',
      permitted: false,
      approvalId: 'approval-1',
    });
  });

  it('returns 400 for invalid approval context', async () => {
    const response = await POST({
      json: jest.fn().mockResolvedValue({
        resourceId: 'quote-1',
        resourceType: 'ORDER',
        action: 'CHECKOUT',
      }),
    } as never);

    expect(response.status).toBe(400);
    expect(approvalService.checkApprovalPermitted).not.toHaveBeenCalled();
  });
});
