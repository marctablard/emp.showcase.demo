import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { EmporixApiError } from '../../common/EmporixApiError';
import type EmporixApiInvoker from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import type { EmporixCustomerAdmin, EmporixCustomerAdminCreateRequest } from '../../model/customer';
import EmporixCustomerAdminApi from './EmporixCustomerAdminApi';

describe('EmporixCustomerAdminApi', () => {
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
  let customerAdminApi: EmporixCustomerAdminApi;

  const jsonResponse = (
    body: unknown,
    init?: { status?: number; ok?: boolean; headers?: Record<string, string> },
  ): Response => {
    const response = {
      ok: init?.ok ?? true,
      status: init?.status ?? 200,
      statusText: 'OK',
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
    customerAdminApi = new EmporixCustomerAdminApi(
      mockApiClient as unknown as EmporixApiInvoker,
      mockConfig,
      mockLogger,
    );
  });

  describe('createCustomer', () => {
    it('POSTs profile fields without b2b/password or an LE header and uses the service token', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(jsonResponse({ id: 'resource-id' }, { status: 201 }));

      const created = await customerAdminApi.createCustomer(
        {
          firstName: 'Ada',
          lastName: 'Lovelace',
          contactEmail: 'ada@example.com',
          preferredSite: 'main',
          preferredLanguage: 'en_US',
          preferredCurrency: 'EUR',
        },
        'le-selected',
      );

      expect(created).toEqual({ id: 'resource-id' });
      expect(mockApiClient.authenticatedFetch).toHaveBeenCalledTimes(1);
      const [url, options, tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
      expect(url).toBe('customer/test-tenant/customers?sendPasswordResetNotifications=true');
      expect(options!.method).toBe('POST');
      expect(tokenType).toBe('service');
      expect(options!.headers).toEqual({
        'Content-Type': 'application/json',
        Accept: 'application/json',
      });
      expect(options!.headers).not.toHaveProperty('legalEntityId');
      const body = JSON.parse(String(options!.body)) as Record<string, unknown>;
      expect(body).toEqual({
        firstName: 'Ada',
        lastName: 'Lovelace',
        contactEmail: 'ada@example.com',
        preferredSite: 'main',
        preferredLanguage: 'en_US',
        preferredCurrency: 'EUR',
      });
      expect(body).not.toHaveProperty('password');
      expect(body).not.toHaveProperty('b2b');
    });

    it('strips password and b2b even if a caller supplies them', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(jsonResponse({ id: 'resource-id' }, { status: 201 }));

      await customerAdminApi.createCustomer(
        {
          firstName: 'Ada',
          lastName: 'Lovelace',
          contactEmail: 'ada@example.com',
          password: 'should-not-be-sent',
          b2b: { legalEntities: [{ id: 'le-selected' }] },
        } as EmporixCustomerAdminCreateRequest & { password: string; b2b: unknown },
        'le-selected',
      );

      const [, options] = mockApiClient.authenticatedFetch.mock.calls[0];
      const body = JSON.parse(String(options!.body)) as Record<string, unknown>;
      expect(body).not.toHaveProperty('password');
      expect(body).not.toHaveProperty('b2b');
    });

    it('throws an EmporixApiError containing the upstream 400 body', async () => {
      const upstreamBody = {
        type: 'ValidationError',
        message: 'The request body is invalid',
        details: [{ field: 'preferredLanguage', message: 'unsupported language' }],
      };
      mockApiClient.authenticatedFetch.mockResolvedValue(jsonResponse(upstreamBody, { ok: false, status: 400 }));

      const result = customerAdminApi.createCustomer(
        {
          firstName: 'Ada',
          lastName: 'Lovelace',
          contactEmail: 'ada@example.com',
          preferredLanguage: 'en',
        },
        'le-selected',
      );

      await expect(result).rejects.toBeInstanceOf(EmporixApiError);
      await expect(result).rejects.toThrow(JSON.stringify(upstreamBody));
      const [, options] = mockApiClient.authenticatedFetch.mock.calls[0];
      const sentBody = JSON.parse(String(options!.body)) as Record<string, unknown>;
      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          operation: 'Create customer',
          tokenType: 'service',
          method: 'POST',
          url: 'customer/test-tenant/customers?sendPasswordResetNotifications=true',
          requestHeaders: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          requestBody: sentBody,
          selectedLegalEntityId: 'le-selected',
          responseStatus: 400,
          responseStatusText: 'OK',
          responseBody: upstreamBody,
        },
        'EXTERNAL Create customer response',
      );
      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('getCustomers', () => {
    it('forwards q, sort, pageNumber, pageSize and uses session token', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(
        jsonResponse([{ id: '1', customerNumber: 'C-1', contactEmail: 'a@example.com' }]),
      );

      await customerAdminApi.getCustomers(2, 5, 'firstName:asc', 'id:(1,2)');

      expect(mockApiClient.authenticatedFetch).toHaveBeenCalledTimes(1);
      const [url, options, tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
      expect(url).toBe(
        'customer/test-tenant/customers?pageNumber=2&pageSize=5&sort=firstName%3Aasc&q=id%3A%281%2C2%29',
      );
      expect(options!.method).toBe('GET');
      expect(tokenType).toBe('session');
    });

    it('allows a caller-constrained service-token list', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(jsonResponse([{ id: 'customer-2', customerNumber: 'C-2' }]));

      await customerAdminApi.getCustomers(1, 1, undefined, 'id:(customer-2)', 'service');

      const [url, , tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
      expect(url).toContain('q=id%3A%28customer-2%29');
      expect(tokenType).toBe('service');
    });

    it('returns totalCount from Count header and does not use page length as total', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(
        jsonResponse(
          [
            { id: '1', customerNumber: 'C-1' },
            { id: '2', customerNumber: 'C-2' },
          ],
          { headers: { Count: '42' } },
        ),
      );

      const result = await customerAdminApi.getCustomers(1, 2);

      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(42);
    });

    it('returns totalCount from x-total-count when that header is present', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(
        jsonResponse([{ id: '1', customerNumber: 'C-1' }], { headers: { 'x-total-count': '100' } }),
      );

      const result = await customerAdminApi.getCustomers();

      expect(result.totalCount).toBe(100);
    });

    it('omits totalCount when no count header is present instead of using page length', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(
        jsonResponse([
          { id: '1', customerNumber: 'C-1' },
          { id: '2', customerNumber: 'C-2' },
          { id: '3', customerNumber: 'C-3' },
        ]),
      );

      const result = await customerAdminApi.getCustomers(1, 3);

      expect(result.items).toHaveLength(3);
      expect(result.totalCount).toBeUndefined();
    });
  });

  describe('getCustomer, updateCustomer, deleteCustomer', () => {
    const createdId = 'resource-id';
    const customerNumber = 'C-999';
    const fetchedCustomer: EmporixCustomerAdmin = {
      id: createdId,
      customerNumber,
      firstName: 'Ada',
      lastName: 'Lovelace',
      contactEmail: 'ada@example.com',
      active: true,
      metadataCreatedAt: '2026-01-01T00:00:00Z',
    };

    it('uses service GET-after-create and service PATCH when customerNumber differs from create id', async () => {
      mockApiClient.authenticatedFetch
        .mockResolvedValueOnce(jsonResponse({ id: createdId }, { status: 201 }))
        .mockResolvedValueOnce(jsonResponse(fetchedCustomer))
        .mockResolvedValueOnce(jsonResponse(undefined, { status: 200 }));

      const created = await customerAdminApi.createCustomer(
        {
          firstName: 'Ada',
          lastName: 'Lovelace',
          contactEmail: 'ada@example.com',
        },
        'le-selected',
      );
      expect(created.id).toBe(createdId);
      expect(created.id).not.toBe(customerNumber);

      const fetched = await customerAdminApi.getCustomer(created.id, 'service');
      expect(fetched?.customerNumber).toBe(customerNumber);

      await customerAdminApi.updateCustomer(fetched!.customerNumber, { active: false }, 'service');

      expect(mockApiClient.authenticatedFetch).toHaveBeenCalledTimes(3);
      const [getUrl, getOptions, getTokenType] = mockApiClient.authenticatedFetch.mock.calls[1];
      expect(getUrl).toBe(`customer/test-tenant/customers/${createdId}`);
      expect(getOptions!.method).toBe('GET');
      expect(getTokenType).toBe('service');

      const [patchUrl, patchOptions, patchTokenType] = mockApiClient.authenticatedFetch.mock.calls[2];
      expect(patchUrl).toBe(`customer/test-tenant/customers/${customerNumber}`);
      expect(patchUrl).not.toContain(createdId);
      expect(patchOptions!.method).toBe('PATCH');
      expect(patchTokenType).toBe('service');
      expect(JSON.parse(String(patchOptions!.body))).toEqual({ active: false });
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          operation: 'Update customer',
          tokenType: 'service',
          method: 'PATCH',
          url: `customer/test-tenant/customers/${customerNumber}`,
          requestHeaders: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          requestBody: { active: false },
          responseStatus: 200,
          responseBody: '',
        },
        'EXTERNAL Update customer response',
      );
    });

    it('defaults updateCustomer to the session token', async () => {
      await customerAdminApi.updateCustomer(customerNumber, { firstName: 'Grace' });

      const [, , tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
      expect(tokenType).toBe('session');
    });

    it('logs the upstream 404 body for a failed service PATCH', async () => {
      const upstreamBody = {
        type: null,
        status: 404,
        message: 'Customer profile with ID C-404 not found.',
        details: null,
      };
      mockApiClient.authenticatedFetch.mockResolvedValue(jsonResponse(upstreamBody, { ok: false, status: 404 }));

      await expect(customerAdminApi.updateCustomer('C-404', { active: false }, 'service')).rejects.toThrow(
        JSON.stringify(upstreamBody),
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          operation: 'Update customer',
          tokenType: 'service',
          method: 'PATCH',
          url: 'customer/test-tenant/customers/C-404',
          requestHeaders: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          requestBody: { active: false },
          responseStatus: 404,
          responseBody: upstreamBody,
        },
        'EXTERNAL Update customer response',
      );
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('uses GET-after-create customerNumber for DELETE when it differs from create id', async () => {
      mockApiClient.authenticatedFetch
        .mockResolvedValueOnce(jsonResponse({ id: createdId }, { status: 201 }))
        .mockResolvedValueOnce(jsonResponse(fetchedCustomer))
        .mockResolvedValueOnce(jsonResponse(undefined, { status: 202 }));

      const created = await customerAdminApi.createCustomer(
        {
          firstName: 'Ada',
          lastName: 'Lovelace',
          contactEmail: 'ada@example.com',
        },
        'le-selected',
      );
      const fetched = await customerAdminApi.getCustomer(created.id);
      await customerAdminApi.deleteCustomer(fetched!.customerNumber);

      const [deleteUrl, deleteOptions, deleteTokenType] = mockApiClient.authenticatedFetch.mock.calls[2];
      expect(deleteUrl).toBe(`customer/test-tenant/customers/${customerNumber}`);
      expect(deleteOptions!.method).toBe('DELETE');
      expect(deleteTokenType).toBe('session');
    });

    it('allows deleteCustomer to use a service token', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(jsonResponse(undefined, { status: 202 }));

      await customerAdminApi.deleteCustomer(customerNumber, 'service');

      const [, , tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
      expect(tokenType).toBe('service');
    });

    it('returns null when GET by customerNumber is 404', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(
        jsonResponse({ message: 'not found' }, { ok: false, status: 404 }),
      );

      await expect(customerAdminApi.getCustomer('missing')).resolves.toBeNull();
    });
  });
});
