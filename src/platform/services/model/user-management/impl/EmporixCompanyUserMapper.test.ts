import type { EmporixCustomerAdmin } from '@/platform/integrations/emporix/model/customer';
import type { EmporixGroup } from '@/platform/integrations/emporix/model/iam';
import EmporixCompanyUserMapper from './EmporixCompanyUserMapper';

describe('EmporixCompanyUserMapper', () => {
  const mapper = new EmporixCompanyUserMapper();

  const customer: EmporixCustomerAdmin = {
    id: 'cust-uuid-1',
    customerNumber: 'C-100',
    title: 'MS',
    firstName: 'Ada',
    lastName: 'Lovelace',
    contactEmail: 'ada@example.com',
    contactPhone: '+1-555-0100',
    active: true,
    metadataCreatedAt: '2026-01-15T00:00:00.000Z',
  };

  it('sets CompanyUser.id to customerNumber, not the resource id', () => {
    const mapped = mapper.mapToService(customer, {
      groups: [],
      companyNameByLegalEntityId: new Map(),
    });

    expect(mapped.id).toBe('C-100');
    expect(mapped.id).not.toBe('cust-uuid-1');
    expect(mapped.firstName).toBe('Ada');
    expect(mapped.lastName).toBe('Lovelace');
    expect(mapped.contactEmail).toBe('ada@example.com');
    expect(mapped.contactPhone).toBe('+1-555-0100');
    expect(mapped.active).toBe(true);
    expect(mapped.createdAt).toBe('2026-01-15T00:00:00.000Z');
    expect(mapped).not.toHaveProperty('password');
  });

  it('falls back to id when customerNumber is empty', () => {
    const mapped = mapper.mapToService(
      { ...customer, customerNumber: '' },
      { groups: [], companyNameByLegalEntityId: new Map() },
    );

    expect(mapped.id).toBe('cust-uuid-1');
  });

  it('uses metadata.createdAt when metadataCreatedAt is absent', () => {
    const mapped = mapper.mapToService(
      { ...customer, metadataCreatedAt: undefined, metadata: { createdAt: '2025-12-01T00:00:00.000Z', version: 1 } },
      { groups: [], companyNameByLegalEntityId: new Map() },
    );

    expect(mapped.createdAt).toBe('2025-12-01T00:00:00.000Z');
  });

  it('drops CUSTOMER groups and labels remaining groups as {company} - {role}', () => {
    const groups: EmporixGroup[] = [
      { id: 'g-customer', code: 'CUSTOMER', b2b: { role: 'Buyer', legalEntityId: 'le-1' } },
      { id: 'g-admin', code: 'B2B_ADMIN', b2b: { role: 'Admin', legalEntityId: 'le-1' } },
      { id: 'g-buyer', code: 'B2B_BUYER', b2b: { role: 'Buyer', legalEntityId: 'le-1' } },
      { id: 'g-req', code: 'B2B_REQUESTER', b2b: { role: 'Requester', legalEntityId: 'le-2' } },
      { id: 'g-contact', code: 'CONTACT', b2b: { role: 'Contact', legalEntityId: 'le-1' } },
      { id: 'g-custom', code: 'WAREHOUSE', b2b: { legalEntityId: 'le-1' } },
    ];

    const mapped = mapper.mapToService(customer, {
      groups,
      companyNameByLegalEntityId: new Map([
        ['le-1', 'Acme'],
        ['le-2', 'Acme East'],
      ]),
    });

    expect(mapped.groups.map((group) => group.id)).not.toContain('g-customer');
    expect(mapped.groups).toEqual([
      { id: 'g-admin', legalEntityId: 'le-1', displayName: 'Acme - Admin' },
      { id: 'g-buyer', legalEntityId: 'le-1', displayName: 'Acme - Buyer' },
      { id: 'g-req', legalEntityId: 'le-2', displayName: 'Acme East - Requestor' },
      { id: 'g-contact', legalEntityId: 'le-1', displayName: 'Acme - Contact' },
      { id: 'g-custom', legalEntityId: 'le-1', displayName: 'Acme - WAREHOUSE' },
    ]);
  });

  it('uses the localized IAM name for custom groups and keeps Jira labels for predefined roles', () => {
    const groups: EmporixGroup[] = [
      {
        id: 'g-admin',
        code: 'B2B_ADMIN',
        name: { en: 'Administrator', de: 'Administrator' },
        b2b: { role: 'Admin', legalEntityId: 'le-1' },
      },
      {
        id: 'promo_manager',
        name: { en: 'Promo Manager', de: 'Aktionsmanager' },
        b2b: { legalEntityId: 'le-1' },
      },
      {
        id: 'g-string-name',
        name: 'Warehouse Staff',
        b2b: { legalEntityId: 'le-1' },
      },
    ];

    const mapped = mapper.mapToService(customer, {
      groups,
      companyNameByLegalEntityId: new Map([['le-1', 'Acme']]),
      locale: 'de',
    });

    expect(mapped.groups).toEqual([
      { id: 'g-admin', legalEntityId: 'le-1', displayName: 'Acme - Admin' },
      { id: 'promo_manager', legalEntityId: 'le-1', displayName: 'Acme - Aktionsmanager' },
      { id: 'g-string-name', legalEntityId: 'le-1', displayName: 'Acme - Warehouse Staff' },
    ]);
  });

  it('sets optional legalEntityId and legalEntityName only when mapping context provides them', () => {
    const withoutLegalEntity = mapper.mapToService(customer, {
      groups: [],
      companyNameByLegalEntityId: new Map(),
    });
    expect(withoutLegalEntity).not.toHaveProperty('legalEntityId');
    expect(withoutLegalEntity).not.toHaveProperty('legalEntityName');

    const withLegalEntity = mapper.mapToService(customer, {
      groups: [],
      companyNameByLegalEntityId: new Map([['le-other', 'Other Co']]),
      legalEntityId: 'le-other',
      legalEntityName: 'Other Co',
    });
    expect(withLegalEntity.legalEntityId).toBe('le-other');
    expect(withLegalEntity.legalEntityName).toBe('Other Co');
  });

  it('sets isSelectedLegalEntityMember only when mapping context provides it', () => {
    const omitted = mapper.mapToService(customer, {
      groups: [],
      companyNameByLegalEntityId: new Map(),
    });
    expect(omitted).not.toHaveProperty('isSelectedLegalEntityMember');

    const selectedMember = mapper.mapToService(customer, {
      groups: [],
      companyNameByLegalEntityId: new Map(),
      isSelectedLegalEntityMember: true,
    });
    expect(selectedMember.isSelectedLegalEntityMember).toBe(true);

    const otherLeMember = mapper.mapToService(customer, {
      groups: [],
      companyNameByLegalEntityId: new Map(),
      isSelectedLegalEntityMember: false,
    });
    expect(otherLeMember.isSelectedLegalEntityMember).toBe(false);
  });
});
