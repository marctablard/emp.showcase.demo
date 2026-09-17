import { EmporixApiError } from '@/platform/integrations/emporix/common/EmporixApiError';
import type { EmporixCustomerAdminApi } from '@/platform/integrations/emporix/customer/EmporixCustomerAdminApi';
import type { EmporixCustomerManagementApi } from '@/platform/integrations/emporix/customer/EmporixCustomerManagementApi';
import type { EmporixIamApi } from '@/platform/integrations/emporix/iam/EmporixIamApi';
import type { EmporixContactAssignment, EmporixCustomerAdmin } from '@/platform/integrations/emporix/model/customer';
import type { EmporixGroup } from '@/platform/integrations/emporix/model/iam';
import type { CompanyService } from '@/platform/services/company/CompanyService';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Customer } from '@/platform/services/model/customer/customer';
import { CustomerRole } from '@/platform/services/model/customer/roles';
import { CONTACT_ONLY_GROUP_ID } from '@/platform/services/model/user-management/contact-only';
import EmporixCompanyUserMapper from '@/platform/services/model/user-management/impl/EmporixCompanyUserMapper';
import type { SessionService } from '@/platform/services/session';
import { AdminRequiredError, PredefinedGroupConflictError } from '../errors';
import EmporixUserManagementService from './EmporixUserManagementService';

const SELECTED_LE = 'le-selected';
const ASSIGNMENT_PAGE_SIZE = 60;

describe('EmporixUserManagementService list/get', () => {
  let customerAdminApi: jest.Mocked<Pick<EmporixCustomerAdminApi, 'getCustomers' | 'getCustomer'>>;
  let customerManagementApi: jest.Mocked<Pick<EmporixCustomerManagementApi, 'getContactAssignmentsByLegalEntityId'>>;
  let iamApi: jest.Mocked<Pick<EmporixIamApi, 'getUsers' | 'getGroupUsers' | 'getGroups' | 'getUserGroups'>>;
  let companyService: jest.Mocked<Pick<CompanyService, 'getCompanies' | 'getCompany'>>;
  let customerService: jest.Mocked<Pick<CustomerService, 'getCustomer'>>;
  let sessionService: jest.Mocked<
    Pick<SessionService, 'getCurrent' | 'setLegalEntity' | 'getCustomerTokenLegalEntityId'>
  >;
  let logger: jest.Mocked<Pick<LoggerService, 'info' | 'warn' | 'error'>>;
  let service: EmporixUserManagementService;

  const adminCustomer: Customer = {
    id: 'admin-1',
    email: 'admin@example.com',
    firstName: 'Pat',
    lastName: 'Admin',
    legalEntityId: SELECTED_LE,
    roles: [CustomerRole.B2B, CustomerRole.B2B_ADMIN],
  };

  beforeEach(() => {
    customerAdminApi = {
      getCustomers: jest.fn().mockResolvedValue({ items: [] }),
      getCustomer: jest.fn().mockResolvedValue(null),
    };
    customerManagementApi = {
      getContactAssignmentsByLegalEntityId: jest.fn().mockResolvedValue({ items: [], totalCount: 0 }),
    };
    iamApi = {
      getUsers: jest.fn().mockResolvedValue({ items: [], totalCount: 0 }),
      getGroupUsers: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, size: 60 }),
      getGroups: jest.fn().mockResolvedValue([
        {
          id: 'g-selected',
          code: 'B2B_ADMIN',
          userType: 'CUSTOMER',
          b2b: { role: 'Admin', legalEntityId: SELECTED_LE },
        },
      ]),
      getUserGroups: jest.fn().mockImplementation(async (userId: string) => {
        if (userId === adminCustomer.id) {
          return {
            items: [{ id: 'g-admin-selected', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } }],
            total: 1,
            page: 1,
            size: 60,
          };
        }
        return { items: [], total: 0, page: 1, size: 60 };
      }),
    };
    companyService = {
      getCompanies: jest.fn().mockResolvedValue([{ id: SELECTED_LE, name: 'Acme' }]),
      getCompany: jest.fn().mockResolvedValue({ id: SELECTED_LE, name: 'Acme' }),
    };
    customerService = {
      getCustomer: jest.fn().mockResolvedValue(adminCustomer),
    };
    sessionService = {
      getCurrent: jest.fn().mockResolvedValue({ legalEntityId: SELECTED_LE }),
      setLegalEntity: jest.fn().mockResolvedValue({
        tokenRefreshSucceeded: true,
        tokenLooksLikeJwt: false,
      }),
      getCustomerTokenLegalEntityId: jest.fn().mockResolvedValue(SELECTED_LE),
    };
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    service = new EmporixUserManagementService(
      customerAdminApi as unknown as EmporixCustomerAdminApi,
      customerManagementApi as unknown as EmporixCustomerManagementApi,
      iamApi as unknown as EmporixIamApi,
      new EmporixCompanyUserMapper(),
      companyService as unknown as CompanyService,
      customerService as unknown as CustomerService,
      sessionService as unknown as SessionService,
      logger as unknown as LoggerService,
    );
  });

  it('throws AdminRequiredError when the current customer lacks B2B_ADMIN', async () => {
    customerService.getCustomer.mockResolvedValue({
      ...adminCustomer,
      roles: [CustomerRole.B2B, CustomerRole.B2B_BUYER],
    });

    await expect(service.listUsers()).rejects.toBeInstanceOf(AdminRequiredError);
    expect(iamApi.getGroupUsers).not.toHaveBeenCalled();
    expect(sessionService.setLegalEntity).not.toHaveBeenCalled();
  });

  it('throws AdminRequiredError on listUsers when the selected legal entity is not an Admin LE', async () => {
    iamApi.getUserGroups.mockResolvedValue({
      items: [{ id: 'g-other-admin', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: 'le-other' } }],
      total: 1,
      page: 1,
      size: 60,
    });

    await expect(service.listUsers()).rejects.toBeInstanceOf(AdminRequiredError);
    expect(customerManagementApi.getContactAssignmentsByLegalEntityId).not.toHaveBeenCalled();
    expect(sessionService.setLegalEntity).not.toHaveBeenCalled();
  });

  it('lists combined Admin-LE users without reminting when the selected legal entity is not an Admin LE', async () => {
    const otherMember = adminDto({ id: 'other-1', customerNumber: 'N-O1', firstName: 'Ola', lastName: 'One' });
    companyService.getCompanies.mockResolvedValue([
      { id: SELECTED_LE, name: 'Acme' },
      { id: 'le-other', name: 'Other Co' },
    ]);
    iamApi.getUserGroups.mockResolvedValue({
      items: [{ id: 'g-other-admin', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: 'le-other' } }],
      total: 1,
      page: 1,
      size: 60,
    });
    customerManagementApi.getContactAssignmentsByLegalEntityId.mockImplementation(async (legalEntityId) => ({
      items:
        legalEntityId === 'le-other'
          ? [assignment(otherMember.id, 'CONTACT', [{ id: 'g-other-admin', role: 'Admin' }], 'le-other')]
          : [],
      totalCount: legalEntityId === 'le-other' ? 1 : 0,
    }));
    mockHydrateByIdQuery([otherMember]);
    iamApi.getGroupUsers.mockResolvedValue({
      items: [{ id: 'asg-o1', groupId: 'g-other-admin', userId: otherMember.id, userType: 'CUSTOMER' }],
      total: 1,
      page: 1,
      size: 60,
    });

    const result = await service.listOtherCompanyUsers(1, 10);

    expect(sessionService.setLegalEntity).not.toHaveBeenCalled();
    expect(result.items.map((user) => ({ id: user.id, legalEntityId: user.legalEntityId }))).toEqual([
      { id: 'N-O1', legalEntityId: 'le-other' },
    ]);
  });

  it('getUser reads an other Admin-LE customer without reminting when the selected legal entity is not an Admin LE', async () => {
    const otherMember = adminDto({ id: 'other-1', customerNumber: 'N-O1', firstName: 'Ola', lastName: 'One' });
    companyService.getCompanies.mockResolvedValue([
      { id: SELECTED_LE, name: 'Acme' },
      { id: 'le-other', name: 'Other Co' },
    ]);
    iamApi.getUserGroups.mockResolvedValue({
      items: [{ id: 'g-other-admin', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: 'le-other' } }],
      total: 1,
      page: 1,
      size: 60,
    });
    customerManagementApi.getContactAssignmentsByLegalEntityId.mockImplementation(async (legalEntityId) => ({
      items:
        legalEntityId === 'le-other'
          ? [assignment(otherMember.id, 'CONTACT', [{ id: 'g-other-admin', role: 'Admin' }], 'le-other')]
          : [],
      totalCount: legalEntityId === 'le-other' ? 1 : 0,
    }));
    mockHydrateByIdQuery([otherMember]);
    iamApi.getGroupUsers.mockResolvedValue({
      items: [{ id: 'asg-o1', groupId: 'g-other-admin', userId: otherMember.id, userType: 'CUSTOMER' }],
      total: 1,
      page: 1,
      size: 60,
    });

    const user = await service.getUser('N-O1');

    expect(sessionService.setLegalEntity).not.toHaveBeenCalled();
    expect(user?.id).toBe('N-O1');
    expect(user?.isSelectedLegalEntityMember).toBe(false);
  });

  it('falls back to service hydrate when the session customer query is Forbidden', async () => {
    const member = adminDto({ id: 'cust-a', customerNumber: 'N-A', firstName: 'Ann', lastName: 'Alpha' });
    mockAssignments([assignment(member.id, 'CONTACT')]);
    customerAdminApi.getCustomers.mockImplementation(async (_page, _size, _sort, _query, tokenType) => {
      if (tokenType === 'session') {
        throw new Error('Forbidden');
      }
      return { items: [member] };
    });

    const result = await service.listUsers(1, 10);

    expect(result.items.map((user) => user.id)).toEqual(['N-A']);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Forbidden' }),
      'Session customer hydrate failed; falling back to service',
    );
  });

  it('listAdminLegalEntityIds returns Admin LEs and omits Contact and CUSTOMER', async () => {
    iamApi.getUserGroups.mockResolvedValue({
      items: [
        { id: 'g-selected-admin', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } },
        { id: 'g-other-admin', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: 'le-other' } },
        { id: 'g-contact', code: 'CONTACT', b2b: { role: 'Contact', legalEntityId: 'le-contact' } },
        { id: 'g-customer', code: 'CUSTOMER', b2b: { role: 'Admin', legalEntityId: 'le-customer' } },
      ],
      total: 4,
      page: 1,
      size: 60,
    });

    await expect(service.listAdminLegalEntityIds()).resolves.toEqual(['le-other', SELECTED_LE]);
  });

  it('throws when the selected legal entity cannot be resolved', async () => {
    sessionService.getCurrent.mockResolvedValue({ id: 'session-1', currency: 'EUR', siteCode: 'main' });
    sessionService.getCustomerTokenLegalEntityId.mockResolvedValue(undefined);
    customerService.getCustomer.mockResolvedValue({ ...adminCustomer, legalEntityId: undefined });

    await expect(service.listUsers()).rejects.toThrow('Selected legal entity membership could not be established');
    expect(sessionService.setLegalEntity).not.toHaveBeenCalled();
  });

  it.each([
    ['missing session context', undefined],
    ['session without legalEntityId', { id: 'session-1', currency: 'EUR', siteCode: 'main' }],
  ])('recovers listUsers via token legal entity when session is %s', async (_case, currentSession) => {
    sessionService.getCurrent.mockResolvedValue(currentSession);
    const member = adminDto({ id: 'cust-a', customerNumber: 'N-A', firstName: 'Ann', lastName: 'Alpha' });
    mockAssignments([assignment('cust-a', 'CONTACT')]);
    mockHydrateByIdQuery([member]);

    const result = await service.listUsers(1, 10);

    expect(sessionService.setLegalEntity).toHaveBeenCalledWith(SELECTED_LE);
    expect(result.items.map((user) => user.id)).toEqual(['N-A']);
  });

  it('recovers listUsers via customer legalEntityId when session and token LE are missing', async () => {
    sessionService.getCurrent.mockResolvedValue(undefined);
    sessionService.getCustomerTokenLegalEntityId.mockResolvedValueOnce(undefined).mockResolvedValue(SELECTED_LE);
    const member = adminDto({ id: 'cust-a', customerNumber: 'N-A', firstName: 'Ann', lastName: 'Alpha' });
    mockAssignments([assignment('cust-a', 'CONTACT')]);
    mockHydrateByIdQuery([member]);

    const result = await service.listUsers(1, 10);

    expect(sessionService.setLegalEntity).toHaveBeenCalledWith(SELECTED_LE);
    expect(result.items.map((user) => user.id)).toEqual(['N-A']);
  });

  it.each([
    ['missing', undefined],
    ['mismatched', 'le-other'],
  ])(
    'remints the customer token once when it is %s then lists after that remint',
    async (_case, tokenLegalEntityId) => {
      const member = adminDto({ id: 'cust-a', customerNumber: 'N-A', firstName: 'Ann', lastName: 'Alpha' });
      sessionService.getCustomerTokenLegalEntityId
        .mockResolvedValueOnce(tokenLegalEntityId)
        .mockResolvedValue(SELECTED_LE);
      mockAssignments([assignment('cust-a', 'CONTACT')]);
      mockHydrateByIdQuery([member]);

      const result = await service.listUsers(1, 10);

      expect(sessionService.setLegalEntity).toHaveBeenCalledTimes(1);
      expect(sessionService.setLegalEntity).toHaveBeenCalledWith(SELECTED_LE);
      expect(sessionService.setLegalEntity.mock.invocationCallOrder[0]).toBeLessThan(
        customerManagementApi.getContactAssignmentsByLegalEntityId.mock.invocationCallOrder[0]!,
      );
      expect(sessionService.setLegalEntity.mock.invocationCallOrder[0]).toBeLessThan(
        customerAdminApi.getCustomers.mock.invocationCallOrder[0]!,
      );
      expect(result.items.map((user) => user.id)).toEqual(['N-A']);
      expect(logger.info).toHaveBeenCalledWith(
        {
          sessionLegalEntityId: SELECTED_LE,
          selectedLegalEntityId: SELECTED_LE,
          tokenLegalEntityId: SELECTED_LE,
          tokenRefreshSucceeded: true,
          tokenLooksLikeJwt: false,
        },
        'Customer token scoped to selected legal entity',
      );
      expect(JSON.stringify(logger.info.mock.calls)).not.toMatch(/access_token|refresh_token|Bearer /i);
      expect(JSON.stringify(logger.error.mock.calls)).not.toMatch(/access_token|refresh_token|Bearer /i);
    },
  );

  it('does not remint listUsers when the customer token already matches the selected legal entity', async () => {
    const member = adminDto({ id: 'cust-a', customerNumber: 'N-A', firstName: 'Ann', lastName: 'Alpha' });
    mockAssignments([assignment('cust-a', 'CONTACT')]);
    mockHydrateByIdQuery([member]);

    await service.listUsers(1, 10);

    expect(sessionService.setLegalEntity).not.toHaveBeenCalled();
    expect(customerManagementApi.getContactAssignmentsByLegalEntityId).toHaveBeenCalled();
  });

  it('throws when read-path remint fails before membership work', async () => {
    sessionService.getCustomerTokenLegalEntityId.mockResolvedValue(undefined);
    sessionService.setLegalEntity.mockRejectedValue(
      new Error('Failed to scope customer token to the selected legal entity'),
    );

    await expect(service.listUsers()).rejects.toThrow('Failed to scope customer token to the selected legal entity');
    expect(customerManagementApi.getContactAssignmentsByLegalEntityId).not.toHaveBeenCalled();
    expect(customerAdminApi.getCustomers).not.toHaveBeenCalled();
  });

  it('aborts listUsers when the reminted customer token legal entity is still missing', async () => {
    sessionService.getCustomerTokenLegalEntityId.mockResolvedValue(undefined);

    await expect(service.listUsers()).rejects.toThrow('Customer token is not scoped to the selected legal entity');
    expect(sessionService.setLegalEntity).toHaveBeenCalledTimes(1);
    expect(customerManagementApi.getContactAssignmentsByLegalEntityId).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      {
        sessionLegalEntityId: SELECTED_LE,
        selectedLegalEntityId: SELECTED_LE,
        tokenLegalEntityId: null,
        tokenRefreshSucceeded: true,
        tokenLooksLikeJwt: false,
      },
      'Customer token is not scoped to the selected legal entity',
    );
  });

  it('falls back to service hydrate without reminting when session hydrate is Unauthorized', async () => {
    const member = adminDto({ id: 'cust-a', customerNumber: 'N-A', firstName: 'Ann', lastName: 'Alpha' });
    mockAssignments([assignment('cust-a', 'CONTACT')]);
    mockHydrateByIdQuery([member]);
    customerAdminApi.getCustomers.mockRejectedValueOnce(new Error('Failed to list customers: Unauthorized'));

    const result = await service.listUsers(1, 10);

    expect(sessionService.setLegalEntity).not.toHaveBeenCalled();
    expect(customerAdminApi.getCustomers).toHaveBeenCalledTimes(2);
    expect(result.items.map((user) => user.id)).toEqual(['N-A']);
  });

  it('does not remint AdminRequiredError thrown from membership work', async () => {
    customerManagementApi.getContactAssignmentsByLegalEntityId.mockRejectedValue(new AdminRequiredError());

    await expect(service.listUsers()).rejects.toBeInstanceOf(AdminRequiredError);
    expect(sessionService.setLegalEntity).not.toHaveBeenCalled();
    expect(customerManagementApi.getContactAssignmentsByLegalEntityId).toHaveBeenCalledTimes(1);
  });

  it('maps a service-token assignment 403 to failure after at most one unused remint', async () => {
    customerManagementApi.getContactAssignmentsByLegalEntityId.mockRejectedValue(
      new Error(`Failed to retrieve contact assignments for legal entity ${SELECTED_LE}: Forbidden`),
    );

    await expect(service.listUsers()).rejects.toThrow('Forbidden');
    expect(sessionService.setLegalEntity).toHaveBeenCalledTimes(1);
    expect(customerManagementApi.getContactAssignmentsByLegalEntityId).toHaveBeenCalledTimes(2);
  });

  it('does not remint again when ensure already reminted this call', async () => {
    sessionService.getCustomerTokenLegalEntityId.mockResolvedValueOnce(undefined).mockResolvedValue(SELECTED_LE);
    customerManagementApi.getContactAssignmentsByLegalEntityId.mockRejectedValue(
      new Error(`Failed to retrieve contact assignments for legal entity ${SELECTED_LE}: Forbidden`),
    );

    await expect(service.listUsers()).rejects.toThrow('Forbidden');
    expect(sessionService.setLegalEntity).toHaveBeenCalledTimes(1);
    expect(customerManagementApi.getContactAssignmentsByLegalEntityId).toHaveBeenCalledTimes(1);
  });

  it('does not remint unrelated membership errors', async () => {
    customerManagementApi.getContactAssignmentsByLegalEntityId.mockRejectedValue(
      new Error(`Failed to retrieve contact assignments for legal entity ${SELECTED_LE}: Internal Server Error`),
    );

    await expect(service.listUsers()).rejects.toThrow('Internal Server Error');
    expect(sessionService.setLegalEntity).not.toHaveBeenCalled();
    expect(customerManagementApi.getContactAssignmentsByLegalEntityId).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['listOtherCompanyUsers', async () => service.listOtherCompanyUsers()],
    ['getUser', async () => service.getUser('cust-a')],
    ['listAssignableGroups', async () => service.listAssignableGroups()],
  ])('%s uses the same ensure remint when the customer token legal entity is missing', async (_name, run) => {
    sessionService.getCustomerTokenLegalEntityId.mockResolvedValueOnce(undefined).mockResolvedValue(SELECTED_LE);

    await run();

    expect(sessionService.setLegalEntity).toHaveBeenCalledTimes(1);
    expect(sessionService.setLegalEntity).toHaveBeenCalledWith(SELECTED_LE);
  });

  it('includes selected-LE assignment members and joins groups via getGroupUsers', async () => {
    const primary = adminDto({ id: 'cust-primary', customerNumber: 'N-P', firstName: 'Pri', lastName: 'Mary' });
    const contact = adminDto({ id: 'cust-contact', customerNumber: 'N-C', firstName: 'Con', lastName: 'Tact' });
    mockAssignments([assignment('cust-primary', 'PRIMARY'), assignment('cust-contact', 'CONTACT')]);
    mockHydrateByIdQuery([primary, contact]);

    const result = await service.listUsers(1, 10);

    expect(iamApi.getUsers).not.toHaveBeenCalled();
    expect(customerManagementApi.getContactAssignmentsByLegalEntityId).toHaveBeenCalled();
    expect(iamApi.getUserGroups).toHaveBeenCalledWith(adminCustomer.id, { size: 60 }, 'service');
    expect(iamApi.getUserGroups.mock.calls.every(([userId]) => userId === adminCustomer.id)).toBe(true);
    expect(iamApi.getGroups).toHaveBeenCalledWith(
      { query: `b2b.legalEntityId:"${SELECTED_LE}"`, criteria: { userType: 'CUSTOMER' } },
      'service',
    );
    expect(result.items.map((user) => user.id).sort()).toEqual(['N-C', 'N-P']);
    expect(result.totalCount).toBe(2);
    for (const item of result.items) {
      expect(item).not.toHaveProperty('legalEntityId');
      expect(item).not.toHaveProperty('legalEntityName');
    }
  });

  it('excludes CUSTOMER users that overlap only another permitted legal entity', async () => {
    const member = adminDto({ id: 'cust-a', customerNumber: 'N-A', firstName: 'Ann', lastName: 'Alpha' });
    const extra = adminDto({ id: 'cust-extra', customerNumber: 'N-X', firstName: 'Eve', lastName: 'Extra' });
    companyService.getCompanies.mockResolvedValue([
      { id: SELECTED_LE, name: 'Acme' },
      { id: 'le-other', name: 'Other Co' },
    ]);
    iamApi.getGroups.mockImplementation(async (params) =>
      params?.query?.includes('le-other')
        ? [{ id: 'g-other', code: 'B2B_BUYER', userType: 'CUSTOMER', b2b: { legalEntityId: 'le-other' } }]
        : [{ id: 'g-selected', code: 'B2B_ADMIN', userType: 'CUSTOMER', b2b: { legalEntityId: SELECTED_LE } }],
    );
    mockAssignments([assignment('cust-a', 'CONTACT')]);
    iamApi.getUsers.mockResolvedValue({
      items: [
        { id: member.id, userType: 'CUSTOMER', groups: [{ id: 'g-selected' }] },
        { id: extra.id, userType: 'CUSTOMER', groups: [{ id: 'g-other' }] },
      ],
      totalCount: 2,
    });
    mockHydrateByIdQuery([member, extra]);

    const result = await service.listUsers(1, 10);

    expect(result.items.map((user) => user.id)).toEqual(['N-A']);
    expect(result.items.map((user) => user.id)).not.toContain('N-X');
    expect(customerAdminApi.getCustomers).toHaveBeenCalledWith(1, 1, undefined, 'id:(cust-a)', 'session');
  });

  it('keeps selected-LE assignment-only members and leaves User Group blank', async () => {
    const member = adminDto({ id: 'cust-a', customerNumber: 'N-A', firstName: 'Ann', lastName: 'Alpha' });
    const extra = adminDto({ id: 'cust-extra', customerNumber: 'N-X', firstName: 'Eve', lastName: 'Extra' });
    mockAssignments([assignment('cust-a', 'CONTACT')]);
    mockHydrateByIdQuery([member]);
    iamApi.getGroupUsers.mockResolvedValue({ items: [], total: 0, page: 1, size: 60 });

    const result = await service.listUsers();

    expect(result.items.map((user) => user.id)).toEqual(['N-A']);
    expect(result.items[0]?.groups).toEqual([]);
    expect(result.totalCount).toBe(1);
    expect(result.items.map((user) => user.id)).not.toContain('N-X');
    expect(customerAdminApi.getCustomers).toHaveBeenCalled();
  });

  it('retries only missing catalog-filtered ids with the Customer Admin service token', async () => {
    const admin = adminDto({ id: 'admin-1', customerNumber: 'N-ADMIN', firstName: 'Pat', lastName: 'Admin' });
    const colleague = adminDto({ id: 'cust-2', customerNumber: 'N-2', firstName: 'Jo', lastName: 'User' });
    mockAssignments([assignment(admin.id, 'PRIMARY'), assignment(colleague.id, 'CONTACT')]);
    iamApi.getUsers.mockResolvedValue({
      items: [
        { id: admin.id, userType: 'CUSTOMER', groupIds: ['g-selected'] },
        { id: colleague.id, userType: 'CUSTOMER', groupIds: ['g-selected'] },
      ],
      totalCount: 2,
    });
    customerAdminApi.getCustomers.mockImplementation(async (_page, _size, _sort, rawQuery, tokenType) => {
      if (tokenType === 'service') {
        expect(rawQuery).toBe('id:(cust-2)');
        return { items: [colleague] };
      }
      return { items: [admin] };
    });

    const result = await service.listUsers(1, 10);

    expect(result.items.map((user) => user.id)).toEqual(['N-ADMIN', 'N-2']);
    expect(customerAdminApi.getCustomers).toHaveBeenNthCalledWith(1, 1, 2, undefined, 'id:(admin-1,cust-2)', 'session');
    expect(customerAdminApi.getCustomers).toHaveBeenNthCalledWith(2, 1, 1, undefined, 'id:(cust-2)', 'service');
  });

  it('pages assignment members before applying in-service sort and paging', async () => {
    const total = ASSIGNMENT_PAGE_SIZE + 1;
    const members = Array.from({ length: total }, (_, index) => {
      const isAaron = index === total - 1;
      return adminDto({
        id: `cust-${index}`,
        customerNumber: `N-${index}`,
        firstName: isAaron ? 'Aaron' : `User${String(index).padStart(3, '0')}`,
        lastName: 'Smith',
      });
    });
    mockAssignments(members.map((member) => assignment(member.id, 'CONTACT')));
    mockHydrateByIdQuery(members);

    const result = await service.listUsers(1, 5, 'firstName:asc');

    expect(customerManagementApi.getContactAssignmentsByLegalEntityId).toHaveBeenNthCalledWith(
      2,
      SELECTED_LE,
      2,
      ASSIGNMENT_PAGE_SIZE,
    );
    expect(result.totalCount).toBe(total);
    expect(result.items[0]?.id).toBe(`N-${total - 1}`);
    expect(result.items[0]?.firstName).toBe('Aaron');
    expect(iamApi.getUserGroups).toHaveBeenCalledWith(adminCustomer.id, { size: 60 }, 'service');
    expect(iamApi.getUserGroups.mock.calls.every(([userId]) => userId === adminCustomer.id)).toBe(true);
  });

  it('does not use tenant IAM getUsers for list membership', async () => {
    const member = adminDto({ id: 'cust-selected', customerNumber: 'N-S', firstName: 'Sel', lastName: 'Ected' });
    mockAssignments([assignment(member.id, 'CONTACT')]);
    mockHydrateByIdQuery([member]);

    const result = await service.listUsers();

    expect(result.items.map((user) => user.id)).toEqual(['N-S']);
    expect(result.totalCount).toBe(1);
    expect(customerAdminApi.getCustomers).toHaveBeenCalledWith(1, 1, undefined, 'id:(cust-selected)', 'session');
    expect(iamApi.getUsers).not.toHaveBeenCalled();
  });

  it('does not enumerate tenant IAM users when listing a small selected-LE assignment set', async () => {
    const selectedMember = adminDto({
      id: 'cust-le',
      customerNumber: 'N-LE',
      firstName: 'Sel',
      lastName: 'Ected',
    });
    mockAssignments([assignment(selectedMember.id, 'CONTACT')]);
    mockHydrateByIdQuery([selectedMember]);

    const result = await service.listUsers(1, 10);

    expect(result.items.map((user) => user.id)).toEqual(['N-LE']);
    expect(result.totalCount).toBe(1);
    expect(iamApi.getUsers).not.toHaveBeenCalled();
    expect(iamApi.getUserGroups).toHaveBeenCalledWith(adminCustomer.id, { size: 60 }, 'service');
    expect(iamApi.getUserGroups.mock.calls.every(([userId]) => userId === adminCustomer.id)).toBe(true);
    expect(iamApi.getGroupUsers).toHaveBeenCalledWith('g-selected', { page: 1, size: 60 }, 'service');
    expect(customerAdminApi.getCustomers).toHaveBeenCalledWith(1, 1, undefined, 'id:(cust-le)', 'session');
  });

  it('omits IAM-only users without selected-LE assignment (Bambi-style)', async () => {
    const member = adminDto({ id: 'cust-bambi', customerNumber: '89827825', firstName: 'Bambi', lastName: 'User' });
    mockHydrateByIdQuery([member]);

    const listed = await service.listUsers(1, 10);
    const user = await service.getUser(member.customerNumber);

    expect(listed.items).toEqual([]);
    expect(user).toBeUndefined();
    expect(customerManagementApi.getContactAssignmentsByLegalEntityId).toHaveBeenCalled();
  });

  it('throws before Customer Admin hydration when selected-LE assignment members exceed 500', async () => {
    const selectedLeTotal = 501;
    const members = Array.from({ length: selectedLeTotal }, (_, index) => assignment(`cust-${index}`, 'CONTACT'));
    mockAssignments(members);

    await expect(service.listUsers()).rejects.toThrow(
      'Selected legal entity user volume exceeds showcase in-memory limit',
    );
    expect(customerAdminApi.getCustomers).not.toHaveBeenCalled();
    expect(customerManagementApi.getContactAssignmentsByLegalEntityId).toHaveBeenCalled();
  });

  it('tokenizes search so each token matches firstName OR lastName OR contactEmail in the service', async () => {
    const johnSmith = adminDto({
      id: 'cust-js',
      customerNumber: 'N-JS',
      firstName: 'John',
      lastName: 'Smith',
      contactEmail: 'john.smith@acme.com',
    });
    const janeStone = adminDto({
      id: 'cust-jane',
      customerNumber: 'N-JA',
      firstName: 'Jane',
      lastName: 'Stone',
      contactEmail: 'jane.stone@acme.com',
    });
    mockAssignments([assignment('cust-js', 'CONTACT'), assignment('cust-jane', 'CONTACT')]);
    mockHydrateByIdQuery([johnSmith, janeStone]);

    const byName = await service.listUsers(1, 10, undefined, 'John S');
    expect(byName.items.map((user) => user.id)).toEqual(['N-JS']);
    expect(byName.totalCount).toBe(1);

    const byEmail = await service.listUsers(1, 10, undefined, 'jane.stone@');
    expect(byEmail.items.map((user) => user.id)).toEqual(['N-JA']);
    expect(byEmail.totalCount).toBe(1);
    expect(customerAdminApi.getCustomers).toHaveBeenCalledWith(1, 2, undefined, 'id:(cust-js,cust-jane)', 'session');
    expect(iamApi.getUsers).not.toHaveBeenCalled();
    expect(iamApi.getUserGroups).toHaveBeenCalledWith(adminCustomer.id, { size: 60 }, 'service');
    expect(iamApi.getUserGroups.mock.calls.every(([userId]) => userId === adminCustomer.id)).toBe(true);
  });

  it('sorts by the allow-list and ignores userGroup', async () => {
    const zeta = adminDto({
      id: 'cust-z',
      customerNumber: 'N-Z',
      firstName: 'Zed',
      lastName: 'Zulu',
      contactEmail: 'z@example.com',
      active: true,
    });
    const alpha = adminDto({
      id: 'cust-a',
      customerNumber: 'N-A',
      firstName: 'Ann',
      lastName: 'Alpha',
      contactEmail: 'a@example.com',
      active: false,
    });
    mockAssignments([assignment('cust-z', 'CONTACT'), assignment('cust-a', 'PRIMARY')]);
    mockHydrateByIdQuery([zeta, alpha]);

    const byFirst = await service.listUsers(1, 10, 'firstName:asc');
    expect(byFirst.items.map((user) => user.id)).toEqual(['N-A', 'N-Z']);

    const byEmail = await service.listUsers(1, 10, 'contactEmail:desc');
    expect(byEmail.items.map((user) => user.id)).toEqual(['N-Z', 'N-A']);

    const byActive = await service.listUsers(1, 10, 'active:desc');
    expect(byActive.items.map((user) => user.id)).toEqual(['N-Z', 'N-A']);

    const ignored = await service.listUsers(1, 10, 'userGroup:asc');
    expect(ignored.items.map((user) => user.id)).toEqual(['N-Z', 'N-A']);
  });

  it('sets CompanyUser.id to customerNumber rather than assignment customer.id', async () => {
    const member = adminDto({ id: 'cust-uuid', customerNumber: 'C-777', firstName: 'Ida', lastName: 'Differs' });
    mockAssignments([assignment('cust-uuid', 'CONTACT')]);
    mockHydrateByIdQuery([member]);

    const result = await service.listUsers();

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe('C-777');
    expect(result.items[0]?.id).not.toBe('cust-uuid');
    expect(customerAdminApi.getCustomers).toHaveBeenCalledWith(1, 1, undefined, 'id:(cust-uuid)', 'session');
  });

  it('uses expanded IAM groups enriched from selected catalog for list labels', async () => {
    const member = adminDto({ id: 'cust-a', customerNumber: 'N-A', firstName: 'Ann', lastName: 'Alpha' });
    const group = {
      id: 'g-admin',
      code: 'B2B_ADMIN',
      b2b: { role: 'Admin', legalEntityId: SELECTED_LE },
    } satisfies EmporixGroup;
    mockAssignments([assignment(member.id, 'CONTACT', [{ id: group.id, role: 'Admin' }])]);
    mockHydrateByIdQuery([member]);
    iamApi.getGroupUsers.mockResolvedValue({
      items: [{ id: 'asg-1', groupId: group.id, userId: member.id, userType: 'CUSTOMER' }],
      total: 1,
      page: 1,
      size: 60,
    });

    const result = await service.listUsers();

    expect(iamApi.getUsers).not.toHaveBeenCalled();
    expect(iamApi.getUserGroups).toHaveBeenCalledWith(adminCustomer.id, { size: 60 }, 'service');
    expect(iamApi.getUserGroups.mock.calls.every(([userId]) => userId === adminCustomer.id)).toBe(true);
    expect(result.items[0]?.groups).toEqual([
      { id: 'g-admin', legalEntityId: SELECTED_LE, displayName: 'Acme - Admin' },
    ]);
  });

  it('does not hydrate customers when IAM returns no permitted users', async () => {
    mockAssignments([]);

    const result = await service.listUsers();

    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(customerAdminApi.getCustomers).not.toHaveBeenCalled();
    expect(customerAdminApi.getCustomer).not.toHaveBeenCalled();
  });

  it('getUser returns undefined when the customer is not in the selected-LE assignment set', async () => {
    const outsider = adminDto({ id: 'cust-other', customerNumber: 'N-O', firstName: 'Oth', lastName: 'Er' });
    mockAssignments([assignment('cust-a', 'CONTACT')]);
    customerAdminApi.getCustomer.mockResolvedValue(outsider);

    await expect(service.getUser('N-O')).resolves.toBeUndefined();
  });

  it('getUser returns undefined when the customer is only in another permitted legal entity', async () => {
    const extra = adminDto({ id: 'cust-extra', customerNumber: 'N-X', firstName: 'Eve', lastName: 'Extra' });
    companyService.getCompanies.mockResolvedValue([
      { id: SELECTED_LE, name: 'Acme' },
      { id: 'le-other', name: 'Other Co' },
    ]);
    iamApi.getGroups.mockImplementation(async (params) =>
      params?.query?.includes('le-other')
        ? [{ id: 'g-other', code: 'B2B_BUYER', userType: 'CUSTOMER', b2b: { legalEntityId: 'le-other' } }]
        : [{ id: 'g-selected', code: 'B2B_ADMIN', userType: 'CUSTOMER', b2b: { legalEntityId: SELECTED_LE } }],
    );
    mockAssignments([]);
    mockHydrateByIdQuery([extra]);

    await expect(service.getUser('N-X')).resolves.toBeUndefined();
  });

  it('getUser returns assignment member even with no list group match', async () => {
    const member = adminDto({ id: 'cust-uuid', customerNumber: 'C-777', firstName: 'Ida', lastName: 'Differs' });
    mockAssignments([assignment('cust-uuid', 'BILLING')]);
    mockHydrateByIdQuery([member]);
    iamApi.getGroupUsers.mockResolvedValue({ items: [], total: 0, page: 1, size: 60 });

    const user = await service.getUser('C-777');
    expect(user?.id).toBe('C-777');
    expect(user?.isSelectedLegalEntityMember).toBe(true);
    expect(iamApi.getUsers).not.toHaveBeenCalled();
    expect(iamApi.getUserGroups).toHaveBeenCalled();
  });

  it('getUser returns other permitted-LE groups that listUsers omits from User Group', async () => {
    const member = adminDto({ id: 'cust-a', customerNumber: 'N-A', firstName: 'Ann', lastName: 'Alpha' });
    const otherLegalEntityId = 'le-other';
    companyService.getCompanies.mockResolvedValue([
      { id: SELECTED_LE, name: 'Acme' },
      { id: otherLegalEntityId, name: 'Other Co' },
    ]);
    iamApi.getGroups.mockImplementation(async (params) =>
      params?.query?.includes(otherLegalEntityId)
        ? [{ id: 'g-other', code: 'B2B_BUYER', userType: 'CUSTOMER', b2b: { legalEntityId: otherLegalEntityId } }]
        : [{ id: 'g-selected', code: 'B2B_ADMIN', userType: 'CUSTOMER', b2b: { legalEntityId: SELECTED_LE } }],
    );
    mockAssignments([assignment(member.id, 'CONTACT')]);
    mockAssignments([assignment(member.id, 'CONTACT')]);
    iamApi.getGroupUsers.mockResolvedValue({
      items: [{ id: 'asg-1', groupId: 'g-selected', userId: member.id, userType: 'CUSTOMER' }],
      total: 1,
      page: 1,
      size: 60,
    });
    iamApi.getUserGroups.mockResolvedValue({
      items: [
        {
          id: 'g-selected',
          code: 'B2B_ADMIN',
          userType: 'CUSTOMER',
          b2b: { role: 'Admin', legalEntityId: SELECTED_LE },
        },
        {
          id: 'g-other',
          code: 'B2B_BUYER',
          userType: 'CUSTOMER',
          b2b: { role: 'Buyer', legalEntityId: otherLegalEntityId },
        },
      ],
      total: 2,
      page: 1,
      size: 60,
    });
    mockHydrateByIdQuery([member]);

    const listed = await service.listUsers(1, 10);
    const user = await service.getUser('N-A');

    expect(listed.items.map((item) => item.id)).toEqual(['N-A']);
    expect(listed.items[0]?.groups.map((group) => group.id)).toEqual(['g-selected']);
    expect(listed.items[0]?.groups.map((group) => group.id)).not.toContain('g-other');
    expect(user?.groups.map((group) => group.id)).toEqual(expect.arrayContaining(['g-selected', 'g-other']));
    expect(user?.groups.find((group) => group.id === 'g-other')).toEqual({
      id: 'g-other',
      legalEntityId: otherLegalEntityId,
      displayName: 'Other Co - Buyer',
    });
    expect(iamApi.getUsers).not.toHaveBeenCalled();
    expect(iamApi.getUserGroups).toHaveBeenCalledWith(adminCustomer.id, { size: 60 }, 'service');
    expect(iamApi.getUserGroups).toHaveBeenCalledWith(member.customerNumber, { size: 60 }, 'service');
  });

  it('listUsers User Group stays source-LE only when the member also has other-LE IAM groups', async () => {
    const member = adminDto({ id: 'cust-a', customerNumber: 'N-A', firstName: 'Ann', lastName: 'Alpha' });
    const otherLegalEntityId = 'le-other';
    companyService.getCompanies.mockResolvedValue([
      { id: SELECTED_LE, name: 'Acme' },
      { id: otherLegalEntityId, name: 'Other Co' },
    ]);
    mockAssignments([assignment(member.id, 'CONTACT', [{ id: 'g-contact', role: 'Contact' }])]);
    iamApi.getGroupUsers.mockImplementation(async (groupId) => ({
      items:
        groupId === 'g-contact' || groupId === 'g-other'
          ? [{ id: `asg-${groupId}`, groupId, userId: member.id, userType: 'CUSTOMER' as const }]
          : [],
      total: 1,
      page: 1,
      size: 60,
    }));
    iamApi.getUserGroups.mockImplementation(async (userId: string) => {
      if (userId === adminCustomer.id) {
        return {
          items: [{ id: 'g-admin-selected', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } }],
          total: 1,
          page: 1,
          size: 60,
        };
      }
      return {
        items: [
          {
            id: 'g-contact',
            code: 'CONTACT',
            userType: 'CUSTOMER',
            b2b: { role: 'Contact', legalEntityId: SELECTED_LE },
          },
          {
            id: 'g-other',
            code: 'B2B_BUYER',
            userType: 'CUSTOMER',
            b2b: { role: 'Buyer', legalEntityId: otherLegalEntityId },
          },
        ],
        total: 2,
        page: 1,
        size: 60,
      };
    });
    mockHydrateByIdQuery([member]);

    const listed = await service.listUsers(1, 10);
    expect(iamApi.getUserGroups).toHaveBeenCalledWith(adminCustomer.id, { size: 60 }, 'service');
    expect(iamApi.getUserGroups.mock.calls.every(([userId]) => userId === adminCustomer.id)).toBe(true);
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]?.groups.map((group) => group.id)).toEqual(['g-contact']);
    expect(listed.items[0]?.groups.map((group) => group.displayName)).toEqual(['Acme - Contact']);
    expect(listed.items[0]?.groups.map((group) => group.displayName).join(' ')).not.toContain('Other Co');

    const user = await service.getUser('N-A');
    expect(user?.groups.map((group) => group.id)).toEqual(expect.arrayContaining(['g-contact', 'g-other']));
  });

  it('getUser returns a Q24 other-Admin-LE assignment member omitted from the first table', async () => {
    const otherMember = adminDto({
      id: 'cust-other-admin',
      customerNumber: 'N-OA',
      firstName: 'Ola',
      lastName: 'Other',
    });
    companyService.getCompanies.mockResolvedValue([
      { id: SELECTED_LE, name: 'Acme' },
      { id: 'le-other', name: 'Other Co' },
    ]);
    iamApi.getUserGroups.mockImplementation(async (userId) => {
      if (userId === adminCustomer.id) {
        return {
          items: [
            { id: 'g-selected', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } },
            { id: 'g-other-admin', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: 'le-other' } },
          ],
          total: 2,
          page: 1,
          size: 60,
        };
      }
      return {
        items: [{ id: 'g-other-admin', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: 'le-other' } }],
        total: 1,
        page: 1,
        size: 60,
      };
    });
    customerManagementApi.getContactAssignmentsByLegalEntityId.mockImplementation(async (legalEntityId) => ({
      items:
        legalEntityId === 'le-other'
          ? [assignment(otherMember.id, 'CONTACT', [{ id: 'g-other-admin', role: 'Admin' }], 'le-other')]
          : [],
      totalCount: legalEntityId === 'le-other' ? 1 : 0,
    }));
    mockHydrateByIdQuery([otherMember]);

    const listed = await service.listUsers(1, 10);
    const user = await service.getUser('N-OA');

    expect(listed.items).toEqual([]);
    expect(user?.id).toBe('N-OA');
    expect(user?.isSelectedLegalEntityMember).toBe(false);
    expect(iamApi.getUsers).not.toHaveBeenCalled();
    expect(iamApi.getUserGroups).toHaveBeenCalledWith(adminCustomer.id, { size: 60 }, 'service');
    expect(customerManagementApi.getContactAssignmentsByLegalEntityId).toHaveBeenCalledWith(
      'le-other',
      1,
      ASSIGNMENT_PAGE_SIZE,
    );
  });

  it('getUser returns undefined for an outsider even when other Admin legal entities exist', async () => {
    const outsider = adminDto({ id: 'cust-out', customerNumber: 'N-OUT', firstName: 'Out', lastName: 'Sider' });
    iamApi.getUserGroups.mockResolvedValue({
      items: [
        { id: 'g-selected', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } },
        { id: 'g-other-admin', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: 'le-other' } },
      ],
      total: 2,
      page: 1,
      size: 60,
    });
    customerManagementApi.getContactAssignmentsByLegalEntityId.mockImplementation(async (legalEntityId) => ({
      items: legalEntityId === 'le-other' ? [assignment('cust-other-member', 'CONTACT', undefined, 'le-other')] : [],
      totalCount: legalEntityId === 'le-other' ? 1 : 0,
    }));
    mockHydrateByIdQuery([outsider]);

    await expect(service.getUser('N-OUT')).resolves.toBeUndefined();
    expect(iamApi.getUsers).not.toHaveBeenCalled();
  });

  it('lists one combined Admin-LE row per (customer, legalEntity) including selected LE and current user', async () => {
    const selectedMember = adminDto({
      id: 'selected-member',
      customerNumber: 'N-S',
      firstName: 'Sel',
      lastName: 'Ected',
    });
    const sharedMember = adminDto({
      id: 'shared-member',
      customerNumber: 'N-SH',
      firstName: 'Sha',
      lastName: 'Red',
    });
    const otherOne = adminDto({ id: 'other-1', customerNumber: 'N-O1', firstName: 'Ola', lastName: 'One' });
    const otherTwo = adminDto({ id: 'other-2', customerNumber: 'N-O2', firstName: 'Oli', lastName: 'Two' });
    const duplicateByNumberA = adminDto({
      id: 'dup-a',
      customerNumber: 'N-DUP',
      firstName: 'Du',
      lastName: 'PeA',
    });
    const duplicateByNumberB = adminDto({
      id: 'dup-b',
      customerNumber: 'N-DUP',
      firstName: 'Du',
      lastName: 'PeB',
    });
    const contactOnlyMember = adminDto({
      id: 'contact-only',
      customerNumber: 'N-CO',
      firstName: 'Con',
      lastName: 'Tact',
    });
    const currentAdmin = adminDto({
      id: adminCustomer.id,
      customerNumber: 'N-ADMIN',
      firstName: 'Pat',
      lastName: 'Admin',
    });

    companyService.getCompanies.mockResolvedValue([
      { id: SELECTED_LE, name: 'Acme' },
      { id: 'le-other', name: 'Other Co' },
      { id: 'le-third', name: 'Third Co' },
    ]);
    iamApi.getUserGroups.mockResolvedValue({
      items: [
        { id: 'g-selected-admin', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } },
        { id: 'g-other-admin', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: 'le-other' } },
        { id: 'g-third-admin', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: 'le-third' } },
        { id: 'g-contact', code: 'CONTACT', b2b: { role: 'Contact', legalEntityId: 'le-contact' } },
        { id: 'g-customer', code: 'CUSTOMER', b2b: { role: 'Admin', legalEntityId: 'le-customer' } },
        { id: 'g-missing-le', code: 'B2B_ADMIN', b2b: { role: 'Admin' } },
      ],
      total: 6,
      page: 1,
      size: 60,
    });

    const assignmentsByLegalEntity: Record<string, EmporixContactAssignment[]> = {
      [SELECTED_LE]: [assignment(selectedMember.id, 'CONTACT'), assignment(sharedMember.id, 'CONTACT')],
      'le-other': [
        assignment(adminCustomer.id, 'CONTACT', [{ id: 'g-other-admin', role: 'Admin' }], 'le-other'),
        assignment(sharedMember.id, 'CONTACT', [{ id: 'g-other-admin', role: 'Admin' }], 'le-other'),
        assignment(otherOne.id, 'CONTACT', [{ id: 'g-other-admin', role: 'Admin' }], 'le-other'),
        assignment(duplicateByNumberA.id, 'CONTACT', [{ id: 'g-other-admin', role: 'Admin' }], 'le-other'),
      ],
      'le-third': [
        assignment(otherTwo.id, 'CONTACT', [{ id: 'g-third-admin', role: 'Admin' }], 'le-third'),
        assignment(duplicateByNumberB.id, 'CONTACT', [{ id: 'g-third-admin', role: 'Admin' }], 'le-third'),
      ],
      'le-contact': [assignment(contactOnlyMember.id, 'CONTACT', [{ id: 'g-contact', role: 'Contact' }], 'le-contact')],
    };
    customerManagementApi.getContactAssignmentsByLegalEntityId.mockImplementation(async (legalEntityId) => ({
      items: assignmentsByLegalEntity[legalEntityId] ?? [],
      totalCount: (assignmentsByLegalEntity[legalEntityId] ?? []).length,
    }));

    mockHydrateByIdQuery([
      selectedMember,
      sharedMember,
      otherOne,
      otherTwo,
      duplicateByNumberA,
      duplicateByNumberB,
      contactOnlyMember,
      currentAdmin,
    ]);
    iamApi.getGroupUsers.mockImplementation(async (groupId) => ({
      items:
        groupId === 'g-selected'
          ? [
              { id: 'asg-s', groupId, userId: selectedMember.id, userType: 'CUSTOMER' },
              { id: 'asg-sh-s', groupId, userId: sharedMember.id, userType: 'CUSTOMER' },
            ]
          : groupId === 'g-other-admin'
            ? [
                { id: 'asg-admin', groupId, userId: currentAdmin.id, userType: 'CUSTOMER' },
                { id: 'asg-o1', groupId, userId: otherOne.id, userType: 'CUSTOMER' },
                { id: 'asg-od', groupId, userId: duplicateByNumberA.id, userType: 'CUSTOMER' },
                { id: 'asg-sh-o', groupId, userId: sharedMember.id, userType: 'CUSTOMER' },
              ]
            : groupId === 'g-third-admin'
              ? [
                  { id: 'asg-t2', groupId, userId: otherTwo.id, userType: 'CUSTOMER' },
                  { id: 'asg-td', groupId, userId: duplicateByNumberB.id, userType: 'CUSTOMER' },
                ]
              : [],
      total: 4,
      page: 1,
      size: 60,
    }));

    const result = await service.listOtherCompanyUsers(1, 20);

    expect(result.items.map((user) => ({ id: user.id, legalEntityId: user.legalEntityId }))).toEqual([
      { id: 'N-ADMIN', legalEntityId: 'le-other' },
      { id: 'N-DUP', legalEntityId: 'le-other' },
      { id: 'N-O1', legalEntityId: 'le-other' },
      { id: 'N-SH', legalEntityId: 'le-other' },
      { id: 'N-S', legalEntityId: SELECTED_LE },
      { id: 'N-SH', legalEntityId: SELECTED_LE },
      { id: 'N-DUP', legalEntityId: 'le-third' },
      { id: 'N-O2', legalEntityId: 'le-third' },
    ]);
    expect(result.totalCount).toBe(8);
    expect(result.items.find((user) => user.id === 'N-ADMIN')?.legalEntityName).toBe('Other Co');
    expect(result.items.find((user) => user.id === 'N-S')?.legalEntityName).toBe('Acme');
    const sharedRows = result.items.filter((user) => user.id === 'N-SH');
    expect(sharedRows).toHaveLength(2);
    expect(sharedRows.map((row) => row.legalEntityId).sort()).toEqual(['le-other', SELECTED_LE]);
    expect(sharedRows.find((row) => row.legalEntityId === 'le-other')?.groups.map((group) => group.id)).toEqual([
      'g-other-admin',
    ]);
    expect(sharedRows.find((row) => row.legalEntityId === SELECTED_LE)?.groups.map((group) => group.id)).toEqual([
      'g-selected',
    ]);
    expect(
      sharedRows
        .find((row) => row.legalEntityId === SELECTED_LE)
        ?.groups.map((group) => group.displayName)
        .join(' '),
    ).not.toContain('Other Co');
    expect(result.items.find((user) => user.id === 'N-S')?.groups.map((group) => group.legalEntityId)).toEqual([
      SELECTED_LE,
    ]);
    expect(iamApi.getUsers).not.toHaveBeenCalled();
    expect(iamApi.getUserGroups).toHaveBeenCalledTimes(1);
    expect(iamApi.getUserGroups).toHaveBeenCalledWith(adminCustomer.id, { size: 60 }, 'service');
    expect(customerManagementApi.getContactAssignmentsByLegalEntityId).toHaveBeenCalledWith(
      SELECTED_LE,
      1,
      ASSIGNMENT_PAGE_SIZE,
    );
    expect(customerManagementApi.getContactAssignmentsByLegalEntityId).toHaveBeenCalledWith(
      'le-other',
      1,
      ASSIGNMENT_PAGE_SIZE,
    );
    expect(customerManagementApi.getContactAssignmentsByLegalEntityId).toHaveBeenCalledWith(
      'le-third',
      1,
      ASSIGNMENT_PAGE_SIZE,
    );
    expect(customerManagementApi.getContactAssignmentsByLegalEntityId).not.toHaveBeenCalledWith(
      'le-contact',
      1,
      ASSIGNMENT_PAGE_SIZE,
    );
    expect(customerManagementApi.getContactAssignmentsByLegalEntityId).not.toHaveBeenCalledWith(
      'le-customer',
      1,
      ASSIGNMENT_PAGE_SIZE,
    );
  });

  it('caps combined Admin-LE rows at MAX_SELECTED_LE_USERS after legalEntityId then identity sort', async () => {
    iamApi.getUserGroups.mockResolvedValue({
      items: [
        { id: 'g-other-admin', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: 'le-other' } },
        { id: 'g-third-admin', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: 'le-third' } },
      ],
      total: 2,
      page: 1,
      size: 60,
    });
    companyService.getCompanies.mockResolvedValue([
      { id: SELECTED_LE, name: 'Acme' },
      { id: 'le-other', name: 'Other Co' },
      { id: 'le-third', name: 'Third Co' },
    ]);
    customerManagementApi.getContactAssignmentsByLegalEntityId.mockImplementation(
      async (legalEntityId, pageNumber = 1) => {
        if (legalEntityId === SELECTED_LE) {
          return { items: [], totalCount: 0 };
        }
        const all = Array.from({ length: 300 }, (_, index) =>
          assignment(
            `member-${index}`,
            'CONTACT',
            [{ id: legalEntityId === 'le-other' ? 'g-other-admin' : 'g-third-admin', role: 'Admin' }],
            legalEntityId,
          ),
        );
        const start = (pageNumber - 1) * ASSIGNMENT_PAGE_SIZE;
        return { items: all.slice(start, start + ASSIGNMENT_PAGE_SIZE), totalCount: all.length };
      },
    );
    mockHydrateByIdQuery(
      Array.from({ length: 300 }, (_, index) =>
        adminDto({
          id: `member-${index}`,
          customerNumber: `N-${String(index).padStart(3, '0')}`,
          firstName: `User${String(index).padStart(3, '0')}`,
          lastName: 'Other',
        }),
      ),
    );
    iamApi.getGroupUsers.mockImplementation(async (groupId, params) => {
      const pageNumber = params?.page ?? 1;
      const start = (pageNumber - 1) * ASSIGNMENT_PAGE_SIZE;
      const ids = Array.from({ length: 300 }, (_, index) => `member-${index}`);
      return {
        items: ids.slice(start, start + ASSIGNMENT_PAGE_SIZE).map((id, index) => ({
          id: `asg-${groupId}-${pageNumber}-${index}`,
          groupId,
          userId: id,
          userType: 'CUSTOMER' as const,
        })),
        total: ids.length,
        page: pageNumber,
        size: ASSIGNMENT_PAGE_SIZE,
      };
    });

    const result = await service.listOtherCompanyUsers(1, 500);

    expect(result.items).toHaveLength(500);
    expect(result.totalCount).toBe(500);
    expect(result.items[0]?.id).toBe('N-000');
    expect(result.items[0]?.legalEntityId).toBe('le-other');
    expect(result.items[299]?.legalEntityId).toBe('le-other');
    expect(result.items[300]?.id).toBe('N-000');
    expect(result.items[300]?.legalEntityId).toBe('le-third');
    expect(result.items[499]?.id).toBe('N-199');
    expect(result.items[499]?.legalEntityId).toBe('le-third');
    expect(new Set(result.items.map((user) => user.id)).size).toBe(300);
    expect(iamApi.getUsers).not.toHaveBeenCalled();
    expect(iamApi.getUserGroups).toHaveBeenCalledTimes(1);
  });

  it('tokenizes, sorts, and pages combined Admin-LE rows with the listUsers allow-list', async () => {
    const johnSmith = adminDto({ id: 'cust-js', customerNumber: 'N-JS', firstName: 'John', lastName: 'Smith' });
    const janeStone = adminDto({
      id: 'cust-jane',
      customerNumber: 'N-JA',
      firstName: 'Jane',
      lastName: 'Stone',
      contactEmail: 'jane.stone@acme.com',
    });
    const annAlpha = adminDto({ id: 'cust-ann', customerNumber: 'N-A', firstName: 'Ann', lastName: 'Alpha' });
    companyService.getCompanies.mockResolvedValue([
      { id: SELECTED_LE, name: 'Acme' },
      { id: 'le-other', name: 'Other Co' },
    ]);
    iamApi.getUserGroups.mockResolvedValue({
      items: [
        { id: 'g-selected-admin', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } },
        { id: 'g-other-admin', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: 'le-other' } },
      ],
      total: 2,
      page: 1,
      size: 60,
    });
    customerManagementApi.getContactAssignmentsByLegalEntityId.mockImplementation(async (legalEntityId) => ({
      items:
        legalEntityId === SELECTED_LE
          ? [assignment(annAlpha.id, 'CONTACT')]
          : legalEntityId === 'le-other'
            ? [
                assignment(johnSmith.id, 'CONTACT', [{ id: 'g-other-admin', role: 'Admin' }], 'le-other'),
                assignment(janeStone.id, 'CONTACT', [{ id: 'g-other-admin', role: 'Admin' }], 'le-other'),
              ]
            : [],
      totalCount: legalEntityId === 'le-other' ? 2 : legalEntityId === SELECTED_LE ? 1 : 0,
    }));
    mockHydrateByIdQuery([johnSmith, janeStone, annAlpha]);
    iamApi.getGroupUsers.mockResolvedValue({ items: [], total: 0, page: 1, size: 60 });

    const searched = await service.listOtherCompanyUsers(1, 10, undefined, 'John S');
    expect(searched.items.map((user) => user.id)).toEqual(['N-JS']);
    expect(searched.totalCount).toBe(1);

    const byEmail = await service.listOtherCompanyUsers(1, 10, undefined, 'jane.stone@');
    expect(byEmail.items.map((user) => user.id)).toEqual(['N-JA']);
    expect(byEmail.totalCount).toBe(1);

    const byFirst = await service.listOtherCompanyUsers(1, 10, 'firstName:asc');
    expect(byFirst.items.map((user) => user.id)).toEqual(['N-A', 'N-JA', 'N-JS']);

    const paged = await service.listOtherCompanyUsers(2, 2, 'firstName:asc');
    expect(paged.totalCount).toBe(3);
    expect(paged.items.map((user) => user.id)).toEqual(['N-JS']);

    const ignored = await service.listOtherCompanyUsers(1, 10, 'userGroup:asc');
    expect(ignored.items.map((user) => ({ id: user.id, legalEntityId: user.legalEntityId }))).toEqual([
      { id: 'N-JA', legalEntityId: 'le-other' },
      { id: 'N-JS', legalEntityId: 'le-other' },
      { id: 'N-A', legalEntityId: SELECTED_LE },
    ]);
  });

  it('keeps findReadableCustomer on the other-LE collector that excludes selected LE', async () => {
    const selectedMember = adminDto({
      id: 'selected-member',
      customerNumber: 'N-S',
      firstName: 'Sel',
      lastName: 'Ected',
    });
    const otherMember = adminDto({
      id: 'cust-other-admin',
      customerNumber: 'N-OA',
      firstName: 'Ola',
      lastName: 'Other',
    });
    companyService.getCompanies.mockResolvedValue([
      { id: SELECTED_LE, name: 'Acme' },
      { id: 'le-other', name: 'Other Co' },
    ]);
    iamApi.getUserGroups.mockImplementation(async (userId) => {
      if (userId === adminCustomer.id) {
        return {
          items: [
            { id: 'g-selected', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } },
            { id: 'g-other-admin', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: 'le-other' } },
          ],
          total: 2,
          page: 1,
          size: 60,
        };
      }
      return {
        items: [{ id: 'g-other-admin', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: 'le-other' } }],
        total: 1,
        page: 1,
        size: 60,
      };
    });
    customerManagementApi.getContactAssignmentsByLegalEntityId.mockImplementation(async (legalEntityId) => ({
      items:
        legalEntityId === SELECTED_LE
          ? [assignment(selectedMember.id, 'CONTACT')]
          : legalEntityId === 'le-other'
            ? [assignment(otherMember.id, 'CONTACT', [{ id: 'g-other-admin', role: 'Admin' }], 'le-other')]
            : [],
      totalCount: 1,
    }));
    mockHydrateByIdQuery([selectedMember, otherMember]);

    const selected = await service.getUser('N-S');
    expect(selected?.id).toBe('N-S');
    expect(selected?.isSelectedLegalEntityMember).toBe(true);
    expect(customerManagementApi.getContactAssignmentsByLegalEntityId).not.toHaveBeenCalledWith(
      'le-other',
      1,
      ASSIGNMENT_PAGE_SIZE,
    );

    iamApi.getUserGroups.mockClear();
    customerManagementApi.getContactAssignmentsByLegalEntityId.mockClear();
    const other = await service.getUser('N-OA');
    expect(other?.id).toBe('N-OA');
    expect(other?.isSelectedLegalEntityMember).toBe(false);
    expect(iamApi.getUserGroups).toHaveBeenCalledWith(adminCustomer.id, { size: 60 }, 'service');
    expect(customerManagementApi.getContactAssignmentsByLegalEntityId).toHaveBeenCalledWith(
      'le-other',
      1,
      ASSIGNMENT_PAGE_SIZE,
    );
  });

  function assignment(
    customerId: string,
    type: EmporixContactAssignment['type'],
    customerGroups?: { id: string; role?: string }[],
    legalEntityId: string = SELECTED_LE,
  ): EmporixContactAssignment {
    return {
      id: `ca-${customerId}`,
      legalEntity: {
        id: legalEntityId,
        ...(customerGroups
          ? { customerGroups: customerGroups.map((group) => ({ ...group, name: { en: group.id } })) }
          : {}),
      },
      customer: { id: customerId },
      type,
    };
  }

  function adminDto(
    partial: Partial<EmporixCustomerAdmin> & Pick<EmporixCustomerAdmin, 'id' | 'customerNumber'>,
  ): EmporixCustomerAdmin {
    return {
      firstName: 'A',
      lastName: 'B',
      contactEmail: `${partial.customerNumber}@example.com`,
      active: true,
      ...partial,
    };
  }

  function mockAssignments(items: EmporixContactAssignment[]): void {
    customerManagementApi.getContactAssignmentsByLegalEntityId.mockImplementation(
      async (_le, pageNumber = 1, pageSize = ASSIGNMENT_PAGE_SIZE) => {
        const start = (pageNumber - 1) * pageSize;
        return { items: items.slice(start, start + pageSize), totalCount: items.length };
      },
    );
    const selectedGroupUsers = items
      .map((item) => item.customer.id)
      .filter((id): id is string => Boolean(id))
      .map((id, index) => ({
        id: `asg-${index + 1}`,
        groupId: 'g-selected',
        userId: id,
        userType: 'CUSTOMER' as const,
      }));
    iamApi.getGroupUsers.mockImplementation(async (groupId) => ({
      items: groupId === 'g-selected' ? selectedGroupUsers : [],
      total: groupId === 'g-selected' ? selectedGroupUsers.length : 0,
      page: 1,
      size: 60,
    }));
  }

  function mockHydrateByIdQuery(members: EmporixCustomerAdmin[]): void {
    const byId = new Map(members.map((member) => [member.id, member]));
    customerAdminApi.getCustomers.mockImplementation(async (_page, _size, _sort, query) => {
      const match = query?.match(/^id:\(([^)]*)\)$/);
      const ids = match?.[1] ? match[1].split(',') : [];
      return {
        items: ids.map((id) => byId.get(id)).filter((item): item is EmporixCustomerAdmin => Boolean(item)),
      };
    });
    customerAdminApi.getCustomer.mockImplementation(async (id) => byId.get(id) ?? null);
  }
});

describe('EmporixUserManagementService create/update/delete', () => {
  const OTHER_LE = 'le-other';
  const GROUP_ADMIN = 'g-admin';
  const GROUP_BUYER = 'g-buyer';
  const GROUP_CONTACT = 'g-contact';
  const GROUP_CUSTOMER = 'g-customer';
  const GROUP_OTHER = 'g-other';

  let customerAdminApi: jest.Mocked<
    Pick<
      EmporixCustomerAdminApi,
      'getCustomers' | 'getCustomer' | 'createCustomer' | 'updateCustomer' | 'deleteCustomer'
    >
  >;
  let customerManagementApi: jest.Mocked<
    Pick<
      EmporixCustomerManagementApi,
      | 'getContactAssignmentsByLegalEntityId'
      | 'createLegalEntityContactAssignment'
      | 'createContactAssignment'
      | 'deleteContactAssignment'
    >
  >;
  let iamApi: jest.Mocked<
    Pick<EmporixIamApi, 'getUsers' | 'getUserGroups' | 'addUserToGroup' | 'removeUserFromGroup' | 'getGroups'>
  >;
  let companyService: jest.Mocked<Pick<CompanyService, 'getCompanies' | 'getCompany'>>;
  let customerService: jest.Mocked<Pick<CustomerService, 'getCustomer'>>;
  let sessionService: jest.Mocked<
    Pick<SessionService, 'getCurrent' | 'setLegalEntity' | 'getCustomerTokenLegalEntityId'>
  >;
  let logger: jest.Mocked<Pick<LoggerService, 'info' | 'warn' | 'error'>>;
  let service: EmporixUserManagementService;

  const adminCustomer: Customer = {
    id: 'admin-1',
    email: 'admin@example.com',
    firstName: 'Pat',
    lastName: 'Admin',
    legalEntityId: SELECTED_LE,
    roles: [CustomerRole.B2B, CustomerRole.B2B_ADMIN],
  };

  const createdCustomer = (overrides: Partial<EmporixCustomerAdmin> = {}): EmporixCustomerAdmin => ({
    id: 'cust-uuid',
    customerNumber: 'C-100',
    firstName: 'Ada',
    lastName: 'Lovelace',
    contactEmail: 'ada@example.com',
    active: true,
    ...overrides,
  });

  beforeEach(() => {
    customerAdminApi = {
      getCustomers: jest.fn().mockResolvedValue({ items: [createdCustomer()] }),
      getCustomer: jest.fn().mockResolvedValue(createdCustomer()),
      createCustomer: jest.fn().mockResolvedValue({ id: 'cust-uuid' }),
      updateCustomer: jest.fn().mockResolvedValue(undefined),
      deleteCustomer: jest.fn().mockResolvedValue(undefined),
    };
    customerManagementApi = {
      getContactAssignmentsByLegalEntityId: jest.fn().mockResolvedValue({ items: [], totalCount: 0 }),
      createLegalEntityContactAssignment: jest.fn().mockResolvedValue({ id: 'ca-new' }),
      createContactAssignment: jest.fn(),
      deleteContactAssignment: jest.fn().mockResolvedValue(undefined),
    };
    iamApi = {
      getUsers: jest.fn().mockResolvedValue({
        items: [{ id: 'cust-uuid', userType: 'CUSTOMER', groups: [{ id: GROUP_ADMIN }] }],
        totalCount: 1,
      }),
      getUserGroups: jest.fn().mockImplementation(async (userId: string) => {
        if (userId === adminCustomer.id) {
          return {
            items: [{ id: GROUP_ADMIN, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } }],
            total: 1,
            page: 1,
            size: 60,
          };
        }
        return { items: [], total: 0, page: 1, size: 60 };
      }),
      addUserToGroup: jest.fn().mockResolvedValue({ id: 'asg-1' }),
      removeUserFromGroup: jest.fn().mockResolvedValue(undefined),
      getGroups: jest.fn().mockResolvedValue([
        {
          id: GROUP_ADMIN,
          code: 'B2B_ADMIN',
          userType: 'CUSTOMER',
          b2b: { role: 'Admin', legalEntityId: SELECTED_LE },
        },
        {
          id: GROUP_CONTACT,
          code: 'CONTACT',
          userType: 'CUSTOMER',
          b2b: { role: 'Contact', legalEntityId: SELECTED_LE },
        },
      ]),
    };
    companyService = {
      getCompanies: jest.fn().mockResolvedValue([
        { id: SELECTED_LE, name: 'Acme' },
        { id: OTHER_LE, name: 'Acme East' },
      ]),
      getCompany: jest.fn().mockImplementation(async (id?: string) => {
        if (id === OTHER_LE) {
          return { id: OTHER_LE, name: 'Acme East' };
        }
        return { id: SELECTED_LE, name: 'Acme' };
      }),
    };
    customerService = {
      getCustomer: jest.fn().mockResolvedValue(adminCustomer),
    };
    sessionService = {
      getCurrent: jest.fn().mockResolvedValue({
        legalEntityId: SELECTED_LE,
        siteCode: 'main',
        language: 'en_US',
        currency: 'EUR',
      }),
      setLegalEntity: jest.fn().mockResolvedValue({
        tokenRefreshSucceeded: true,
        tokenLooksLikeJwt: false,
      }),
      getCustomerTokenLegalEntityId: jest.fn().mockResolvedValue(SELECTED_LE),
    };
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    service = new EmporixUserManagementService(
      customerAdminApi as unknown as EmporixCustomerAdminApi,
      customerManagementApi as unknown as EmporixCustomerManagementApi,
      iamApi as unknown as EmporixIamApi,
      new EmporixCompanyUserMapper(),
      companyService as unknown as CompanyService,
      customerService as unknown as CustomerService,
      sessionService as unknown as SessionService,
      logger as unknown as LoggerService,
    );
  });

  it('throws AdminRequiredError on create/update/delete', async () => {
    customerService.getCustomer.mockResolvedValue({
      ...adminCustomer,
      roles: [CustomerRole.B2B, CustomerRole.B2B_BUYER],
    });

    await expect(service.createUser(inviteRequest())).rejects.toBeInstanceOf(AdminRequiredError);
    await expect(service.updateUser('C-100', { firstName: 'Ada' })).rejects.toBeInstanceOf(AdminRequiredError);
    await expect(service.deleteUser('C-100')).rejects.toBeInstanceOf(AdminRequiredError);
    expect(customerAdminApi.createCustomer).not.toHaveBeenCalled();
    expect(customerAdminApi.deleteCustomer).not.toHaveBeenCalled();
  });

  it('throws AdminRequiredError on create when the selected legal entity is not an Admin LE', async () => {
    iamApi.getUserGroups.mockResolvedValue({
      items: [{ id: 'g-other-admin', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: OTHER_LE } }],
      total: 1,
      page: 1,
      size: 60,
    });

    await expect(service.createUser(inviteRequest())).rejects.toBeInstanceOf(AdminRequiredError);
    expect(customerAdminApi.createCustomer).not.toHaveBeenCalled();
    expect(customerManagementApi.createLegalEntityContactAssignment).not.toHaveBeenCalled();
  });

  it('invite-creates via admin POST without password, signup, or caas-customer, then CONTACT and service IAM assign', async () => {
    iamApi.getUserGroups.mockResolvedValue({
      items: [{ id: GROUP_ADMIN, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } }],
      total: 1,
      page: 1,
      size: 60,
    });

    const result = await service.createUser(inviteRequest());

    expect(customerAdminApi.createCustomer).toHaveBeenCalledTimes(1);
    const createBody = customerAdminApi.createCustomer.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
    expect(createBody).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      contactEmail: 'ada@example.com',
      title: 'MS',
      contactPhone: '+1-555-0100',
      preferredSite: 'main',
      preferredLanguage: 'en_US',
      preferredCurrency: 'EUR',
    });
    expect(createBody).not.toHaveProperty('password');
    expect(createBody).not.toHaveProperty('b2b');
    expect(customerAdminApi.createCustomer).toHaveBeenCalledWith(createBody, SELECTED_LE);
    expect(customerAdminApi.getCustomer).toHaveBeenCalledWith('cust-uuid', 'service');
    expect(sessionService.setLegalEntity).toHaveBeenCalledWith(SELECTED_LE);
    expect(sessionService.setLegalEntity).toHaveBeenCalledTimes(1);
    expect(sessionService.setLegalEntity.mock.invocationCallOrder[0]).toBeLessThan(
      customerAdminApi.createCustomer.mock.invocationCallOrder[0]!,
    );
    expect(customerManagementApi.createLegalEntityContactAssignment).toHaveBeenCalledWith({
      legalEntity: { id: SELECTED_LE },
      customer: { id: 'cust-uuid' },
    });
    expect(customerManagementApi.createLegalEntityContactAssignment).toHaveBeenCalledTimes(1);
    expect(customerManagementApi.createContactAssignment).not.toHaveBeenCalled();
    expect(customerAdminApi.getCustomer.mock.invocationCallOrder[0]).toBeLessThan(
      customerManagementApi.createLegalEntityContactAssignment.mock.invocationCallOrder[0]!,
    );
    expect(iamApi.addUserToGroup).toHaveBeenCalledWith(
      GROUP_CONTACT,
      { userId: 'cust-uuid', userType: 'CUSTOMER' },
      'service',
    );
    expect(iamApi.addUserToGroup).toHaveBeenCalledWith(
      GROUP_ADMIN,
      { userId: 'cust-uuid', userType: 'CUSTOMER' },
      'service',
    );
    expect(iamApi.addUserToGroup).toHaveBeenCalledTimes(2);
    expect(iamApi.addUserToGroup.mock.calls.every(([, , tokenType]) => tokenType === 'service')).toBe(true);
    expect(iamApi.getUserGroups.mock.calls.every(([, , tokenType]) => tokenType === 'service')).toBe(true);
    expect(customerManagementApi.createLegalEntityContactAssignment.mock.invocationCallOrder[0]).toBeLessThan(
      iamApi.addUserToGroup.mock.invocationCallOrder[0]!,
    );
    expect(result.user.id).toBe('C-100');
    expect(result.failedGroupNames).toBeUndefined();
  });

  it.each([
    ['Contact-only sentinel', CONTACT_ONLY_GROUP_ID],
    ['client-sent Contact catalog id', GROUP_CONTACT],
  ])('invite-creates with %s assigning CONTACT + IAM Contact only', async (_case, groupId) => {
    const result = await service.createUser(
      inviteRequest({ groupAssignments: [{ legalEntityId: SELECTED_LE, groupId }] }),
    );

    expect(customerAdminApi.createCustomer).toHaveBeenCalledTimes(1);
    expect(customerManagementApi.createLegalEntityContactAssignment).toHaveBeenCalledWith({
      legalEntity: { id: SELECTED_LE },
      customer: { id: 'cust-uuid' },
    });
    expect(iamApi.addUserToGroup).toHaveBeenCalledWith(
      GROUP_CONTACT,
      { userId: 'cust-uuid', userType: 'CUSTOMER' },
      'service',
    );
    expect(iamApi.addUserToGroup).toHaveBeenCalledTimes(1);
    expect(iamApi.addUserToGroup.mock.calls.map(([id]) => id)).not.toContain(GROUP_ADMIN);
    expect(iamApi.removeUserFromGroup).not.toHaveBeenCalled();
    expect(result.failedGroupNames).toBeUndefined();
  });

  it('stops create before side effects when the selected LE has no Contact catalog group', async () => {
    iamApi.getGroups.mockResolvedValue([
      { id: GROUP_ADMIN, code: 'B2B_ADMIN', userType: 'CUSTOMER', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } },
    ]);

    await expect(service.createUser(inviteRequest())).rejects.toThrow(
      'Selected legal entity has no Contact catalog group',
    );

    expect(customerAdminApi.createCustomer).not.toHaveBeenCalled();
    expect(customerManagementApi.createLegalEntityContactAssignment).not.toHaveBeenCalled();
    expect(iamApi.addUserToGroup).not.toHaveBeenCalled();
  });

  it('uses the session legal entity when the profile and first permitted company point elsewhere', async () => {
    companyService.getCompanies.mockResolvedValue([
      { id: OTHER_LE, name: 'Acme East' },
      { id: SELECTED_LE, name: 'Acme' },
    ]);
    customerService.getCustomer.mockResolvedValue({ ...adminCustomer, legalEntityId: OTHER_LE });

    await service.createUser(inviteRequest());

    expect(sessionService.setLegalEntity).toHaveBeenCalledWith(SELECTED_LE);
    expect(customerAdminApi.createCustomer).toHaveBeenCalledWith(
      expect.not.objectContaining({ b2b: expect.anything() }),
      SELECTED_LE,
    );
  });

  it.each([
    ['missing', undefined],
    ['mismatched', OTHER_LE],
  ])('aborts create when the refreshed customer token legal entity is %s', async (_case, tokenLegalEntityId) => {
    sessionService.getCustomerTokenLegalEntityId.mockResolvedValue(tokenLegalEntityId);

    await expect(service.createUser(inviteRequest())).rejects.toThrow(
      'Customer token is not scoped to the selected legal entity',
    );

    expect(sessionService.setLegalEntity).toHaveBeenCalledWith(SELECTED_LE);
    expect(customerAdminApi.createCustomer).not.toHaveBeenCalled();
    expect(customerManagementApi.createLegalEntityContactAssignment).not.toHaveBeenCalled();
    expect(iamApi.addUserToGroup).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      {
        sessionLegalEntityId: SELECTED_LE,
        selectedLegalEntityId: SELECTED_LE,
        tokenLegalEntityId: tokenLegalEntityId ?? null,
        tokenRefreshSucceeded: true,
        tokenLooksLikeJwt: false,
      },
      'Customer token is not scoped to the selected legal entity',
    );
  });

  it.each([
    ['omitted', undefined as never],
    ['missing', []],
    [
      'multiple',
      [
        { legalEntityId: SELECTED_LE, groupId: GROUP_ADMIN },
        { legalEntityId: SELECTED_LE, groupId: GROUP_BUYER },
      ],
    ],
    ['mismatched legal entity', [{ legalEntityId: OTHER_LE, groupId: GROUP_OTHER }]],
    ['non-catalog group', [{ legalEntityId: SELECTED_LE, groupId: 'g-not-in-catalog' }]],
  ])('rejects a %s create group assignment before write side effects', async (_case, groupAssignments) => {
    await expect(service.createUser(inviteRequest({ groupAssignments }))).rejects.toThrow();

    expect(customerAdminApi.createCustomer).not.toHaveBeenCalled();
    expect(customerAdminApi.updateCustomer).not.toHaveBeenCalled();
    expect(customerManagementApi.createLegalEntityContactAssignment).not.toHaveBeenCalled();
    expect(iamApi.addUserToGroup).not.toHaveBeenCalled();
    expect(iamApi.removeUserFromGroup).not.toHaveBeenCalled();
  });

  it('rejects create when the session legalEntityId is missing without falling back to the profile company', async () => {
    sessionService.getCurrent.mockResolvedValue({ id: 'session-1', currency: 'EUR', siteCode: 'main' });

    await expect(service.createUser(inviteRequest())).rejects.toThrow(
      'Selected legal entity membership could not be established',
    );

    expect(sessionService.setLegalEntity).not.toHaveBeenCalled();
    expect(customerAdminApi.createCustomer).not.toHaveBeenCalled();
  });

  it('rejects assignable groups when the session legalEntityId is missing', async () => {
    sessionService.getCurrent.mockResolvedValue({ id: 'session-1', currency: 'EUR', siteCode: 'main' });

    await expect(service.listAssignableGroups()).rejects.toThrow(
      'Selected legal entity membership could not be established',
    );

    expect(iamApi.getGroups).not.toHaveBeenCalled();
  });

  it('normalizes an attribute-shaped session legalEntityId before resolving the write company', async () => {
    sessionService.getCurrent.mockResolvedValue({
      id: 'session-1',
      legalEntityId: { key: 'legalEntityId', value: `  ${SELECTED_LE}  ` },
      currency: 'EUR',
      siteCode: 'main',
    } as never);

    await service.createUser(inviteRequest());

    expect(sessionService.setLegalEntity).toHaveBeenCalledWith(SELECTED_LE);
    expect(customerAdminApi.createCustomer.mock.calls[0]?.[0]).not.toHaveProperty('b2b');
    expect(customerAdminApi.createCustomer.mock.calls[0]?.[1]).toBe(SELECTED_LE);
  });

  it('rejects and logs when neither the session nor customer legalEntityId is permitted', async () => {
    sessionService.getCurrent.mockResolvedValue({
      id: 'session-1',
      legalEntityId: 'le-not-permitted',
      currency: 'EUR',
      siteCode: 'main',
    });
    customerService.getCustomer.mockResolvedValue({ ...adminCustomer, legalEntityId: 'le-customer-not-permitted' });

    await expect(service.createUser(inviteRequest())).rejects.toThrow(
      'Selected legal entity membership could not be established',
    );

    expect(logger.error).toHaveBeenCalledWith(
      {
        hasSession: true,
        sessionLegalEntityType: 'string',
        sessionLegalEntityId: 'le-not-permitted',
        profileFirstLegalEntityId: SELECTED_LE,
        permittedCompanyCount: 2,
        usedProfileFirstFallback: false,
      },
      'Selected legal entity membership could not be established',
    );
    expect(customerAdminApi.createCustomer).not.toHaveBeenCalled();
  });

  it('maps storefront language en to Customer Service language en_US', async () => {
    sessionService.getCurrent.mockResolvedValue({
      id: 'session-1',
      legalEntityId: SELECTED_LE,
      siteCode: 'main',
      language: 'en',
      currency: 'USD',
    });

    await service.createUser(inviteRequest());

    expect(customerAdminApi.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredLanguage: 'en_US',
        preferredSite: 'main',
        preferredCurrency: 'USD',
      }),
      SELECTED_LE,
    );
  });

  it('logs actionable upstream create details without PII and preserves the thrown 400 body', async () => {
    const body = JSON.stringify({
      type: 'ValidationError',
      message: 'The request body is invalid',
      details: [
        { field: 'preferredLanguage', message: 'unsupported language' },
        { field: 'contactEmail', message: 'invalid ada@example.com', email: 'ada@example.com' },
      ],
    });
    const upstreamError = new EmporixApiError({
      operation: 'Create customer',
      status: 400,
      statusText: 'Bad Request',
      body,
    });
    customerAdminApi.createCustomer.mockRejectedValue(upstreamError);

    await expect(service.createUser(inviteRequest())).rejects.toThrow(body);

    const createBody = customerAdminApi.createCustomer.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
    expect(createBody).not.toHaveProperty('password');
    expect(logger.error).toHaveBeenCalledWith(
      {
        status: 400,
        statusText: 'Bad Request',
        operation: 'Create customer',
        type: 'ValidationError',
        message: 'The request body is invalid',
        details: [
          { field: 'preferredLanguage', message: 'unsupported language' },
          { field: 'contactEmail', message: 'invalid [REDACTED_EMAIL]', email: '[REDACTED_EMAIL]' },
        ],
        tokenType: 'service',
        createDtoKeys: [
          'firstName',
          'lastName',
          'contactEmail',
          'title',
          'contactPhone',
          'preferredSite',
          'preferredLanguage',
          'preferredCurrency',
        ],
        preferredLanguage: 'en_US',
        preferredSite: 'main',
        preferredCurrency: 'EUR',
        preferredLanguageLength: 5,
        sessionLegalEntityId: SELECTED_LE,
        profileFirstLegalEntityId: SELECTED_LE,
        selectedLegalEntityId: SELECTED_LE,
        tokenLegalEntityId: SELECTED_LE,
        tokenRefreshSucceeded: true,
        tokenLooksLikeJwt: false,
        usedProfileFirstFallback: false,
      },
      'User management customer invite create failed',
    );
    const loggedContext = JSON.stringify(logger.error.mock.calls[0]?.[0]);
    expect(loggedContext).not.toContain('ada@example.com');
    expect(loggedContext).not.toContain('Lovelace');
    expect(loggedContext).not.toContain('+1-555-0100');
  });

  it('does not copy missing session preferred site/language/currency onto the create DTO', async () => {
    sessionService.getCurrent.mockResolvedValue({ id: 'session-1', legalEntityId: SELECTED_LE } as never);

    await service.createUser(inviteRequest());

    expect(customerAdminApi.createCustomer.mock.calls[0]?.[0]).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      contactEmail: 'ada@example.com',
      title: 'MS',
      contactPhone: '+1-555-0100',
    });
    expect(customerAdminApi.createCustomer.mock.calls[0]?.[1]).toBe(SELECTED_LE);
  });

  it('uses service GET and PATCH after create when session GET cannot see the unassigned customer', async () => {
    const created = createdCustomer({ id: 'cust-uuid', customerNumber: 'C-100', active: true });
    customerAdminApi.createCustomer.mockResolvedValue({ id: 'cust-uuid' });
    customerAdminApi.getCustomer.mockImplementation(async (_id, tokenType) =>
      tokenType === 'service' ? created : null,
    );

    await service.createUser(inviteRequest({ active: false }));

    const adminGetOrder = customerAdminApi.getCustomer.mock.invocationCallOrder[0];
    const patchOrder = customerAdminApi.updateCustomer.mock.invocationCallOrder[0];
    expect(customerAdminApi.getCustomer).toHaveBeenCalledWith('cust-uuid', 'service');
    expect(customerAdminApi.updateCustomer).toHaveBeenCalledWith('C-100', { active: false }, 'service');
    expect(adminGetOrder).toBeLessThan(patchOrder);
  });

  it('logs the created id when the service GET still misses', async () => {
    customerAdminApi.getCustomer.mockResolvedValue(null);

    await expect(service.createUser(inviteRequest())).rejects.toThrow('Created customer could not be retrieved');

    expect(customerAdminApi.getCustomer).toHaveBeenCalledWith('cust-uuid', 'service');
    expect(logger.error).toHaveBeenCalledWith(
      { createdId: 'cust-uuid', tokenType: 'service' },
      'Created customer service GET missed',
    );
    expect(customerManagementApi.createLegalEntityContactAssignment).not.toHaveBeenCalled();
    expect(iamApi.addUserToGroup).not.toHaveBeenCalled();
  });

  it('does not PATCH active when Activate is checked', async () => {
    await service.createUser(inviteRequest({ active: true }));

    expect(customerAdminApi.updateCustomer).not.toHaveBeenCalled();
  });

  it('does not unconditionally remove IAM group code CUSTOMER after assign', async () => {
    iamApi.getUserGroups.mockResolvedValue({
      items: [
        { id: GROUP_CUSTOMER, code: 'CUSTOMER' },
        { id: GROUP_ADMIN, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } },
      ],
      total: 2,
      page: 1,
      size: 60,
    });

    await service.createUser(inviteRequest());

    expect(iamApi.removeUserFromGroup).not.toHaveBeenCalled();
    expect(iamApi.removeUserFromGroup.mock.calls.map(([groupId]) => groupId)).not.toContain(GROUP_CUSTOMER);
  });

  it('removes an extra predefined role for the same LE after assign, and keeps Contact', async () => {
    iamApi.getUserGroups.mockResolvedValue({
      items: [
        { id: GROUP_ADMIN, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } },
        { id: GROUP_BUYER, code: 'B2B_BUYER', b2b: { role: 'Buyer', legalEntityId: SELECTED_LE } },
        { id: GROUP_CONTACT, code: 'CONTACT', b2b: { role: 'Contact', legalEntityId: SELECTED_LE } },
      ],
      total: 3,
      page: 1,
      size: 60,
    });

    await service.createUser(inviteRequest());

    expect(iamApi.removeUserFromGroup).toHaveBeenCalledWith(GROUP_BUYER, 'cust-uuid', 'service');
    expect(iamApi.removeUserFromGroup.mock.invocationCallOrder[0]).toBeLessThan(
      iamApi.addUserToGroup.mock.invocationCallOrder[0]!,
    );
    expect(iamApi.removeUserFromGroup.mock.calls.map(([groupId]) => groupId)).not.toContain(GROUP_CONTACT);
    expect(iamApi.removeUserFromGroup.mock.calls.map(([groupId]) => groupId)).not.toContain(GROUP_ADMIN);
  });

  it('returns partial-create when CONTACT fails and does not attempt IAM assignment', async () => {
    customerManagementApi.createLegalEntityContactAssignment.mockRejectedValue(
      new Error('Failed to create legal-entity contact assignment: Forbidden'),
    );
    iamApi.getGroups.mockResolvedValue([
      { id: GROUP_ADMIN, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } },
      { id: GROUP_CONTACT, code: 'CONTACT', b2b: { role: 'Contact', legalEntityId: SELECTED_LE } },
    ]);

    const result = await service.createUser(inviteRequest());

    expect(result.user.id).toBe('C-100');
    expect(result.failedGroupNames).toEqual(['Acme - Admin']);
    expect(customerAdminApi.deleteCustomer).not.toHaveBeenCalled();
    expect(sessionService.setLegalEntity).toHaveBeenCalledWith(SELECTED_LE);
    expect(iamApi.addUserToGroup).not.toHaveBeenCalled();
    expect(customerManagementApi.deleteContactAssignment).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      {
        step: 'contact-assignment',
        customerId: 'cust-uuid',
        legalEntityId: SELECTED_LE,
        groupId: GROUP_ADMIN,
        forbidden: true,
        error: 'Failed to create legal-entity contact assignment: Forbidden',
      },
      'User management contact-assignment link failed',
    );
  });

  it('returns partial-create when service IAM fails after CONTACT and keeps the CONTACT assignment', async () => {
    iamApi.addUserToGroup.mockImplementation(async (groupId) => {
      if (groupId === GROUP_ADMIN) {
        throw new Error('Failed to create group assignment: Forbidden');
      }
      return { id: 'asg-1' };
    });

    const result = await service.createUser(inviteRequest());

    expect(result.user.id).toBe('C-100');
    expect(result.failedGroupNames).toEqual(['Acme - Admin']);
    expect(customerManagementApi.createLegalEntityContactAssignment).toHaveBeenCalledTimes(1);
    expect(iamApi.addUserToGroup).toHaveBeenCalledWith(
      GROUP_CONTACT,
      { userId: 'cust-uuid', userType: 'CUSTOMER' },
      'service',
    );
    expect(iamApi.addUserToGroup).toHaveBeenCalledWith(
      GROUP_ADMIN,
      { userId: 'cust-uuid', userType: 'CUSTOMER' },
      'service',
    );
    expect(customerManagementApi.createLegalEntityContactAssignment.mock.invocationCallOrder[0]).toBeLessThan(
      iamApi.addUserToGroup.mock.invocationCallOrder[0]!,
    );
    expect(customerManagementApi.deleteContactAssignment).not.toHaveBeenCalled();
    expect(customerAdminApi.deleteCustomer).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      {
        step: 'iam-group',
        customerId: 'cust-uuid',
        legalEntityId: SELECTED_LE,
        groupId: GROUP_ADMIN,
        forbidden: true,
        error: 'Failed to create group assignment: Forbidden',
      },
      'User management IAM group link failed',
    );
  });

  it('throws a predefined-group conflict error when IAM returns the allow-listed conflict prefix on create', async () => {
    iamApi.addUserToGroup.mockImplementation(async (groupId) => {
      if (groupId === GROUP_ADMIN) {
        throw new EmporixApiError({
          operation: 'Add user to group',
          status: 400,
          statusText: 'Bad Request',
          body: JSON.stringify({
            message: 'Cannot assign customer to more than one predefined functional group (existing Admin)',
          }),
        });
      }
      return { id: 'asg-1' };
    });

    await expect(service.createUser(inviteRequest())).rejects.toMatchObject({
      name: 'PredefinedGroupConflictError',
      message: 'Cannot assign customer to more than one predefined functional group',
    });
  });

  it('updates profile and activation, and throws when a later group step fails', async () => {
    mockSelectedLeMember(createdCustomer());
    iamApi.getGroups.mockResolvedValue([
      { id: GROUP_ADMIN, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } },
      { id: GROUP_BUYER, code: 'B2B_BUYER', b2b: { role: 'Buyer', legalEntityId: SELECTED_LE } },
      { id: GROUP_CONTACT, code: 'CONTACT', b2b: { role: 'Contact', legalEntityId: SELECTED_LE } },
    ]);
    iamApi.addUserToGroup.mockRejectedValue(new Error('Failed to create group assignment: Forbidden'));

    await expect(
      service.updateUser('C-100', {
        firstName: 'Grace',
        active: false,
        groupAssignments: [{ legalEntityId: SELECTED_LE, groupId: GROUP_BUYER }],
      }),
    ).rejects.toThrow('User update group or legal-entity sync failed');

    expect(customerAdminApi.updateCustomer).toHaveBeenCalledWith(
      'C-100',
      { firstName: 'Grace', active: false },
      'service',
    );
    expect(sessionService.setLegalEntity).not.toHaveBeenCalled();
  });

  it('throws a predefined-group conflict error when IAM returns the allow-listed conflict prefix on update', async () => {
    mockSelectedLeMember(createdCustomer());
    iamApi.getGroups.mockResolvedValue([
      { id: GROUP_ADMIN, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } },
      { id: GROUP_BUYER, code: 'B2B_BUYER', b2b: { role: 'Buyer', legalEntityId: SELECTED_LE } },
      { id: GROUP_CONTACT, code: 'CONTACT', b2b: { role: 'Contact', legalEntityId: SELECTED_LE } },
    ]);
    iamApi.getUserGroups.mockResolvedValue({
      items: [{ id: GROUP_ADMIN, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } }],
      total: 1,
      page: 1,
      size: 60,
    });
    iamApi.addUserToGroup.mockRejectedValue(
      new EmporixApiError({
        operation: 'Add user to group',
        status: 400,
        statusText: 'Bad Request',
        body: JSON.stringify({
          message: 'Cannot assign customer to more than one predefined functional group for legal entity',
        }),
      }),
    );

    await expect(
      service.updateUser('C-100', {
        groupAssignments: [{ legalEntityId: SELECTED_LE, groupId: GROUP_BUYER }],
      }),
    ).rejects.toBeInstanceOf(PredefinedGroupConflictError);
  });

  it('updates profile and activation for a selected-catalog IAM member without IAM mutation when groups are omitted', async () => {
    const member = createdCustomer();
    mockSelectedLeMember(member);
    iamApi.getUsers.mockResolvedValue({
      items: [{ id: member.id, userType: 'CUSTOMER', groups: [{ id: GROUP_ADMIN }] }],
      totalCount: 1,
    });
    iamApi.getUserGroups.mockImplementation(async (userId: string) => {
      if (userId === adminCustomer.id) {
        return {
          items: [{ id: GROUP_ADMIN, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } }],
          total: 1,
          page: 1,
          size: 60,
        };
      }
      return { items: [], total: 0, page: 1, size: 60 };
    });

    const result = await service.updateUser('C-100', {
      firstName: 'Grace',
      active: false,
    });

    expect(customerAdminApi.updateCustomer).toHaveBeenCalledWith(
      'C-100',
      { firstName: 'Grace', active: false },
      'service',
    );
    expect(customerAdminApi.getCustomer).toHaveBeenCalledWith('C-100', 'service');
    expect(iamApi.addUserToGroup).not.toHaveBeenCalled();
    expect(iamApi.removeUserFromGroup).not.toHaveBeenCalled();
    expect(customerManagementApi.createLegalEntityContactAssignment).not.toHaveBeenCalled();
    expect(customerManagementApi.deleteContactAssignment).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ firstName: 'Grace', active: false, groups: [] }));
  });

  it('clears only selected-LE functional IAM groups, retains CONTACT, and ensures IAM Contact', async () => {
    const member = createdCustomer();
    mockSelectedLeMember(member);
    iamApi.getGroups.mockImplementation(async (params) =>
      params?.query?.includes(OTHER_LE)
        ? [{ id: GROUP_OTHER, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: OTHER_LE } }]
        : [
            { id: GROUP_ADMIN, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } },
            { id: GROUP_CONTACT, code: 'CONTACT', b2b: { role: 'Contact', legalEntityId: SELECTED_LE } },
          ],
    );
    iamApi.getUserGroups.mockResolvedValue({
      items: [
        { id: GROUP_ADMIN, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } },
        { id: GROUP_CONTACT, code: 'CONTACT', b2b: { role: 'Contact', legalEntityId: SELECTED_LE } },
        { id: GROUP_OTHER, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: OTHER_LE } },
      ],
      total: 3,
      page: 1,
      size: 60,
    });

    await service.updateUser('C-100', { groupAssignments: [] });

    expect(iamApi.getUserGroups.mock.calls.every(([, , tokenType]) => tokenType === 'service')).toBe(true);
    expect(iamApi.removeUserFromGroup).toHaveBeenCalledWith(GROUP_ADMIN, 'cust-uuid', 'service');
    expect(iamApi.removeUserFromGroup).not.toHaveBeenCalledWith(GROUP_CONTACT, 'cust-uuid', 'service');
    expect(iamApi.removeUserFromGroup).not.toHaveBeenCalledWith(GROUP_OTHER, 'cust-uuid', 'service');
    expect(iamApi.removeUserFromGroup.mock.calls.map(([groupId]) => groupId)).not.toContain(GROUP_CUSTOMER);
    expect(customerManagementApi.deleteContactAssignment).not.toHaveBeenCalled();
    expect(customerManagementApi.createLegalEntityContactAssignment).not.toHaveBeenCalled();
    expect(iamApi.addUserToGroup).not.toHaveBeenCalled();
  });

  it('ensures IAM Contact on update [] when Contact IAM is missing', async () => {
    const member = createdCustomer();
    mockSelectedLeMember(member);
    iamApi.getUserGroups.mockResolvedValue({
      items: [{ id: GROUP_ADMIN, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } }],
      total: 1,
      page: 1,
      size: 60,
    });

    await service.updateUser('C-100', { groupAssignments: [] });

    expect(iamApi.addUserToGroup).toHaveBeenCalledWith(
      GROUP_CONTACT,
      { userId: 'cust-uuid', userType: 'CUSTOMER' },
      'service',
    );
    expect(iamApi.removeUserFromGroup).toHaveBeenCalledWith(GROUP_ADMIN, 'cust-uuid', 'service');
    expect(iamApi.removeUserFromGroup).not.toHaveBeenCalledWith(GROUP_CONTACT, 'cust-uuid', 'service');
    expect(customerManagementApi.deleteContactAssignment).not.toHaveBeenCalled();
  });

  it('changes only the selected-LE group and preserves an omitted other-LE assignment', async () => {
    const member = createdCustomer();
    mockSelectedLeMember(member);
    iamApi.getGroups.mockImplementation(async (params) =>
      params?.query?.includes(OTHER_LE)
        ? [{ id: GROUP_OTHER, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: OTHER_LE } }]
        : [
            { id: GROUP_ADMIN, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } },
            { id: GROUP_BUYER, code: 'B2B_BUYER', b2b: { role: 'Buyer', legalEntityId: SELECTED_LE } },
            { id: GROUP_CONTACT, code: 'CONTACT', b2b: { role: 'Contact', legalEntityId: SELECTED_LE } },
          ],
    );
    iamApi.getUserGroups.mockResolvedValue({
      items: [
        { id: GROUP_ADMIN, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } },
        { id: GROUP_OTHER, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: OTHER_LE } },
      ],
      total: 2,
      page: 1,
      size: 60,
    });

    await service.updateUser('C-100', {
      groupAssignments: [{ legalEntityId: SELECTED_LE, groupId: GROUP_BUYER }],
    });

    expect(iamApi.addUserToGroup).toHaveBeenCalledWith(
      GROUP_CONTACT,
      { userId: 'cust-uuid', userType: 'CUSTOMER' },
      'service',
    );
    expect(iamApi.addUserToGroup).toHaveBeenCalledWith(
      GROUP_BUYER,
      { userId: 'cust-uuid', userType: 'CUSTOMER' },
      'service',
    );
    const buyerAddOrder = iamApi.addUserToGroup.mock.calls.findIndex(([groupId]) => groupId === GROUP_BUYER);
    expect(iamApi.removeUserFromGroup.mock.invocationCallOrder[0]).toBeLessThan(
      iamApi.addUserToGroup.mock.invocationCallOrder[buyerAddOrder]!,
    );
    expect(iamApi.getUserGroups.mock.calls.every(([, , tokenType]) => tokenType === 'service')).toBe(true);
    expect(iamApi.removeUserFromGroup).toHaveBeenCalledWith(GROUP_ADMIN, 'cust-uuid', 'service');
    expect(iamApi.removeUserFromGroup).not.toHaveBeenCalledWith(GROUP_CONTACT, 'cust-uuid', 'service');
    expect(iamApi.removeUserFromGroup).not.toHaveBeenCalledWith(GROUP_OTHER, 'cust-uuid', 'service');
    expect(customerManagementApi.getContactAssignmentsByLegalEntityId).toHaveBeenCalled();
    expect(customerManagementApi.deleteContactAssignment).not.toHaveBeenCalled();
  });

  it.each([
    ['mismatched', [{ legalEntityId: OTHER_LE, groupId: GROUP_OTHER }]],
    [
      'multiple',
      [
        { legalEntityId: SELECTED_LE, groupId: GROUP_ADMIN },
        { legalEntityId: OTHER_LE, groupId: GROUP_OTHER },
      ],
    ],
  ])('rejects %s update assignments before profile or group mutation', async (_case, groupAssignments) => {
    await expect(
      service.updateUser('C-100', {
        firstName: 'Should not be written',
        groupAssignments,
      }),
    ).rejects.toThrow('Exactly one group assignment for the selected legal entity is required');

    expect(customerAdminApi.updateCustomer).not.toHaveBeenCalled();
    expect(iamApi.addUserToGroup).not.toHaveBeenCalled();
    expect(iamApi.removeUserFromGroup).not.toHaveBeenCalled();
    expect(customerManagementApi.createLegalEntityContactAssignment).not.toHaveBeenCalled();
    expect(customerManagementApi.deleteContactAssignment).not.toHaveBeenCalled();
  });

  it('attaches a Q24 other-Admin-LE member with selected-LE CONTACT then IAM and keeps other-LE groups', async () => {
    const member = createdCustomer();
    mockOtherAdminLeMember(member);
    iamApi.getGroups.mockImplementation(async (params) =>
      params?.query?.includes(OTHER_LE)
        ? [{ id: GROUP_OTHER, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: OTHER_LE } }]
        : [
            { id: GROUP_ADMIN, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } },
            { id: GROUP_BUYER, code: 'B2B_BUYER', b2b: { role: 'Buyer', legalEntityId: SELECTED_LE } },
            { id: GROUP_CONTACT, code: 'CONTACT', b2b: { role: 'Contact', legalEntityId: SELECTED_LE } },
          ],
    );

    await service.updateUser('C-100', {
      groupAssignments: [{ legalEntityId: SELECTED_LE, groupId: GROUP_BUYER }],
    });

    expect(customerManagementApi.createLegalEntityContactAssignment).toHaveBeenCalledWith({
      legalEntity: { id: SELECTED_LE },
      customer: { id: member.id },
    });
    expect(customerManagementApi.createLegalEntityContactAssignment).toHaveBeenCalledTimes(1);
    expect(customerManagementApi.createContactAssignment).not.toHaveBeenCalled();
    expect(iamApi.addUserToGroup).toHaveBeenCalledWith(
      GROUP_CONTACT,
      { userId: member.id, userType: 'CUSTOMER' },
      'service',
    );
    expect(iamApi.addUserToGroup).toHaveBeenCalledWith(
      GROUP_BUYER,
      { userId: member.id, userType: 'CUSTOMER' },
      'service',
    );
    expect(customerManagementApi.createLegalEntityContactAssignment.mock.invocationCallOrder[0]).toBeLessThan(
      iamApi.addUserToGroup.mock.invocationCallOrder[0]!,
    );
    expect(iamApi.getUserGroups).toHaveBeenCalledWith(adminCustomer.id, { size: 60 }, 'service');
    expect(iamApi.getUserGroups.mock.calls.every(([, , tokenType]) => tokenType === 'service')).toBe(true);
    expect(iamApi.removeUserFromGroup).not.toHaveBeenCalled();
    expect(customerManagementApi.deleteContactAssignment).not.toHaveBeenCalled();
    expect(sessionService.setLegalEntity).not.toHaveBeenCalled();
  });

  it('ensures selected-LE CONTACT when saving a Q24 member with empty groupAssignments', async () => {
    const member = createdCustomer();
    mockOtherAdminLeMember(member);

    await service.updateUser('C-100', { groupAssignments: [] });

    expect(customerManagementApi.createLegalEntityContactAssignment).toHaveBeenCalledWith({
      legalEntity: { id: SELECTED_LE },
      customer: { id: member.id },
    });
    expect(iamApi.addUserToGroup).toHaveBeenCalledWith(
      GROUP_CONTACT,
      { userId: member.id, userType: 'CUSTOMER' },
      'service',
    );
    expect(iamApi.removeUserFromGroup).not.toHaveBeenCalledWith(GROUP_OTHER, member.id, 'service');
    expect(customerManagementApi.deleteContactAssignment).not.toHaveBeenCalled();
  });

  it('does not create selected-LE CONTACT when saving a Q24 member with omitted groups', async () => {
    const member = createdCustomer();
    mockOtherAdminLeMember(member);

    await service.updateUser('C-100', { firstName: 'Grace' });

    expect(customerManagementApi.createLegalEntityContactAssignment).not.toHaveBeenCalled();
    expect(customerManagementApi.createContactAssignment).not.toHaveBeenCalled();
    expect(iamApi.addUserToGroup).not.toHaveBeenCalled();
    expect(iamApi.removeUserFromGroup).not.toHaveBeenCalledWith(GROUP_OTHER, member.id, 'service');
    expect(customerManagementApi.deleteContactAssignment).not.toHaveBeenCalled();
  });

  it('rejects update for a user outside selected-LE and other-Admin-LE assignment sets', async () => {
    mockOtherAdminLeMember(createdCustomer({ id: 'cust-other', customerNumber: 'C-OTHER' }));

    await expect(service.updateUser('C-OUT', { firstName: 'Nope' })).rejects.toThrow(
      'Company user not found for the selected legal entity',
    );

    expect(customerAdminApi.updateCustomer).not.toHaveBeenCalled();
    expect(customerManagementApi.createLegalEntityContactAssignment).not.toHaveBeenCalled();
    expect(iamApi.addUserToGroup).not.toHaveBeenCalled();
  });

  it('rejects deleting an IAM-only member without selected-LE assignment (Bambi-style)', async () => {
    mockSelectedLeMember(createdCustomer({ id: 'cust-uuid', customerNumber: 'C-100' }));
    customerManagementApi.getContactAssignmentsByLegalEntityId.mockResolvedValue({ items: [], totalCount: 0 });

    await expect(service.deleteUser('C-100')).rejects.toThrow('Company user not found for the selected legal entity');

    expect(customerAdminApi.deleteCustomer).not.toHaveBeenCalled();
  });

  it('lists assignable groups only for the selected LE and drops CUSTOMER and Contact from pickers', async () => {
    iamApi.getGroups.mockImplementation(async (params) => {
      const query = params?.query ?? '';
      if (query.includes(OTHER_LE)) {
        return [
          { id: GROUP_OTHER, code: 'B2B_BUYER', userType: 'CUSTOMER', b2b: { role: 'Buyer', legalEntityId: OTHER_LE } },
          { id: 'g-cust-other', code: 'CUSTOMER', userType: 'CUSTOMER', b2b: { legalEntityId: OTHER_LE } },
        ];
      }
      return [
        {
          id: GROUP_ADMIN,
          code: 'B2B_ADMIN',
          userType: 'CUSTOMER',
          b2b: { role: 'Admin', legalEntityId: SELECTED_LE },
        },
        {
          id: GROUP_BUYER,
          code: 'B2B_BUYER',
          userType: 'CUSTOMER',
          b2b: { role: 'Buyer', legalEntityId: SELECTED_LE },
        },
        {
          id: 'g-requestor',
          code: 'B2B_REQUESTER',
          userType: 'CUSTOMER',
          b2b: { role: 'Requester', legalEntityId: SELECTED_LE },
        },
        {
          id: GROUP_CONTACT,
          code: 'CONTACT',
          userType: 'CUSTOMER',
          b2b: { role: 'Contact', legalEntityId: SELECTED_LE },
        },
        { id: GROUP_CUSTOMER, code: 'CUSTOMER', userType: 'CUSTOMER', b2b: { legalEntityId: SELECTED_LE } },
      ];
    });

    const result = await service.listAssignableGroups();

    expect(iamApi.getGroups).toHaveBeenCalledWith(
      { query: `b2b.legalEntityId:"${SELECTED_LE}"`, criteria: { userType: 'CUSTOMER' } },
      'service',
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.groups.map((group) => group.id)).toEqual([GROUP_ADMIN, GROUP_BUYER, 'g-requestor']);
    expect(result[0]?.groups.map((group) => group.displayName)).toEqual([
      'Acme - Admin',
      'Acme - Buyer',
      'Acme - Requestor',
    ]);
    expect(iamApi.getGroups).toHaveBeenCalledTimes(1);
    expect(iamApi.getGroups.mock.calls[0]?.[0]?.query).not.toContain(OTHER_LE);
    expect(result.flatMap((entry) => entry.groups.map((group) => group.id))).not.toContain(GROUP_CUSTOMER);
    expect(result.flatMap((entry) => entry.groups.map((group) => group.id))).not.toContain(GROUP_CONTACT);
  });

  it('labels custom assignable groups from the localized IAM name for the session language', async () => {
    sessionService.getCurrent.mockResolvedValue({
      id: 'session-1',
      currency: 'EUR',
      siteCode: 'main',
      legalEntityId: SELECTED_LE,
      language: 'de',
    });
    iamApi.getGroups.mockResolvedValue([
      {
        id: GROUP_ADMIN,
        code: 'B2B_ADMIN',
        name: { en: 'Administrator', de: 'Administrator' },
        userType: 'CUSTOMER',
        b2b: { role: 'Admin', legalEntityId: SELECTED_LE },
      },
      {
        id: 'promo_manager',
        name: { en: 'Promo Manager', de: 'Aktionsmanager' },
        userType: 'CUSTOMER',
        b2b: { legalEntityId: SELECTED_LE },
      },
    ]);

    const result = await service.listAssignableGroups();

    expect(result[0]?.groups.map((group) => group.displayName)).toEqual(['Acme - Admin', 'Acme - Aktionsmanager']);
  });

  it('keeps service-token query-scoped groups when the response omits LE metadata', async () => {
    companyService.getCompanies.mockResolvedValue([{ id: SELECTED_LE, name: 'Acme' }]);
    iamApi.getGroups.mockResolvedValue([
      { id: GROUP_ADMIN, code: 'B2B_ADMIN', userType: 'CUSTOMER', b2b: { role: 'Admin' } },
      { id: GROUP_CUSTOMER, code: 'CUSTOMER', userType: 'CUSTOMER' },
      { id: 'employee-group', code: 'B2B_ADMIN', userType: 'EMPLOYEE' },
    ]);

    const result = await service.listAssignableGroups();

    const query = { query: `b2b.legalEntityId:"${SELECTED_LE}"`, criteria: { userType: 'CUSTOMER' as const } };
    expect(iamApi.getGroups).toHaveBeenCalledTimes(1);
    expect(iamApi.getGroups).toHaveBeenCalledWith(query, 'service');
    expect(result[0]?.groups).toEqual([
      {
        id: GROUP_ADMIN,
        legalEntityId: SELECTED_LE,
        legalEntityName: 'Acme',
        displayName: 'Acme - Admin',
      },
    ]);
  });

  it('surfaces a forbidden service-token assignable-group request', async () => {
    companyService.getCompanies.mockResolvedValue([{ id: SELECTED_LE, name: 'Acme' }]);
    iamApi.getGroups.mockRejectedValue(new Error('Failed to retrieve groups: Forbidden'));

    const query = { query: `b2b.legalEntityId:"${SELECTED_LE}"`, criteria: { userType: 'CUSTOMER' as const } };
    await expect(service.listAssignableGroups()).rejects.toThrow('Forbidden');
    expect(sessionService.setLegalEntity).toHaveBeenCalledTimes(1);
    expect(sessionService.setLegalEntity).toHaveBeenCalledWith(SELECTED_LE);
    expect(iamApi.getGroups).toHaveBeenCalledTimes(2);
    expect(iamApi.getGroups).toHaveBeenCalledWith(query, 'service');
  });

  function inviteRequest(
    overrides: Partial<{
      active: boolean;
      groupAssignments: { legalEntityId: string; groupId: string }[];
    }> = {},
  ) {
    return {
      title: 'MS',
      firstName: 'Ada',
      lastName: 'Lovelace',
      contactEmail: 'ada@example.com',
      contactPhone: '+1-555-0100',
      active: false,
      groupAssignments: [{ legalEntityId: SELECTED_LE, groupId: GROUP_ADMIN }],
      ...overrides,
    };
  }

  function mockSelectedLeMember(member: EmporixCustomerAdmin): void {
    customerAdminApi.getCustomer.mockResolvedValue(member);
    customerAdminApi.getCustomers.mockResolvedValue({ items: [member] });
    customerManagementApi.getContactAssignmentsByLegalEntityId.mockResolvedValue({
      items: [
        { id: `ca-${member.id}`, legalEntity: { id: SELECTED_LE }, customer: { id: member.id }, type: 'CONTACT' },
      ],
      totalCount: 1,
    });
  }

  function mockOtherAdminLeMember(member: EmporixCustomerAdmin): void {
    customerAdminApi.getCustomer.mockResolvedValue(member);
    customerAdminApi.getCustomers.mockResolvedValue({ items: [member] });
    customerManagementApi.getContactAssignmentsByLegalEntityId.mockImplementation(async (legalEntityId) => {
      if (legalEntityId === OTHER_LE) {
        return {
          items: [
            {
              id: `ca-other-${member.id}`,
              legalEntity: { id: OTHER_LE },
              customer: { id: member.id },
              type: 'CONTACT',
            },
          ],
          totalCount: 1,
        };
      }
      return { items: [], totalCount: 0 };
    });
    iamApi.getUserGroups.mockImplementation(async (userId) => {
      if (userId === adminCustomer.id) {
        return {
          items: [
            { id: GROUP_ADMIN, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: SELECTED_LE } },
            { id: GROUP_OTHER, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: OTHER_LE } },
          ],
          total: 2,
          page: 1,
          size: 60,
        };
      }
      return {
        items: [{ id: GROUP_OTHER, code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: OTHER_LE } }],
        total: 1,
        page: 1,
        size: 60,
      };
    });
  }
});
