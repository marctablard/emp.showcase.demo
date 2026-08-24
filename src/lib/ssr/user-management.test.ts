import type { Customer } from '@/platform/services/model/customer/customer';
import { CustomerRole } from '@/platform/services/model/customer/roles';
import type { CompanyUser } from '@/platform/services/model/user-management/company-user';
import {
  getCompanyUserById,
  getCompanyUsers,
  getHeaderCompanies,
  getSelectedCompanyName,
  hasMultipleCompanies,
  requireB2bAdmin,
} from './user-management';

jest.mock('next/navigation', () => ({
  redirect: jest.fn((href: string): never => {
    throw new Error(`REDIRECT:${href}`);
  }),
}));

jest.mock('@/lib/ssr/customer', () => ({
  getCurrentCustomer: jest.fn(),
}));

jest.mock('@/lib/ssr/session', () => ({
  getSession: jest.fn(),
}));

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

const { redirect } = jest.requireMock('next/navigation') as {
  redirect: jest.Mock;
};

const mockedSsr = jest.requireMock('@/platform/ssr') as {
  default: { get: jest.Mock; __services: Map<string, unknown> };
};

const { getCurrentCustomer } = jest.requireMock('@/lib/ssr/customer') as {
  getCurrentCustomer: jest.Mock;
};

const { getSession } = jest.requireMock('@/lib/ssr/session') as {
  getSession: jest.Mock;
};

const adminCustomer: Customer = {
  id: 'cust-admin',
  email: 'admin@example.com',
  roles: [CustomerRole.B2B, CustomerRole.B2B_ADMIN],
};

const buyerCustomer: Customer = {
  id: 'cust-buyer',
  email: 'buyer@example.com',
  roles: [CustomerRole.B2B, CustomerRole.B2B_BUYER],
};

const companyUser: CompanyUser = {
  id: 'C-100',
  firstName: 'Ada',
  lastName: 'Lovelace',
  contactEmail: 'ada@example.com',
  active: true,
  groups: [],
};

describe('requireB2bAdmin', () => {
  beforeEach(() => {
    redirect.mockReset();
    redirect.mockImplementation((href: string): never => {
      throw new Error(`REDIRECT:${href}`);
    });
    getCurrentCustomer.mockReset();
  });

  it('redirects to /account when the customer is null (unauthenticated nested routes are not proxy-gated)', async () => {
    getCurrentCustomer.mockResolvedValueOnce(null);

    await expect(requireB2bAdmin()).rejects.toThrow('REDIRECT:/account');
    expect(redirect).toHaveBeenCalledWith('/account');
  });

  it('redirects to /account when roles lack B2B_ADMIN', async () => {
    getCurrentCustomer.mockResolvedValueOnce(buyerCustomer);

    await expect(requireB2bAdmin()).rejects.toThrow('REDIRECT:/account');
    expect(redirect).toHaveBeenCalledWith('/account');
  });

  it('returns the customer when roles include B2B_ADMIN', async () => {
    getCurrentCustomer.mockResolvedValueOnce(adminCustomer);

    await expect(requireB2bAdmin()).resolves.toEqual(adminCustomer);
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe('getCompanyUsers', () => {
  const userManagementService = {
    listUsers: jest.fn(),
    getUser: jest.fn(),
  };

  const logger = {
    error: jest.fn(),
  };

  beforeEach(() => {
    userManagementService.listUsers.mockReset();
    userManagementService.getUser.mockReset();
    logger.error.mockReset();
    mockedSsr.default.__services.clear();
    mockedSsr.default.__services.set('UserManagementService', userManagementService);
    mockedSsr.default.__services.set('LoggerService', logger);
    mockedSsr.default.get.mockImplementation((id: string) => mockedSsr.default.__services.get(id));
  });

  it('loads users via UserManagementService without fetching /api', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    userManagementService.listUsers.mockResolvedValueOnce({ items: [companyUser], totalCount: 1 });

    const result = await getCompanyUsers(2, 5, 'firstName:asc', 'Ada');

    expect(result).toEqual({ items: [companyUser], totalCount: 1 });
    expect(userManagementService.listUsers).toHaveBeenCalledWith(2, 5, 'firstName:asc', 'Ada');
    expect(mockedSsr.default.get).toHaveBeenCalledWith('UserManagementService');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('returns undefined and logs when the service call fails', async () => {
    userManagementService.listUsers.mockRejectedValueOnce(new Error('boom'));

    const result = await getCompanyUsers(1, 5);

    expect(result).toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('getCompanyUserById', () => {
  const userManagementService = {
    listUsers: jest.fn(),
    getUser: jest.fn(),
  };

  const logger = {
    error: jest.fn(),
  };

  beforeEach(() => {
    userManagementService.listUsers.mockReset();
    userManagementService.getUser.mockReset();
    logger.error.mockReset();
    mockedSsr.default.__services.clear();
    mockedSsr.default.__services.set('UserManagementService', userManagementService);
    mockedSsr.default.__services.set('LoggerService', logger);
    mockedSsr.default.get.mockImplementation((id: string) => mockedSsr.default.__services.get(id));
  });

  it('loads a user via UserManagementService without fetching /api', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    userManagementService.getUser.mockResolvedValueOnce(companyUser);

    const result = await getCompanyUserById('C-100');

    expect(result).toEqual(companyUser);
    expect(userManagementService.getUser).toHaveBeenCalledWith('C-100');
    expect(mockedSsr.default.get).toHaveBeenCalledWith('UserManagementService');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('returns undefined and logs when the service call fails', async () => {
    userManagementService.getUser.mockRejectedValueOnce(new Error('boom'));

    const result = await getCompanyUserById('missing');

    expect(result).toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('hasMultipleCompanies', () => {
  const companyService = {
    getCompanies: jest.fn(),
  };
  const userManagementService = {
    listOtherCompanyUsers: jest.fn(),
    listUsers: jest.fn(),
  };
  const logger = {
    error: jest.fn(),
  };

  beforeEach(() => {
    companyService.getCompanies.mockReset();
    userManagementService.listOtherCompanyUsers.mockReset();
    userManagementService.listUsers.mockReset();
    logger.error.mockReset();
    mockedSsr.default.__services.clear();
    mockedSsr.default.__services.set('CompanyService', companyService);
    mockedSsr.default.__services.set('UserManagementService', userManagementService);
    mockedSsr.default.__services.set('LoggerService', logger);
    mockedSsr.default.get.mockImplementation((id: string) => mockedSsr.default.__services.get(id));
  });

  it('returns true when the customer has more than one company without listing other-company users', async () => {
    companyService.getCompanies.mockResolvedValueOnce([
      { id: 'le-1', name: 'Acme' },
      { id: 'le-2', name: 'Beta' },
    ]);

    await expect(hasMultipleCompanies()).resolves.toBe(true);
    expect(companyService.getCompanies).toHaveBeenCalledTimes(1);
    expect(userManagementService.listOtherCompanyUsers).not.toHaveBeenCalled();
    expect(userManagementService.listUsers).not.toHaveBeenCalled();
  });

  it('returns false when the customer has one company', async () => {
    companyService.getCompanies.mockResolvedValueOnce([{ id: 'le-1', name: 'Acme' }]);

    await expect(hasMultipleCompanies()).resolves.toBe(false);
    expect(userManagementService.listOtherCompanyUsers).not.toHaveBeenCalled();
  });

  it('returns false and logs when getCompanies fails', async () => {
    companyService.getCompanies.mockRejectedValueOnce(new Error('boom'));

    await expect(hasMultipleCompanies()).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalled();
    expect(userManagementService.listOtherCompanyUsers).not.toHaveBeenCalled();
  });
});

describe('getHeaderCompanies', () => {
  const companyService = {
    getCompanies: jest.fn(),
  };
  const logger = {
    error: jest.fn(),
  };

  beforeEach(() => {
    companyService.getCompanies.mockReset();
    logger.error.mockReset();
    mockedSsr.default.__services.clear();
    mockedSsr.default.__services.set('CompanyService', companyService);
    mockedSsr.default.__services.set('LoggerService', logger);
    mockedSsr.default.get.mockImplementation((id: string) => mockedSsr.default.__services.get(id));
  });

  it('returns id and name from getCompanies without Date fields or fetching /api', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const updatedAt = new Date('2026-01-15T00:00:00.000Z');
    companyService.getCompanies.mockResolvedValueOnce([
      { id: 'le-1', name: 'NovaTech', onboarding: { status: 'approved', updatedAt } },
      { id: 'le-2', name: 'Emporix GmbH' },
    ]);

    const result = await getHeaderCompanies();

    expect(result).toEqual([
      { id: 'le-1', name: 'NovaTech' },
      { id: 'le-2', name: 'Emporix GmbH' },
    ]);
    expect(result[0]).not.toHaveProperty('onboarding');
    expect(mockedSsr.default.get).toHaveBeenCalledWith('CompanyService');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('returns an empty array and logs when getCompanies fails', async () => {
    companyService.getCompanies.mockRejectedValueOnce(new Error('boom'));

    await expect(getHeaderCompanies()).resolves.toEqual([]);
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('getSelectedCompanyName', () => {
  const companyService = {
    getCompanies: jest.fn(),
  };
  const logger = {
    error: jest.fn(),
  };

  beforeEach(() => {
    companyService.getCompanies.mockReset();
    logger.error.mockReset();
    getSession.mockReset();
    mockedSsr.default.__services.clear();
    mockedSsr.default.__services.set('CompanyService', companyService);
    mockedSsr.default.__services.set('LoggerService', logger);
    mockedSsr.default.get.mockImplementation((id: string) => mockedSsr.default.__services.get(id));
  });

  it('returns the session legal-entity name when it is in getCompanies', async () => {
    companyService.getCompanies.mockResolvedValueOnce([
      { id: 'le-1', name: 'NovaTech' },
      { id: 'le-2', name: 'Emporix GmbH' },
    ]);
    getSession.mockResolvedValueOnce({ legalEntityId: 'le-2' });

    await expect(getSelectedCompanyName()).resolves.toBe('Emporix GmbH');
  });

  it('falls back to the first company name when session legalEntityId is missing', async () => {
    companyService.getCompanies.mockResolvedValueOnce([
      { id: 'le-1', name: 'NovaTech' },
      { id: 'le-2', name: 'Emporix GmbH' },
    ]);
    getSession.mockResolvedValueOnce({});

    await expect(getSelectedCompanyName()).resolves.toBe('NovaTech');
  });

  it('returns undefined when there are no companies', async () => {
    companyService.getCompanies.mockResolvedValueOnce([]);
    getSession.mockResolvedValueOnce({ legalEntityId: 'le-1' });

    await expect(getSelectedCompanyName()).resolves.toBeUndefined();
    expect(getSession).not.toHaveBeenCalled();
  });
});
