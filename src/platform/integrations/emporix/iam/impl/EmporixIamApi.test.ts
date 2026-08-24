import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type EmporixApiInvoker from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import type { EmporixGroupAssignmentRequest } from '../../model/iam';
import EmporixIamApi from './EmporixIamApi';

describe('EmporixIamApi', () => {
  const mockConfig: EmporixConfig = {
    baseUrl: 'https://api.emporix.io',
    tenant: 'test-tenant',
    clientId: 'test-client-id',
    clientSecret: '',
    serverClientId: '',
    serverClientSecret: '',
  };

  let mockApiClient: jest.Mocked<Pick<EmporixApiInvoker, 'authenticatedFetch'>>;
  let mockLogger: jest.Mocked<LoggerService>;
  let iamApi: EmporixIamApi;

  const jsonResponse = (
    body: unknown,
    init?: { status?: number; ok?: boolean; headers?: Record<string, string> },
  ): Response => {
    const response = {
      ok: init?.ok ?? true,
      status: init?.status ?? 200,
      statusText: init?.ok === false ? 'Bad Request' : 'OK',
      json: jest.fn().mockResolvedValue(body),
      text: jest.fn().mockResolvedValue(JSON.stringify(body)),
      headers: new Headers(init?.headers),
    } as unknown as Response;
    response.clone = jest.fn(() => response);
    return response;
  };

  beforeEach(() => {
    mockApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue(jsonResponse({})),
    };
    mockLogger = {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;
    iamApi = new EmporixIamApi(mockApiClient as unknown as EmporixApiInvoker, mockConfig, mockLogger);
  });

  describe('getUsers', () => {
    it('lists CUSTOMER users with expanded groups, paging, and the service token', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(
        jsonResponse([{ id: 'customer-1', userType: 'CUSTOMER', groups: [{ id: 'group-1' }] }], {
          headers: { 'x-total-count': '17' },
        }),
      );

      const result = await iamApi.getUsers(2, 25);

      const [url, options, tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
      const parsedUrl = new URL(url, 'https://api.emporix.io');
      expect(parsedUrl.pathname).toBe('/iam/test-tenant/users');
      expect(parsedUrl.searchParams.get('userType')).toBe('CUSTOMER');
      expect(parsedUrl.searchParams.get('expand')).toBe('groups');
      expect(parsedUrl.searchParams.has('extend')).toBe(false);
      expect(parsedUrl.searchParams.get('pageNumber')).toBe('2');
      expect(parsedUrl.searchParams.get('pageSize')).toBe('25');
      expect(options).toEqual({ method: 'GET', headers: { 'X-Total-Count': 'true' } });
      expect(tokenType).toBe('service');
      expect(result).toEqual({
        items: [{ id: 'customer-1', userType: 'CUSTOMER', groups: [{ id: 'group-1' }] }],
        totalCount: 17,
      });
    });

    it('reads users from an { items } wrapper when the body is not a bare array', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(
        jsonResponse({ items: [{ id: 'customer-2', userType: 'CUSTOMER' }] }, { headers: { 'x-total-count': '1' } }),
      );

      await expect(iamApi.getUsers()).resolves.toEqual({
        items: [{ id: 'customer-2', userType: 'CUSTOMER' }],
        totalCount: 1,
      });
    });

    it('returns an empty list when the body is neither an array nor an items wrapper', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(jsonResponse({ code: 404, message: 'Not Found' }));

      await expect(iamApi.getUsers()).resolves.toEqual({ items: [] });
    });
  });

  describe('getGroups', () => {
    it('forwards the documented q and userType filters with the default service token', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(jsonResponse([]));

      await iamApi.getGroups({ query: 'b2b.legalEntityId:"le-1"', criteria: { userType: 'CUSTOMER' } });

      expect(mockApiClient.authenticatedFetch).toHaveBeenCalledTimes(1);
      const [url, options, tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
      const parsedUrl = new URL(url, 'https://api.emporix.io');
      expect(parsedUrl.pathname).toBe('/iam/test-tenant/groups');
      expect(parsedUrl.searchParams.get('q')).toBe('b2b.legalEntityId:"le-1"');
      expect(parsedUrl.searchParams.get('userType')).toBe('CUSTOMER');
      expect(options.method).toBe('GET');
      expect(tokenType).toBe('service');
    });

    it('can be invoked with a session token', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(jsonResponse([]));

      await iamApi.getGroups({ criteria: { userType: 'CUSTOMER' } }, 'session');

      const [, , tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
      expect(tokenType).toBe('session');
    });
  });

  describe('addUserToGroup', () => {
    const assignment: EmporixGroupAssignmentRequest = { userId: 'cust-1', userType: 'CUSTOMER' };

    it('uses the default service token', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(jsonResponse({ id: 'asg-1' }, { status: 201 }));

      const result = await iamApi.addUserToGroup('group-1', assignment);

      expect(result).toEqual({ id: 'asg-1' });
      expect(mockApiClient.authenticatedFetch).toHaveBeenCalledTimes(1);
      const [url, options, tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
      expect(url).toBe('/iam/test-tenant/groups/group-1/users');
      expect(options.method).toBe('POST');
      expect(tokenType).toBe('service');
      expect(JSON.parse(String(options.body))).toEqual(assignment);
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          operation: 'Add user to group',
          tokenType: 'service',
          method: 'POST',
          url: '/iam/test-tenant/groups/group-1/users',
          groupId: 'group-1',
          requestHeaders: { 'Content-Type': 'application/json' },
          requestBody: assignment,
          responseStatus: 201,
          responseBody: { id: 'asg-1' },
        },
        'EXTERNAL Add user to group response',
      );
    });

    it('can be invoked with a session token', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(jsonResponse({ id: 'asg-1' }, { status: 201 }));

      await iamApi.addUserToGroup('group-1', assignment, 'session');

      const [, , tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
      expect(tokenType).toBe('session');
    });

    it('logs the upstream 404 body without email or authorization data', async () => {
      const upstreamBody = { status: 404, message: 'Group not found' };
      mockApiClient.authenticatedFetch.mockResolvedValue(jsonResponse(upstreamBody, { ok: false, status: 404 }));

      await expect(iamApi.addUserToGroup('missing-group', assignment, 'service')).rejects.toThrow(
        /Add user to group failed with upstream status/,
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          operation: 'Add user to group',
          tokenType: 'service',
          method: 'POST',
          url: '/iam/test-tenant/groups/missing-group/users',
          groupId: 'missing-group',
          requestHeaders: { 'Content-Type': 'application/json' },
          requestBody: assignment,
          responseStatus: 404,
          responseBody: upstreamBody,
        },
        'EXTERNAL Add user to group response',
      );
      expect(JSON.stringify(mockLogger.error.mock.calls[0]?.[0])).not.toContain('Authorization');
      expect(JSON.stringify(mockLogger.error.mock.calls[0]?.[0])).not.toContain('email');
      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('removeUserFromGroup', () => {
    it('DELETEs the assignment URL with the default service token', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(jsonResponse(undefined, { status: 204 }));

      await iamApi.removeUserFromGroup('group-1', 'cust-1');

      expect(mockApiClient.authenticatedFetch).toHaveBeenCalledTimes(1);
      const [url, options, tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
      expect(url).toBe('/iam/test-tenant/groups/group-1/users/cust-1');
      expect(options.method).toBe('DELETE');
      expect(tokenType).toBe('service');
    });

    it('can be invoked with a session token', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(jsonResponse(undefined, { status: 204 }));

      await iamApi.removeUserFromGroup('group-1', 'cust-1', 'session');

      const [, , tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
      expect(tokenType).toBe('session');
    });
  });

  describe('getUserGroups', () => {
    it('uses the default service token so getCustomer() behavior is unchanged', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(
        jsonResponse([{ id: 'group-1' }], { headers: { 'x-total-count': '1' } }),
      );

      const result = await iamApi.getUserGroups('cust-1');

      expect(result.items).toHaveLength(1);
      expect(mockApiClient.authenticatedFetch).toHaveBeenCalledTimes(1);
      const [url, options, tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
      expect(url).toBe('/iam/test-tenant/users/cust-1/groups?');
      expect(options.method).toBe('GET');
      expect(tokenType).toBe('service');
    });

    it('can be invoked with a session token without changing the default', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(jsonResponse([]));

      await iamApi.getUserGroups('cust-1', {}, 'session');

      const [, , tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
      expect(tokenType).toBe('session');
    });
  });

  describe('getGroupUsers', () => {
    it('uses one group id path, page params only, total-count header, and service token by default', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(
        jsonResponse([{ id: 'a-1', groupId: 'group-1', userId: 'cust-1', userType: 'CUSTOMER' }], {
          headers: { 'x-total-count': '1' },
        }),
      );

      const result = await iamApi.getGroupUsers('group-1', { page: 2, size: 25, query: 'must-not-be-used' });

      expect(mockApiClient.authenticatedFetch).toHaveBeenCalledTimes(1);
      const [url, options, tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
      const parsedUrl = new URL(url, 'https://api.emporix.io');
      expect(parsedUrl.pathname).toBe('/iam/test-tenant/groups/group-1/users');
      expect(parsedUrl.searchParams.get('pageNumber')).toBe('2');
      expect(parsedUrl.searchParams.get('pageSize')).toBe('25');
      expect(parsedUrl.searchParams.has('q')).toBe(false);
      expect(options).toEqual({ method: 'GET', headers: { 'X-Total-Count': 'true' } });
      expect(tokenType).toBe('service');
      expect(result.items).toEqual([{ id: 'a-1', groupId: 'group-1', userId: 'cust-1', userType: 'CUSTOMER' }]);
      expect(result.total).toBe(1);
    });

    it('can be invoked with a session token', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(jsonResponse([]));

      await iamApi.getGroupUsers('group-1', { page: 1, size: 60 }, 'session');

      const [, , tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
      expect(tokenType).toBe('session');
    });
  });
});
