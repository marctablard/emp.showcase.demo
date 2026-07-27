import { getApprovals } from './approvals';

jest.mock('@/platform/ssr', () => {
  const services = new Map<string, unknown>();
  return {
    __esModule: true,
    default: {
      get: jest.fn((id: string) => services.get(id)),
      __services: services,
    },
  };
});

const mockedSsr = jest.requireMock('@/platform/ssr') as {
  default: { get: jest.Mock; __services: Map<string, unknown> };
};

describe('getApprovals', () => {
  const approvalService = {
    getApprovals: jest.fn(),
  };

  const logger = {
    error: jest.fn(),
  };

  beforeEach(() => {
    approvalService.getApprovals.mockReset();
    logger.error.mockReset();
    mockedSsr.default.__services.clear();
    mockedSsr.default.__services.set('ApprovalService', approvalService);
    mockedSsr.default.__services.set('LoggerService', logger);
    mockedSsr.default.get.mockImplementation((id: string) => mockedSsr.default.__services.get(id));
  });

  it('forwards page number before page size to ApprovalService', async () => {
    approvalService.getApprovals.mockResolvedValueOnce({ items: [{ id: 'approval-1' }], totalCount: 1 });

    const result = await getApprovals(3, 25);

    expect(result).toEqual({ items: [{ id: 'approval-1' }], totalCount: 1 });
    expect(approvalService.getApprovals).toHaveBeenCalledWith(3, 25, 'metadata.modifiedAt:desc');
  });

  it('forwards an explicit sort override instead of the default', async () => {
    approvalService.getApprovals.mockResolvedValueOnce({ items: [], totalCount: 0 });

    await getApprovals(1, 25, 'metadata.modifiedAt:ASC');

    expect(approvalService.getApprovals).toHaveBeenCalledWith(1, 25, 'metadata.modifiedAt:ASC');
  });

  it('returns undefined and logs when the service call fails', async () => {
    approvalService.getApprovals.mockRejectedValueOnce(new Error('boom'));

    const result = await getApprovals(1, 25);

    expect(result).toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});
