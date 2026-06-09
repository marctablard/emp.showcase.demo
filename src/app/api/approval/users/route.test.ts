import { GET } from './route';

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

describe('GET /api/approval/users', () => {
  const approvalService = {
    searchApprovalUsers: jest.fn(),
  };
  const logger = {
    error: jest.fn(),
  };

  beforeEach(() => {
    approvalService.searchApprovalUsers.mockReset();
    logger.error.mockReset();
    mockedServer.default.__services.clear();
    mockedServer.default.__services.set('ApprovalService', approvalService);
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  it('returns approvers for a valid cart-scoped lookup', async () => {
    approvalService.searchApprovalUsers.mockResolvedValueOnce([
      {
        userId: 'approver-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        fullName: 'Ada Lovelace',
      },
    ]);

    const response = await GET({
      url: 'https://example.test/api/approval/users?resourceType=CART&resourceId=cart-1&action=CHECKOUT',
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        userId: 'approver-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        fullName: 'Ada Lovelace',
      },
    ]);
  });

  it('returns approvers for a valid quote-scoped lookup', async () => {
    approvalService.searchApprovalUsers.mockResolvedValueOnce([
      {
        userId: 'approver-2',
        firstName: 'Grace',
        lastName: 'Hopper',
        fullName: 'Grace Hopper',
      },
    ]);

    const response = await GET({
      url: 'https://example.test/api/approval/users?resourceType=QUOTE&resourceId=quote-1&action=CHECKOUT',
    } as never);

    expect(response.status).toBe(200);
    expect(approvalService.searchApprovalUsers).toHaveBeenCalledWith('QUOTE', 'quote-1', 'CHECKOUT');
    await expect(response.json()).resolves.toEqual([
      {
        userId: 'approver-2',
        firstName: 'Grace',
        lastName: 'Hopper',
        fullName: 'Grace Hopper',
      },
    ]);
  });

  it('returns 400 when required parameters are missing', async () => {
    const response = await GET({
      url: 'https://example.test/api/approval/users?resourceType=CART&resourceId=cart-1',
    } as never);

    expect(response.status).toBe(400);
    expect(approvalService.searchApprovalUsers).not.toHaveBeenCalled();
  });
});
