import { GET } from './route';

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

describe('GET /api/approval/requires-approval', () => {
  const approvalService = {
    requiresApproval: jest.fn(),
  };
  const logger = {
    error: jest.fn(),
  };

  beforeEach(() => {
    approvalService.requiresApproval.mockReset();
    logger.error.mockReset();
    mockedServer.default.__services.clear();
    mockedServer.default.__services.set('ApprovalService', approvalService);
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  it('defaults missing context to CART/CHECKOUT', async () => {
    approvalService.requiresApproval.mockResolvedValueOnce(true);

    const response = await GET({ url: 'https://example.test/api/approval/requires-approval?cartId=cart-1' } as never);

    expect(response.status).toBe(200);
    expect(approvalService.requiresApproval).toHaveBeenCalledWith({
      resourceId: 'cart-1',
      resourceType: 'CART',
      action: 'CHECKOUT',
    });
  });

  it('returns 400 for invalid resourceType', async () => {
    const response = await GET({
      url: 'https://example.test/api/approval/requires-approval?resourceId=quote-1&resourceType=ORDER&action=CHECKOUT',
    } as never);

    expect(response.status).toBe(400);
    expect(approvalService.requiresApproval).not.toHaveBeenCalled();
  });
});
