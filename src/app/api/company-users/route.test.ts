import {
  AdminRequiredError,
  PredefinedGroupConflictError,
  USER_MANAGEMENT_ERROR_CODE,
} from '@/platform/services/user-management/errors';
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

const createdUser = {
  id: 'C-100',
  firstName: 'Ada',
  lastName: 'Lovelace',
  contactEmail: 'ada@example.com',
  active: false,
  groups: [],
};

describe('/api/company-users', () => {
  const userManagementService = {
    listUsers: jest.fn(),
    createUser: jest.fn(),
  };
  const logger = {
    error: jest.fn(),
  };

  beforeEach(() => {
    userManagementService.listUsers.mockReset();
    userManagementService.createUser.mockReset();
    logger.error.mockReset();
    mockedServer.default.__services.clear();
    mockedServer.default.__services.set('UserManagementService', userManagementService);
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  it('lists users with pageNumber, pageSize, sort, query and forwards x-total-count', async () => {
    userManagementService.listUsers.mockResolvedValueOnce({ items: [createdUser], totalCount: 1 });

    const response = await GET({
      url: 'https://example.test/api/company-users?pageNumber=2&pageSize=5&sort=firstName:asc&query=Ada',
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([createdUser]);
    expect(response.headers.get('x-total-count')).toBe('1');
    expect(userManagementService.listUsers).toHaveBeenCalledWith(2, 5, 'firstName:asc', 'Ada');
  });

  it('omits the x-total-count header when the service does not return a total', async () => {
    userManagementService.listUsers.mockResolvedValueOnce({ items: [createdUser] });

    const response = await GET({ url: 'https://example.test/api/company-users' } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-total-count')).toBeNull();
    expect(userManagementService.listUsers).toHaveBeenCalledWith(1, 10, undefined, undefined);
  });

  it('returns 400 when pageNumber is not a base-10 integer', async () => {
    const response = await GET({ url: 'https://example.test/api/company-users?pageNumber=foo' } as never);

    expect(response.status).toBe(400);
    expect(userManagementService.listUsers).not.toHaveBeenCalled();
  });

  it('returns 400 when pageSize is less than 1', async () => {
    const response = await GET({ url: 'https://example.test/api/company-users?pageSize=0' } as never);

    expect(response.status).toBe(400);
    expect(userManagementService.listUsers).not.toHaveBeenCalled();
  });

  it('does not proxy a client q= parameter to the service', async () => {
    userManagementService.listUsers.mockResolvedValueOnce({ items: [], totalCount: 0 });

    const response = await GET({
      url: 'https://example.test/api/company-users?q=id:(other-company)&query=Ada',
    } as never);

    expect(response.status).toBe(200);
    expect(userManagementService.listUsers).toHaveBeenCalledWith(1, 10, undefined, 'Ada');
    expect(userManagementService.listUsers.mock.calls[0]).not.toContain('id:(other-company)');
  });

  it.each(['userGroup:asc', 'fullName:desc', 'approver.fullName:asc'])(
    'rejects non-raw sort key %s with 400',
    async (sort) => {
      const response = await GET({
        url: `https://example.test/api/company-users?sort=${encodeURIComponent(sort)}`,
      } as never);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'Invalid sort field' });
      expect(userManagementService.listUsers).not.toHaveBeenCalled();
    },
  );

  it('returns 403 JSON when list requires B2B admin', async () => {
    userManagementService.listUsers.mockRejectedValueOnce(new AdminRequiredError());

    const response = await GET({ url: 'https://example.test/api/company-users' } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'B2B admin role is required',
      code: USER_MANAGEMENT_ERROR_CODE.ADMIN_REQUIRED,
    });
  });

  it('logs unexpected list errors with a context object first', async () => {
    userManagementService.listUsers.mockRejectedValueOnce(new Error('upstream failed'));

    const response = await GET({ url: 'https://example.test/api/company-users' } as never);

    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'upstream failed',
        path: '/api/company-users',
        method: 'GET',
      }),
      'Error fetching company users',
    );
  });

  it('creates a company user and returns 201', async () => {
    userManagementService.createUser.mockResolvedValueOnce({ user: createdUser });

    const payload = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      contactEmail: 'ada@example.com',
      active: false,
      groupAssignments: [{ legalEntityId: 'le-1', groupId: 'group-1' }],
    };

    const response = await POST({
      json: jest.fn().mockResolvedValue(payload),
    } as never);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ user: createdUser });
    expect(userManagementService.createUser).toHaveBeenCalledWith(payload);
  });

  it('returns 201 with a warning payload including failed group names on partial create', async () => {
    userManagementService.createUser.mockResolvedValueOnce({
      user: createdUser,
      failedGroupNames: ['Acme - Admin'],
    });

    const response = await POST({
      json: jest.fn().mockResolvedValue({
        firstName: 'Ada',
        lastName: 'Lovelace',
        contactEmail: 'ada@example.com',
        active: false,
        groupAssignments: [{ legalEntityId: 'le-1', groupId: 'group-1' }],
      }),
    } as never);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      user: createdUser,
      failedGroupNames: ['Acme - Admin'],
      warning: { failedGroupNames: ['Acme - Admin'] },
    });
  });

  it('does not pass a password from the create body to the service', async () => {
    userManagementService.createUser.mockResolvedValueOnce({ user: createdUser });

    const response = await POST({
      json: jest.fn().mockResolvedValue({
        firstName: 'Ada',
        lastName: 'Lovelace',
        contactEmail: 'ada@example.com',
        password: 'secret',
        active: true,
        groupAssignments: [{ legalEntityId: 'le-1', groupId: 'group-1' }],
      }),
    } as never);

    expect(response.status).toBe(201);
    expect(userManagementService.createUser).toHaveBeenCalledWith({
      firstName: 'Ada',
      lastName: 'Lovelace',
      contactEmail: 'ada@example.com',
      active: true,
      groupAssignments: [{ legalEntityId: 'le-1', groupId: 'group-1' }],
    });
  });

  it('persists trimmed create fields', async () => {
    userManagementService.createUser.mockResolvedValueOnce({ user: createdUser });

    const response = await POST({
      json: jest.fn().mockResolvedValue({
        title: '  Ms  ',
        firstName: '  Ada  ',
        lastName: '  Lovelace  ',
        contactEmail: '  ada@example.com  ',
        contactPhone: '  +1-555-0100  ',
        active: false,
        groupAssignments: [{ legalEntityId: '  le-1  ', groupId: '  group-1  ' }],
      }),
    } as never);

    expect(response.status).toBe(201);
    expect(userManagementService.createUser).toHaveBeenCalledWith({
      title: 'Ms',
      firstName: 'Ada',
      lastName: 'Lovelace',
      contactEmail: 'ada@example.com',
      contactPhone: '+1-555-0100',
      active: false,
      groupAssignments: [{ legalEntityId: 'le-1', groupId: 'group-1' }],
    });
  });

  it.each(['firstName', 'lastName', 'contactEmail'])('returns 400 when create %s is whitespace-only', async (field) => {
    const payload = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      contactEmail: 'ada@example.com',
      active: false,
      groupAssignments: [{ legalEntityId: 'le-1', groupId: 'group-1' }],
      [field]: '   ',
    };

    const response = await POST({
      json: jest.fn().mockResolvedValue(payload),
    } as never);

    expect(response.status).toBe(400);
    expect(userManagementService.createUser).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid create request', async () => {
    const response = await POST({
      json: jest.fn().mockResolvedValue({ firstName: 'Ada' }),
    } as never);

    expect(response.status).toBe(400);
    expect(userManagementService.createUser).not.toHaveBeenCalled();
  });

  it('returns 403 JSON when create requires B2B admin', async () => {
    userManagementService.createUser.mockRejectedValueOnce(new AdminRequiredError());

    const response = await POST({
      json: jest.fn().mockResolvedValue({
        firstName: 'Ada',
        lastName: 'Lovelace',
        contactEmail: 'ada@example.com',
        active: false,
        groupAssignments: [{ legalEntityId: 'le-1', groupId: 'group-1' }],
      }),
    } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'B2B admin role is required',
      code: USER_MANAGEMENT_ERROR_CODE.ADMIN_REQUIRED,
    });
  });

  it('allow-lists the exact same-company upstream message as a stable 400 response', async () => {
    const body = JSON.stringify({
      message: 'Customer can only assign new customer to the same company',
    });
    const error = Object.assign(new Error(`EmporixApiError.message includes ${body}`), {
      status: 400,
      statusText: 'Bad Request',
      operation: 'Create customer',
      body,
      userManagementLogContext: {
        status: 400,
        statusText: 'Bad Request',
        operation: 'Create customer',
        tokenType: 'service',
        createDtoKeys: ['firstName', 'lastName', 'contactEmail'],
      },
    });
    userManagementService.createUser.mockRejectedValueOnce(error);

    const response = await POST({
      json: jest.fn().mockResolvedValue({
        firstName: 'Ada',
        lastName: 'Lovelace',
        contactEmail: 'ada@example.com',
        active: false,
        groupAssignments: [{ legalEntityId: 'le-1', groupId: 'group-1' }],
      }),
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Customer can only assign new customer to the same company',
      code: USER_MANAGEMENT_ERROR_CODE.SAME_COMPANY_REQUIRED,
    });
    expect(logger.error).toHaveBeenCalledWith(
      {
        status: 400,
        statusText: 'Bad Request',
        operation: 'Create customer',
        tokenType: 'service',
        createDtoKeys: ['firstName', 'lastName', 'contactEmail'],
        path: '/api/company-users',
        method: 'POST',
      },
      'Error creating company user',
    );
  });

  it('maps predefined-group conflict from create IAM link to a stable 400 response', async () => {
    userManagementService.createUser.mockRejectedValueOnce(
      new PredefinedGroupConflictError('Cannot assign customer to more than one predefined functional group'),
    );

    const response = await POST({
      json: jest.fn().mockResolvedValue({
        firstName: 'Ada',
        lastName: 'Lovelace',
        contactEmail: 'ada@example.com',
        active: false,
        groupAssignments: [{ legalEntityId: 'le-1', groupId: 'group-1' }],
      }),
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Cannot assign customer to more than one predefined functional group',
      code: USER_MANAGEMENT_ERROR_CODE.PREDEFINED_GROUP_CONFLICT,
    });
  });

  it.each([
    [
      'unrelated structured body',
      JSON.stringify({
        message: 'Arbitrary upstream message for pii@example.com',
        details: [{ password: 'super-secret' }],
      }),
    ],
    ['malformed body', '{"message":'],
    ['non-object body', JSON.stringify('Customer can only assign new customer to the same company')],
  ])('returns a generic safe 400 for %s', async (_case, body) => {
    const emporixApiErrorMessage = `EmporixApiError.message ${body}`;
    userManagementService.createUser.mockRejectedValueOnce(
      Object.assign(new Error(emporixApiErrorMessage), {
        status: 400,
        statusText: 'Bad Request',
        operation: 'Create customer',
        body,
        details: { token: 'secret-token', email: 'pii@example.com' },
        userManagementLogContext: {
          status: 400,
          statusText: 'Bad Request',
          operation: 'Create customer',
          message: 'Arbitrary upstream message for pii@example.com',
          details: [{ password: 'super-secret' }],
          createDtoKeys: ['firstName', 'lastName', 'contactEmail'],
        },
      }),
    );

    const response = await POST({
      json: jest.fn().mockResolvedValue({
        firstName: 'Ada',
        lastName: 'Lovelace',
        contactEmail: 'ada@example.com',
        active: false,
        groupAssignments: [{ legalEntityId: 'le-1', groupId: 'group-1' }],
      }),
    } as never);

    expect(response.status).toBe(400);
    const responseBody = await response.json();
    expect(responseBody).toEqual({ error: 'Failed to create company user' });
    const serialized = JSON.stringify(responseBody);
    expect(serialized).not.toContain(body);
    expect(serialized).not.toContain(emporixApiErrorMessage);
    expect(serialized).not.toContain('details');
    expect(serialized).not.toContain('Arbitrary upstream message');
    expect(serialized).not.toContain('super-secret');
    expect(serialized).not.toContain('pii@example.com');
    expect(serialized).not.toContain('secret-token');
    expect(JSON.stringify(logger.error.mock.calls[0]?.[0])).not.toContain('super-secret');
    expect(JSON.stringify(logger.error.mock.calls[0]?.[0])).not.toContain('pii@example.com');
  });

  it('keeps unexpected non-400 create errors generic at 500', async () => {
    userManagementService.createUser.mockRejectedValueOnce(
      Object.assign(new Error('sensitive upstream failure'), {
        status: 503,
        body: JSON.stringify({ message: 'secret outage detail' }),
      }),
    );

    const response = await POST({
      json: jest.fn().mockResolvedValue({
        firstName: 'Ada',
        lastName: 'Lovelace',
        contactEmail: 'ada@example.com',
        active: false,
        groupAssignments: [{ legalEntityId: 'le-1', groupId: 'group-1' }],
      }),
    } as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Failed to create company user' });
  });
});
