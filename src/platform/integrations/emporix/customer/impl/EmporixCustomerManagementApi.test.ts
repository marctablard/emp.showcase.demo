import type EmporixApiInvoker from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import type { EmporixContactAssignment } from '../../model';
import EmporixCustomerManagementApi from './EmporixCustomerManagementApi';

describe('EmporixCustomerManagementApi', () => {
  const mockConfig: EmporixConfig = {
    baseUrl: 'https://api.emporix.io',
    tenant: 'test-tenant',
    clientId: 'test-client-id',
    clientSecret: '',
    serverClientId: '',
    serverClientSecret: '',
  };

  let mockApiClient: jest.Mocked<Pick<EmporixApiInvoker, 'authenticatedFetch'>>;
  let customerManagementApi: EmporixCustomerManagementApi;

  const jsonResponse = (
    body: unknown,
    init?: { status?: number; ok?: boolean; headers?: Record<string, string> },
  ): Response =>
    ({
      ok: init?.ok ?? true,
      status: init?.status ?? 200,
      statusText: init?.ok === false ? 'Bad Request' : 'OK',
      json: jest.fn().mockResolvedValue(body),
      text: jest.fn().mockResolvedValue(JSON.stringify(body)),
      headers: new Headers(init?.headers),
    }) as unknown as Response;

  beforeEach(() => {
    mockApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue(jsonResponse({})),
    };
    customerManagementApi = new EmporixCustomerManagementApi(mockApiClient as unknown as EmporixApiInvoker, mockConfig);
  });

  describe('getContactAssignmentsByLegalEntityId', () => {
    it('queries legalEntity.id on customer-management/{tenant}/contact-assignments with service token and paging', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(
        jsonResponse([{ id: 'ca-1', legalEntity: { id: 'le-1' }, customer: { id: 'c-1' }, type: 'PRIMARY' }]),
      );

      await customerManagementApi.getContactAssignmentsByLegalEntityId('le-1', 2, 50);

      expect(mockApiClient.authenticatedFetch).toHaveBeenCalledTimes(1);
      const [url, options, tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
      expect(url).toBe(
        'customer-management/test-tenant/contact-assignments?legalEntity.id=le-1&pageNumber=2&pageSize=50',
      );
      expect(url.startsWith('/test-tenant/contact-assignments')).toBe(false);
      expect(url).not.toContain('customerId=');
      expect(url).not.toContain('type=');
      expect(options?.method).toBe('GET');
      expect(options?.headers).toEqual({ 'X-Total-Count': 'true' });
      expect(tokenType).toBe('service');
    });

    it('returns items and totalCount from X-Total-Count and does not use page length as total', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(
        jsonResponse(
          [
            { id: 'ca-1', legalEntity: { id: 'le-1' }, customer: { id: 'c-1' }, type: 'CONTACT' },
            { id: 'ca-2', legalEntity: { id: 'le-1' }, customer: { id: 'c-2' }, type: 'PRIMARY' },
          ],
          { headers: { 'X-Total-Count': '42' } },
        ),
      );

      const result = await customerManagementApi.getContactAssignmentsByLegalEntityId('le-1');

      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(42);
    });

    it('omits totalCount when no count header is present instead of using page length', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(
        jsonResponse([{ id: 'ca-1', legalEntity: { id: 'le-1' }, customer: { id: 'c-1' }, type: 'BILLING' }]),
      );

      const result = await customerManagementApi.getContactAssignmentsByLegalEntityId('le-1', 1, 1);

      expect(result.items).toHaveLength(1);
      expect(result.totalCount).toBeUndefined();
    });
  });

  describe('createLegalEntityContactAssignment', () => {
    it('POSTs to the documented prefix with the default service client token and type CONTACT', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(jsonResponse({ id: 'ca-new' }, { status: 201 }));

      const created = await customerManagementApi.createLegalEntityContactAssignment({
        legalEntity: { id: 'le-1' },
        customer: { id: 'cust-1' },
      });

      expect(created).toEqual({ id: 'ca-new' });
      expect(mockApiClient.authenticatedFetch).toHaveBeenCalledTimes(1);
      const [url, options, tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
      expect(url).toBe('customer-management/test-tenant/contact-assignments');
      expect(url).not.toBe('/test-tenant/contact-assignments');
      expect(options?.method).toBe('POST');
      expect(tokenType).toBe('service');
      expect(mockApiClient.authenticatedFetch.mock.calls[0]?.[3]).toBeUndefined();
      expect(JSON.parse(String(options?.body))).toEqual({
        legalEntity: { id: 'le-1' },
        customer: { id: 'cust-1' },
        type: 'CONTACT',
      });
    });

    it('sends type CONTACT even when a caller payload includes another type', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(jsonResponse({ id: 'ca-new' }, { status: 201 }));

      await customerManagementApi.createLegalEntityContactAssignment({
        legalEntity: { id: 'le-1' },
        customer: { id: 'cust-1' },
        type: 'PRIMARY',
      } as Pick<EmporixContactAssignment, 'legalEntity' | 'customer'> & { type: 'PRIMARY' });

      const [, options] = mockApiClient.authenticatedFetch.mock.calls[0];
      expect(JSON.parse(String(options?.body)).type).toBe('CONTACT');
    });

    it('throws without retrying as PRIMARY when CONTACT is rejected', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(
        jsonResponse({ message: 'invalid type' }, { ok: false, status: 400 }),
      );

      await expect(
        customerManagementApi.createLegalEntityContactAssignment({
          legalEntity: { id: 'le-1' },
          customer: { id: 'cust-1' },
        }),
      ).rejects.toThrow(
        'Create legal-entity contact assignment failed with upstream status 400 Bad Request: {"message":"invalid type"}',
      );

      expect(mockApiClient.authenticatedFetch).toHaveBeenCalledTimes(1);
      const [, options] = mockApiClient.authenticatedFetch.mock.calls[0];
      expect(JSON.parse(String(options?.body)).type).toBe('CONTACT');
    });
  });

  describe('getLocationById', () => {
    it('returns null when the location does not exist', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue(jsonResponse({}, { ok: false, status: 404 }));

      await expect(customerManagementApi.getLocationById('missing-location')).resolves.toBeNull();
    });
  });
});
