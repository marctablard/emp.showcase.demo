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

const otherCompanyUser = {
  id: 'C-200',
  firstName: 'Grace',
  lastName: 'Hopper',
  contactEmail: 'grace@example.com',
  active: true,
  groups: [],
};

describe('GET /api/company-users/other-companies', () => {
  const userManagementService = {
    listOtherCompanyUsers: jest.fn(),
    listUsers: jest.fn(),
  };
  const logger = {
    error: jest.fn(),
  };

  beforeEach(() => {
    userManagementService.listOtherCompanyUsers.mockReset();
    userManagementService.listUsers.mockReset();
    logger.error.mockReset();
    mockedServer.default.__services.clear();
    mockedServer.default.__services.set('UserManagementService', userManagementService);
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  it('lists other-company users with pageNumber, pageSize, sort, query and forwards x-total-count', async () => {
    userManagementService.listOtherCompanyUsers.mockResolvedValueOnce({
      items: [otherCompanyUser],
      totalCount: 1,
    });

    const response = await GET({
      url: 'https://example.test/api/company-users/other-companies?pageNumber=2&pageSize=5&sort=firstName:asc&query=Grace',
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([otherCompanyUser]);
    expect(response.headers.get('x-total-count')).toBe('1');
    expect(userManagementService.listOtherCompanyUsers).toHaveBeenCalledWith(2, 5, 'firstName:asc', 'Grace');
    expect(userManagementService.listUsers).not.toHaveBeenCalled();
  });

  it('applies the same pageNumber and pageSize defaults as first-table GET', async () => {
    userManagementService.listOtherCompanyUsers.mockResolvedValueOnce({
      items: [otherCompanyUser],
      totalCount: 1,
    });

    const response = await GET({
      url: 'https://example.test/api/company-users/other-companies',
    } as never);

    expect(response.status).toBe(200);
    expect(userManagementService.listOtherCompanyUsers).toHaveBeenCalledWith(1, 10, undefined, undefined);
  });

  it('returns 400 when pageNumber is not a base-10 integer', async () => {
    const response = await GET({
      url: 'https://example.test/api/company-users/other-companies?pageNumber=foo',
    } as never);

    expect(response.status).toBe(400);
    expect(userManagementService.listOtherCompanyUsers).not.toHaveBeenCalled();
  });

  it('returns 400 when pageSize is less than 1', async () => {
    const response = await GET({
      url: 'https://example.test/api/company-users/other-companies?pageSize=0',
    } as never);

    expect(response.status).toBe(400);
    expect(userManagementService.listOtherCompanyUsers).not.toHaveBeenCalled();
  });

  it('omits the x-total-count header when the service does not return a total', async () => {
    userManagementService.listOtherCompanyUsers.mockResolvedValueOnce({ items: [otherCompanyUser] });

    const response = await GET({
      url: 'https://example.test/api/company-users/other-companies',
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-total-count')).toBeNull();
    expect(userManagementService.listOtherCompanyUsers).toHaveBeenCalledWith(1, 10, undefined, undefined);
  });

  it('does not proxy a client q= parameter to the service', async () => {
    userManagementService.listOtherCompanyUsers.mockResolvedValueOnce({ items: [], totalCount: 0 });

    const response = await GET({
      url: 'https://example.test/api/company-users/other-companies?q=id:(other-company)&query=Grace',
    } as never);

    expect(response.status).toBe(200);
    expect(userManagementService.listOtherCompanyUsers).toHaveBeenCalledWith(1, 10, undefined, 'Grace');
    expect(userManagementService.listOtherCompanyUsers.mock.calls[0]).not.toContain('id:(other-company)');
  });

  it.each(['userGroup:asc', 'fullName:desc', 'approver.fullName:asc', 'firstName:asc:extra', 'firstName:up'])(
    'rejects non-raw sort key %s with 400',
    async (sort) => {
      const response = await GET({
        url: `https://example.test/api/company-users/other-companies?sort=${encodeURIComponent(sort)}`,
      } as never);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'Invalid sort field' });
      expect(userManagementService.listOtherCompanyUsers).not.toHaveBeenCalled();
    },
  );

  it('returns 403 JSON when list requires B2B admin', async () => {
    userManagementService.listOtherCompanyUsers.mockRejectedValueOnce(new AdminRequiredError());

    const response = await GET({
      url: 'https://example.test/api/company-users/other-companies',
    } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'B2B admin role is required',
      code: USER_MANAGEMENT_ERROR_CODE.ADMIN_REQUIRED,
    });
  });

  it('logs unexpected list errors with a context object first', async () => {
    userManagementService.listOtherCompanyUsers.mockRejectedValueOnce(new Error('upstream failed'));

    const response = await GET({
      url: 'https://example.test/api/company-users/other-companies',
    } as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Failed to fetch other-company users' });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'upstream failed',
        path: '/api/company-users/other-companies',
        method: 'GET',
      }),
      'Error fetching other-company users',
    );
  });
});
