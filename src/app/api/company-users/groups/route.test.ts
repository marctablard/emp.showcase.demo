import { AdminRequiredError, USER_MANAGEMENT_ERROR_CODE } from '@/platform/services/user-management/errors';
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

describe('GET /api/company-users/groups', () => {
  const userManagementService = {
    listAssignableGroups: jest.fn(),
  };
  const logger = {
    error: jest.fn(),
  };

  beforeEach(() => {
    userManagementService.listAssignableGroups.mockReset();
    logger.error.mockReset();
    mockedServer.default.__services.clear();
    mockedServer.default.__services.set('UserManagementService', userManagementService);
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  it('returns assignable groups grouped by legal entity', async () => {
    const groups = [
      {
        legalEntityId: 'le-1',
        legalEntityName: 'Acme',
        groups: [{ id: 'group-1', legalEntityId: 'le-1', legalEntityName: 'Acme', displayName: 'Acme - Admin' }],
      },
    ];
    userManagementService.listAssignableGroups.mockResolvedValueOnce(groups);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(groups);
    expect(userManagementService.listAssignableGroups).toHaveBeenCalledTimes(1);
  });

  it('returns 403 JSON when groups require B2B admin', async () => {
    userManagementService.listAssignableGroups.mockRejectedValueOnce(new AdminRequiredError());

    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'B2B admin role is required',
      code: USER_MANAGEMENT_ERROR_CODE.ADMIN_REQUIRED,
    });
  });

  it('logs unexpected errors with a context object first', async () => {
    userManagementService.listAssignableGroups.mockRejectedValueOnce(new Error('upstream failed'));

    const response = await GET();

    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'upstream failed',
        path: '/api/company-users/groups',
        method: 'GET',
      }),
      'Error fetching assignable company-user groups',
    );
  });
});
