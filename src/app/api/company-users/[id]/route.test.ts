import {
  AdminRequiredError,
  PredefinedGroupConflictError,
  USER_MANAGEMENT_ERROR_CODE,
} from '@/platform/services/user-management/errors';
import { DELETE, GET, PATCH } from './route';

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

const companyUser = {
  id: 'C-100',
  firstName: 'Ada',
  lastName: 'Lovelace',
  contactEmail: 'ada@example.com',
  active: true,
  groups: [],
};

describe('/api/company-users/[id]', () => {
  const userManagementService = {
    getUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
  };
  const logger = {
    error: jest.fn(),
  };

  beforeEach(() => {
    userManagementService.getUser.mockReset();
    userManagementService.updateUser.mockReset();
    userManagementService.deleteUser.mockReset();
    logger.error.mockReset();
    mockedServer.default.__services.clear();
    mockedServer.default.__services.set('UserManagementService', userManagementService);
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  it('returns a company user by id', async () => {
    userManagementService.getUser.mockResolvedValueOnce(companyUser);

    const response = await GET({} as never, { params: Promise.resolve({ id: 'C-100' }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(companyUser);
    expect(userManagementService.getUser).toHaveBeenCalledWith('C-100');
  });

  it('returns 404 when the company user is missing', async () => {
    userManagementService.getUser.mockResolvedValueOnce(undefined);

    const response = await GET({} as never, { params: Promise.resolve({ id: 'missing' }) });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Company user not found' });
  });

  it('returns 403 JSON when get requires B2B admin', async () => {
    userManagementService.getUser.mockRejectedValueOnce(new AdminRequiredError());

    const response = await GET({} as never, { params: Promise.resolve({ id: 'C-100' }) });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'B2B admin role is required',
      code: USER_MANAGEMENT_ERROR_CODE.ADMIN_REQUIRED,
    });
  });

  it('logs unexpected get errors with a context object first', async () => {
    userManagementService.getUser.mockRejectedValueOnce(new Error('upstream failed'));

    const response = await GET({} as never, { params: Promise.resolve({ id: 'C-100' }) });

    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'upstream failed',
        path: '/api/company-users/C-100',
        method: 'GET',
        userId: 'C-100',
      }),
      'Error fetching company user C-100',
    );
  });

  it('updates a company user', async () => {
    userManagementService.updateUser.mockResolvedValueOnce({ ...companyUser, firstName: 'Grace' });

    const response = await PATCH(
      {
        json: jest.fn().mockResolvedValue({ firstName: 'Grace', active: true }),
      } as never,
      { params: Promise.resolve({ id: 'C-100' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ...companyUser, firstName: 'Grace' });
    expect(userManagementService.updateUser).toHaveBeenCalledWith('C-100', { firstName: 'Grace', active: true });
  });

  it('persists trimmed update fields', async () => {
    userManagementService.updateUser.mockResolvedValueOnce(companyUser);

    const response = await PATCH(
      {
        json: jest.fn().mockResolvedValue({
          title: '  Ms  ',
          firstName: '  Ada  ',
          lastName: '  Lovelace  ',
          contactEmail: '  ada@example.com  ',
          contactPhone: '  +1-555-0100  ',
          groupAssignments: [{ legalEntityId: '  le-1  ', groupId: '  group-1  ' }],
        }),
      } as never,
      { params: Promise.resolve({ id: 'C-100' }) },
    );

    expect(response.status).toBe(200);
    expect(userManagementService.updateUser).toHaveBeenCalledWith('C-100', {
      title: 'Ms',
      firstName: 'Ada',
      lastName: 'Lovelace',
      contactEmail: 'ada@example.com',
      contactPhone: '+1-555-0100',
      groupAssignments: [{ legalEntityId: 'le-1', groupId: 'group-1' }],
    });
  });

  it.each(['firstName', 'lastName', 'contactEmail'])('returns 400 when update %s is whitespace-only', async (field) => {
    const response = await PATCH(
      {
        json: jest.fn().mockResolvedValue({ [field]: '   ' }),
      } as never,
      { params: Promise.resolve({ id: 'C-100' }) },
    );

    expect(response.status).toBe(400);
    expect(userManagementService.updateUser).not.toHaveBeenCalled();
  });

  it('does not pass a password from the update body to the service', async () => {
    userManagementService.updateUser.mockResolvedValueOnce(companyUser);

    const response = await PATCH(
      {
        json: jest.fn().mockResolvedValue({ firstName: 'Ada', password: 'secret' }),
      } as never,
      { params: Promise.resolve({ id: 'C-100' }) },
    );

    expect(response.status).toBe(200);
    expect(userManagementService.updateUser).toHaveBeenCalledWith('C-100', { firstName: 'Ada' });
  });

  it('forwards an empty groupAssignments array for selected-LE unassign', async () => {
    userManagementService.updateUser.mockResolvedValueOnce({ ...companyUser, groups: [] });

    const response = await PATCH(
      {
        json: jest.fn().mockResolvedValue({ groupAssignments: [] }),
      } as never,
      { params: Promise.resolve({ id: 'C-100' }) },
    );

    expect(response.status).toBe(200);
    expect(userManagementService.updateUser).toHaveBeenCalledWith('C-100', { groupAssignments: [] });
  });

  it('returns 403 JSON when update requires B2B admin', async () => {
    userManagementService.updateUser.mockRejectedValueOnce(new AdminRequiredError());

    const response = await PATCH(
      {
        json: jest.fn().mockResolvedValue({ firstName: 'Ada' }),
      } as never,
      { params: Promise.resolve({ id: 'C-100' }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'B2B admin role is required',
      code: USER_MANAGEMENT_ERROR_CODE.ADMIN_REQUIRED,
    });
  });

  it.each([
    ['mismatched', [{ legalEntityId: 'le-other', groupId: 'g-other' }]],
    [
      'multiple',
      [
        { legalEntityId: 'le-selected', groupId: 'g-selected' },
        { legalEntityId: 'le-other', groupId: 'g-other' },
      ],
    ],
  ])('delegates %s assignments once to the authoritative service validator', async (_case, groupAssignments) => {
    userManagementService.updateUser.mockRejectedValueOnce(
      new Error('Exactly one group assignment for the selected legal entity is required'),
    );

    const response = await PATCH(
      {
        json: jest.fn().mockResolvedValue({ firstName: 'Must not mutate', groupAssignments }),
      } as never,
      { params: Promise.resolve({ id: 'C-100' }) },
    );

    expect(response.status).toBe(500);
    expect(userManagementService.updateUser).toHaveBeenCalledTimes(1);
    expect(userManagementService.updateUser).toHaveBeenCalledWith('C-100', {
      firstName: 'Must not mutate',
      groupAssignments,
    });
  });

  it('maps predefined-group conflict to a stable 400 response on PATCH', async () => {
    userManagementService.updateUser.mockRejectedValueOnce(
      new PredefinedGroupConflictError('Cannot assign customer to more than one predefined functional group'),
    );

    const response = await PATCH(
      {
        json: jest.fn().mockResolvedValue({ groupAssignments: [{ legalEntityId: 'le-selected', groupId: 'g-buyer' }] }),
      } as never,
      { params: Promise.resolve({ id: 'C-100' }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Cannot assign customer to more than one predefined functional group',
      code: USER_MANAGEMENT_ERROR_CODE.PREDEFINED_GROUP_CONFLICT,
    });
  });

  it('does not leak details for unexpected PATCH errors', async () => {
    userManagementService.updateUser.mockRejectedValueOnce(new Error('sensitive upstream payload'));

    const response = await PATCH(
      {
        json: jest.fn().mockResolvedValue({ firstName: 'Ada' }),
      } as never,
      { params: Promise.resolve({ id: 'C-100' }) },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Failed to update company user' });
  });

  it('deletes a company user with 204', async () => {
    userManagementService.deleteUser.mockResolvedValueOnce(undefined);

    const response = await DELETE({} as never, { params: Promise.resolve({ id: 'C-100' }) });

    expect(response.status).toBe(204);
    expect(userManagementService.deleteUser).toHaveBeenCalledWith('C-100');
  });

  it('returns 403 JSON when delete requires B2B admin', async () => {
    userManagementService.deleteUser.mockRejectedValueOnce(new AdminRequiredError());

    const response = await DELETE({} as never, { params: Promise.resolve({ id: 'C-100' }) });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'B2B admin role is required',
      code: USER_MANAGEMENT_ERROR_CODE.ADMIN_REQUIRED,
    });
  });
});
