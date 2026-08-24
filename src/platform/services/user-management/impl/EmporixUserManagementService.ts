import { inject } from 'inversify';
import { USERS_PER_PAGE } from '@/components/account/account-table-constants';
import { injectable } from '@/platform/core/di/injectable';
import { isEmporixApiError } from '@/platform/integrations/emporix/common/EmporixApiError';
import type { EmporixCustomerAdminApi } from '@/platform/integrations/emporix/customer/EmporixCustomerAdminApi';
import type { EmporixCustomerManagementApi } from '@/platform/integrations/emporix/customer/EmporixCustomerManagementApi';
import type { EmporixIamApi } from '@/platform/integrations/emporix/iam/EmporixIamApi';
import type {
  EmporixContactAssignment,
  EmporixCustomerAdmin,
  EmporixCustomerAdminCreateRequest,
  EmporixCustomerAdminUpdateRequest,
  EmporixCustomerGroup,
} from '@/platform/integrations/emporix/model/customer';
import type { EmporixGroup, EmporixIamGroupUserAssignment } from '@/platform/integrations/emporix/model/iam';
import type { CompanyService } from '@/platform/services/company/CompanyService';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { CustomerRole } from '@/platform/services/model/customer/roles';
import type {
  AssignableCompanyUserGroup,
  AssignableLegalEntityGroups,
  CompanyUser,
  CompanyUserGroupAssignment,
  CompanyUserListResult,
  CreateCompanyUserRequest,
  CreateCompanyUserResult,
  UpdateCompanyUserRequest,
} from '@/platform/services/model/user-management/company-user';
import { CONTACT_ONLY_GROUP_ID } from '@/platform/services/model/user-management/contact-only';
import type EmporixCompanyUserMapper from '@/platform/services/model/user-management/impl/EmporixCompanyUserMapper';
import type { SessionService } from '@/platform/services/session';
import type { UserManagementService } from '../UserManagementService';
import { AdminRequiredError, PredefinedGroupConflictError } from '../errors';

const DEFAULT_PAGE_NUMBER = 1;
const DEFAULT_PAGE_SIZE = USERS_PER_PAGE;
const ASSIGNMENT_PAGE_SIZE = 60;
const GROUP_USERS_PAGE_SIZE = 60;
const MAX_PAGES_WITHOUT_TOTAL = 100;
const ID_QUERY_CHUNK_SIZE = 50;
const GET_BY_ID_BATCH_SIZE = 5;
/** Showcase in-memory bound (Q11). Stop rather than dump an unbounded selected-LE set. */
const MAX_SELECTED_LE_USERS = 500;
const SERVICE_TOKEN = 'service' as const;
const CUSTOMER_GROUP_CODE = 'CUSTOMER';
const CUSTOMER_SERVICE_LANGUAGE_BY_STOREFRONT_LOCALE: Readonly<Record<string, string>> = {
  en: 'en_US',
  de: 'de_DE',
};
const PREDEFINED_GROUP_CODES = new Set(['B2B_ADMIN', 'B2B_BUYER', 'B2B_REQUESTER']);
const PREDEFINED_GROUP_ROLES = new Set(['Admin', 'Buyer', 'Requester', 'Requestor']);
const PREDEFINED_GROUP_CONFLICT_PREFIX = 'Cannot assign customer to more than one predefined functional group';

const DISPLAY_NAME_STUB_CUSTOMER: EmporixCustomerAdmin = {
  id: 'display-name-stub',
  customerNumber: 'display-name-stub',
  firstName: '',
  lastName: '',
  contactEmail: '',
  active: false,
};

const SORT_ALLOW_LIST = ['firstName', 'lastName', 'contactEmail', 'metadataCreatedAt', 'active'] as const;
type CompanyUserSortField = (typeof SORT_ALLOW_LIST)[number];
type UserManagementSession = {
  legalEntityId?: unknown;
  siteCode?: string;
  language?: string;
  currency?: string;
};
type WriteLegalEntity = {
  id: string;
  name: string;
  sessionLegalEntityId: string;
  profileFirstLegalEntityId?: string;
};
type CombinedAdminLeAssignmentRow = {
  customer: EmporixCustomerAdmin;
  legalEntityId: string;
  legalEntityName: string;
};
type ContactCatalogGroup = EmporixGroup & { id: string };
type SelectedLegalEntityPicker =
  | { kind: 'functional'; assignment: CompanyUserGroupAssignment; contactGroup: ContactCatalogGroup }
  | { kind: 'contact-only'; contactGroup: ContactCatalogGroup };
type ReadableCompanyUser = {
  customer: EmporixCustomerAdmin;
  isSelectedLegalEntityMember: boolean;
};

/** Selected-LE company-user list/get via contact assignments + IAM group-user join. */
@injectable('UserManagementService', 'Singleton')
export class EmporixUserManagementService implements UserManagementService {
  constructor(
    @inject('EmporixCustomerAdminApi') private readonly customerAdminApi: EmporixCustomerAdminApi,
    @inject('EmporixCustomerManagementApi') private readonly customerManagementApi: EmporixCustomerManagementApi,
    @inject('EmporixIamApi') private readonly iamApi: EmporixIamApi,
    @inject('EmporixCompanyUserMapper') private readonly mapper: EmporixCompanyUserMapper,
    @inject('CompanyService') private readonly companyService: CompanyService,
    @inject('CustomerService') private readonly customerService: CustomerService,
    @inject('SessionService') private readonly sessionService: SessionService,
    @inject('LoggerService') private readonly logger: LoggerService,
  ) {}

  async listUsers(
    pageNumber: number = DEFAULT_PAGE_NUMBER,
    pageSize: number = DEFAULT_PAGE_SIZE,
    sort?: string,
    query?: string,
  ): Promise<CompanyUserListResult> {
    await this.assertB2bAdmin();
    const session = await this.sessionService.getCurrent();
    const selectedLegalEntity = await this.requireWriteLegalEntity(session);
    const { assignments, memberIds } = await this.collectAssignmentCustomerIds(selectedLegalEntity.id);
    if (memberIds.size === 0) {
      return { items: [], totalCount: 0 };
    }
    const selectedGroupById = await this.resolveSelectedLegalEntityCatalogGroups(selectedLegalEntity.id, assignments);

    const companyNameByLegalEntityId = new Map([[selectedLegalEntity.id, selectedLegalEntity.name]]);
    const hydrated = await this.hydrateSelectedLegalEntityCustomers(memberIds);

    const tokens = tokenizeNameQuery(query);
    const matching =
      tokens.length === 0 ? hydrated : hydrated.filter((customer) => matchesNameTokens(customer, tokens));
    const sorted = sortCustomers(matching, sort);

    const safePageNumber = pageNumber >= 1 ? pageNumber : DEFAULT_PAGE_NUMBER;
    const safePageSize = pageSize >= 1 ? pageSize : DEFAULT_PAGE_SIZE;
    const start = (safePageNumber - 1) * safePageSize;
    const page = sorted.slice(start, start + safePageSize);
    const selectedGroupsByMemberId = await this.joinCatalogGroupsForResultPage(page, selectedGroupById);
    const groupsByCustomerId = new Map<EmporixCustomerAdmin['id'], EmporixGroup[]>(
      page.map((customer) => [
        customer.id,
        catalogGroupsForSourceLegalEntity(customer, selectedGroupsByMemberId, selectedLegalEntity.id),
      ]),
    );

    this.logger.info(
      {
        selectedLegalEntityUserCount: memberIds.size,
        matchedCount: matching.length,
        pageNumber: safePageNumber,
        pageSize: safePageSize,
        resultIds: page.map((customer) => customer.customerNumber || customer.id),
      },
      'User management permitted-company list',
    );

    return {
      items: page.map((customer) =>
        this.mapper.mapToService(customer, {
          groups: groupsByCustomerId.get(customer.id) ?? [],
          companyNameByLegalEntityId,
        }),
      ),
      totalCount: matching.length,
    };
  }

  async listOtherCompanyUsers(
    pageNumber: number = DEFAULT_PAGE_NUMBER,
    pageSize: number = DEFAULT_PAGE_SIZE,
    sort?: string,
    query?: string,
  ): Promise<CompanyUserListResult> {
    await this.assertB2bAdmin();
    const [session, currentCustomer] = await Promise.all([
      this.sessionService.getCurrent(),
      this.customerService.getCustomer(),
    ]);
    if (!currentCustomer) {
      throw new AdminRequiredError();
    }
    const selectedLegalEntity = await this.requireWriteLegalEntity(session);
    const { adminLegalEntityIds, assignments, memberIdsByLegalEntityId } =
      await this.collectCombinedAdminLegalEntityAssignments(currentCustomer.id);
    if (adminLegalEntityIds.length === 0) {
      return { items: [], totalCount: 0 };
    }

    const allMemberIds = new Set<string>();
    for (const memberIds of memberIdsByLegalEntityId.values()) {
      for (const memberId of memberIds) {
        allMemberIds.add(memberId);
      }
    }
    if (allMemberIds.size === 0) {
      return { items: [], totalCount: 0 };
    }

    const hydrated = await this.hydrateSelectedLegalEntityCustomers(allMemberIds);
    const companyNameByLegalEntityId = await this.companyNamesForLegalEntityIds(adminLegalEntityIds);
    const legalEntityNameById = legalEntityNamesForCombinedList(
      adminLegalEntityIds,
      assignments,
      companyNameByLegalEntityId,
    );
    const rows = expandCombinedAdminLeRows(
      memberIdsByLegalEntityId,
      indexCustomersByMembershipKey(hydrated),
      legalEntityNameById,
    );
    const bounded = [...rows].sort(compareCombinedAdminLeRows).slice(0, MAX_SELECTED_LE_USERS);
    const tokens = tokenizeNameQuery(query);
    const matching = tokens.length === 0 ? bounded : bounded.filter((row) => matchesNameTokens(row.customer, tokens));
    const sorted = sortCombinedAdminLeRows(matching, sort);
    const safePageNumber = pageNumber >= 1 ? pageNumber : DEFAULT_PAGE_NUMBER;
    const safePageSize = pageSize >= 1 ? pageSize : DEFAULT_PAGE_SIZE;
    const start = (safePageNumber - 1) * safePageSize;
    const page = sorted.slice(start, start + safePageSize);
    if (page.length === 0) {
      return { items: [], totalCount: matching.length };
    }

    const pageLegalEntityIds = [...new Set(page.map((row) => row.legalEntityId))];
    const pageAssignments = assignments.filter((assignment) => pageLegalEntityIds.includes(assignment.legalEntity?.id));
    const selectedGroupById = await this.resolveCatalogGroupsForLegalEntities(pageLegalEntityIds, pageAssignments);
    const uniquePageCustomers = dedupeCustomersByMembershipKeys(page.map((row) => row.customer));
    const selectedGroupsByMemberId = await this.joinCatalogGroupsForResultPage(uniquePageCustomers, selectedGroupById);

    this.logger.info(
      {
        selectedLegalEntityId: selectedLegalEntity.id,
        adminLegalEntityIds,
        boundedRowCount: bounded.length,
        matchedCount: matching.length,
        pageNumber: safePageNumber,
        pageSize: safePageSize,
        resultIds: page.map((row) => row.customer.customerNumber || row.customer.id),
      },
      'User management combined Admin-LE list',
    );

    return {
      items: page.map((row) =>
        this.mapper.mapToService(row.customer, {
          groups: catalogGroupsForSourceLegalEntity(row.customer, selectedGroupsByMemberId, row.legalEntityId),
          companyNameByLegalEntityId,
          legalEntityId: row.legalEntityId,
          legalEntityName: row.legalEntityName,
        }),
      ),
      totalCount: matching.length,
    };
  }

  async getUser(userId: string): Promise<CompanyUser | undefined> {
    await this.assertB2bAdmin();
    const [session, currentCustomer] = await Promise.all([
      this.sessionService.getCurrent(),
      this.customerService.getCustomer(),
    ]);
    if (!currentCustomer) {
      throw new AdminRequiredError();
    }
    const selectedLegalEntity = await this.requireWriteLegalEntity(session);
    const readable = await this.findReadableCustomer(userId, selectedLegalEntity.id, currentCustomer.id);
    return readable
      ? this.mapCustomer(readable.customer, { isSelectedLegalEntityMember: readable.isSelectedLegalEntityMember })
      : undefined;
  }

  async createUser(user: CreateCompanyUserRequest): Promise<CreateCompanyUserResult> {
    await this.assertB2bAdmin();

    const session = await this.sessionService.getCurrent();
    const selectedLegalEntity = await this.requireWriteLegalEntity(session);
    const picker = await this.resolveSelectedLegalEntityPicker(user.groupAssignments, selectedLegalEntity.id);
    const customer = await this.createInvitedCustomerProfile(user, selectedLegalEntity, session);
    const companyNameByLegalEntityId = new Map([[selectedLegalEntity.id, selectedLegalEntity.name]]);
    const failedName = await this.linkCreatedUserToSelectedLegalEntity(
      customer.id,
      selectedLegalEntity,
      picker,
      companyNameByLegalEntityId,
    );
    const mapped = await this.mapCustomer(customer);
    return failedName ? { user: mapped, failedGroupNames: [failedName] } : { user: mapped };
  }

  async updateUser(userId: string, user: UpdateCompanyUserRequest): Promise<CompanyUser> {
    await this.assertB2bAdmin();
    const [session, currentCustomer] = await Promise.all([
      this.sessionService.getCurrent(),
      this.customerService.getCustomer(),
    ]);
    if (!currentCustomer) {
      throw new AdminRequiredError();
    }
    const selectedLegalEntity = await this.requireWriteLegalEntity(session);
    const picker =
      user.groupAssignments && user.groupAssignments.length > 0
        ? await this.resolveSelectedLegalEntityPicker(user.groupAssignments, selectedLegalEntity.id)
        : undefined;
    const customer = await this.requireReadableCustomer(userId, selectedLegalEntity.id, currentCustomer.id);
    const customerNumber = customer.customerNumber || customer.id;
    const patch = toCustomerPatch(user);

    if (Object.keys(patch).length > 0) {
      await this.customerAdminApi.updateCustomer(customerNumber, patch, SERVICE_TOKEN);
      applyCustomerPatch(customer, patch);
    }

    await this.applySelectedLegalEntityGroupAssignments(
      customer.id,
      selectedLegalEntity,
      user.groupAssignments,
      picker,
    );

    const refreshed = (await this.customerAdminApi.getCustomer(customerNumber, SERVICE_TOKEN)) ?? customer;
    return this.mapCustomer(refreshed);
  }

  async deleteUser(userId: string): Promise<void> {
    await this.assertB2bAdmin();
    const customer = await this.requireSelectedLegalEntityCustomer(userId);
    const customerNumber = customer.customerNumber || customer.id;
    await this.customerAdminApi.deleteCustomer(customerNumber, SERVICE_TOKEN);
  }

  async listAssignableGroups(): Promise<AssignableLegalEntityGroups[]> {
    await this.assertB2bAdmin();
    const session = await this.sessionService.getCurrent();
    const selectedLegalEntity = await this.requireWriteLegalEntity(session);
    // Customer Service enforces: Customer can only assign new customer to the same company.
    // Q29.4: omit Contact from the picker catalog; Contact is auto-assigned on create/save.
    const groups = (await this.loadAssignableGroupsForLegalEntity(selectedLegalEntity.id)).filter(
      (group) => !isContactGroup(group),
    );
    const companyNameByLegalEntityId = new Map([[selectedLegalEntity.id, selectedLegalEntity.name]]);
    const mapped = this.mapper.mapToService(DISPLAY_NAME_STUB_CUSTOMER, {
      groups,
      companyNameByLegalEntityId,
    }).groups;
    const assignable: AssignableCompanyUserGroup[] = mapped.map((group) => ({
      id: group.id,
      legalEntityId: group.legalEntityId || selectedLegalEntity.id,
      legalEntityName: selectedLegalEntity.name,
      displayName: group.displayName,
    }));

    return [
      {
        legalEntityId: selectedLegalEntity.id,
        legalEntityName: selectedLegalEntity.name,
        groups: assignable,
      },
    ];
  }

  private async assertB2bAdmin(): Promise<void> {
    const customer = await this.customerService.getCustomer();
    if (!customer?.roles?.includes(CustomerRole.B2B_ADMIN)) {
      throw new AdminRequiredError();
    }
  }

  private async requireWriteLegalEntity(session: UserManagementSession | undefined): Promise<WriteLegalEntity> {
    const rawSessionLegalEntityId = session?.legalEntityId;
    const normalizedSessionLegalEntityId = normalizeLegalEntityId(rawSessionLegalEntityId);
    const companies = await this.companyService.getCompanies();
    const selected = companies.find((company) => company.id === normalizedSessionLegalEntityId);
    if (!selected) {
      this.logger.error(
        {
          hasSession: Boolean(session),
          sessionLegalEntityType: typeof rawSessionLegalEntityId,
          sessionLegalEntityId: normalizedSessionLegalEntityId,
          profileFirstLegalEntityId: companies[0]?.id,
          permittedCompanyCount: companies.length,
          usedProfileFirstFallback: false,
        },
        'Selected legal entity membership could not be established',
      );
      throw new Error('Selected legal entity membership could not be established');
    }
    return {
      id: selected.id,
      name: selected.name,
      sessionLegalEntityId: selected.id,
      profileFirstLegalEntityId: companies[0]?.id,
    };
  }

  private async resolveSelectedLegalEntityPicker(
    assignments: CompanyUserGroupAssignment[],
    selectedLegalEntityId: string,
  ): Promise<SelectedLegalEntityPicker> {
    if (assignments.length !== 1 || assignments[0]?.legalEntityId !== selectedLegalEntityId) {
      throw new Error('Exactly one group assignment for the selected legal entity is required');
    }
    const assignment = assignments[0];
    const catalog = await this.loadAssignableGroupsForLegalEntity(selectedLegalEntityId);
    const contactGroup = catalog.find(
      (group): group is ContactCatalogGroup => Boolean(group.id) && isContactGroup(group),
    );
    if (!contactGroup) {
      throw new Error('Selected legal entity has no Contact catalog group');
    }
    if (assignment.groupId === CONTACT_ONLY_GROUP_ID || assignment.groupId === contactGroup.id) {
      return { kind: 'contact-only', contactGroup };
    }
    if (!catalog.some((group) => group.id === assignment.groupId && !isContactGroup(group))) {
      throw new Error('Selected group is not assignable for the selected legal entity');
    }
    return { kind: 'functional', assignment, contactGroup };
  }

  private async requireContactCatalogGroup(legalEntityId: string): Promise<ContactCatalogGroup> {
    const catalog = await this.loadAssignableGroupsForLegalEntity(legalEntityId);
    const contactGroup = catalog.find(
      (group): group is ContactCatalogGroup => Boolean(group.id) && isContactGroup(group),
    );
    if (!contactGroup) {
      throw new Error('Selected legal entity has no Contact catalog group');
    }
    return contactGroup;
  }

  private async collectAssignmentCustomerIds(
    legalEntityId: string,
  ): Promise<{ assignments: EmporixContactAssignment[]; memberIds: Set<string> }> {
    const assignments: EmporixContactAssignment[] = [];
    const memberIds = new Set<string>();
    let pageNumber = 1;

    while (true) {
      const { items, totalCount } = await this.customerManagementApi.getContactAssignmentsByLegalEntityId(
        legalEntityId,
        pageNumber,
        ASSIGNMENT_PAGE_SIZE,
      );
      assignments.push(...items);
      addAssignmentCustomerIds(items, memberIds, legalEntityId, this.logger);

      if (items.length === 0 || items.length < ASSIGNMENT_PAGE_SIZE) {
        break;
      }
      pageNumber += 1;
      assertPagedCollectionRunaway({
        logger: this.logger,
        pageNumber,
        pageSize: ASSIGNMENT_PAGE_SIZE,
        totalCount,
        collected: memberIds.size,
        context: { legalEntityId },
        exceededTotalMessage: 'Selected-LE assignment paging exceeded total-count runaway safety',
        missingTotalMessage: 'Selected-LE assignment paging missing total-count runaway safety',
        errorMessage: 'Selected-LE assignment paging exceeded runaway-page safety',
      });
    }

    return { assignments, memberIds };
  }

  private async resolveSelectedLegalEntityCatalogGroups(
    legalEntityId: string,
    assignments: readonly EmporixContactAssignment[],
  ): Promise<Map<string, EmporixGroup>> {
    const groups = new Map<string, EmporixGroup>();
    let hasEmbeddedCustomerGroups = false;

    for (const assignment of assignments) {
      const customerGroups = assignment.legalEntity?.customerGroups;
      if (!Array.isArray(customerGroups)) {
        continue;
      }
      hasEmbeddedCustomerGroups = true;
      for (const customerGroup of customerGroups) {
        if (!customerGroup.id) {
          continue;
        }
        groups.set(customerGroup.id, toCatalogGroup(customerGroup, legalEntityId));
      }
    }

    if (hasEmbeddedCustomerGroups) {
      return groups;
    }

    const fallbackGroups = await this.loadAssignableGroupsForLegalEntity(legalEntityId);
    return new Map(
      fallbackGroups
        .filter((group): group is EmporixGroup & { id: string } => Boolean(group.id))
        .map((group) => [group.id, group]),
    );
  }

  private async resolveCatalogGroupsForLegalEntities(
    legalEntityIds: readonly string[],
    assignments: readonly EmporixContactAssignment[],
  ): Promise<Map<string, EmporixGroup>> {
    const groupsById = new Map<string, EmporixGroup>();

    for (const legalEntityId of legalEntityIds) {
      const hasEmbeddedCustomerGroups = mergeEmbeddedCatalogGroupsForLegalEntity(
        legalEntityId,
        assignments,
        groupsById,
      );
      if (hasEmbeddedCustomerGroups) {
        continue;
      }
      const fallbackGroups = await this.loadAssignableGroupsForLegalEntity(legalEntityId);
      mergeCatalogGroupsById(fallbackGroups, groupsById);
    }

    return groupsById;
  }

  private async hydrateSelectedLegalEntityCustomers(memberIds: ReadonlySet<string>): Promise<EmporixCustomerAdmin[]> {
    const customersByMembershipKey = new Map<string, EmporixCustomerAdmin>();

    for (const idChunk of chunk([...memberIds], ID_QUERY_CHUNK_SIZE)) {
      const sessionItems = await this.loadCustomersByIdQuery(idChunk, 'session');
      for (const customer of sessionItems) {
        addCustomerForMembershipKeys(customersByMembershipKey, memberIds, customer);
      }

      const missingIds = idChunk.filter((id) => !customersByMembershipKey.has(id));
      if (missingIds.length > 0) {
        const serviceItems = await this.loadCustomersByIdQuery(missingIds, 'service');
        for (const customer of serviceItems) {
          addCustomerForMembershipKeys(customersByMembershipKey, memberIds, customer);
        }
      }
    }

    const seenCustomerIds = new Set<string>();
    const hydratedCustomers: EmporixCustomerAdmin[] = [];
    for (const membershipKey of memberIds) {
      const customer = customersByMembershipKey.get(membershipKey);
      if (!customer || seenCustomerIds.has(customer.id)) {
        continue;
      }
      seenCustomerIds.add(customer.id);
      hydratedCustomers.push(customer);
    }
    return hydratedCustomers;
  }

  private async loadCustomersByIdQuery(
    ids: string[],
    tokenType: 'service' | 'session',
  ): Promise<EmporixCustomerAdmin[]> {
    const query = `id:(${ids.join(',')})`;
    const { items } = await this.customerAdminApi.getCustomers(1, Math.max(ids.length, 1), undefined, query, tokenType);
    return items.filter((customer) => ids.includes(customer.id) || ids.includes(customer.customerNumber));
  }

  private async joinCatalogGroupsForResultPage(
    customers: EmporixCustomerAdmin[],
    catalogGroupById: ReadonlyMap<string, EmporixGroup>,
  ): Promise<Map<string, EmporixGroup[]>> {
    const groupsByMembershipId = new Map<string, EmporixGroup[]>();
    if (customers.length === 0 || catalogGroupById.size === 0) {
      return groupsByMembershipId;
    }

    const membershipIdToCustomerId = new Map<string, string>();
    for (const customer of customers) {
      for (const membershipId of [customer.id, customer.customerNumber].filter(isPresent)) {
        membershipIdToCustomerId.set(membershipId, customer.id);
      }
    }
    const pageMembershipIds = new Set(membershipIdToCustomerId.keys());
    if (pageMembershipIds.size === 0) {
      return groupsByMembershipId;
    }

    const catalogs = [...catalogGroupById.values()].filter((group): group is EmporixGroup & { id: string } =>
      Boolean(group.id),
    );
    const groupedMatches = await Promise.all(
      catalogs.map(async (group) => {
        const matchedMembershipIds = await this.loadGroupUserMembershipMatches(
          group.id,
          pageMembershipIds,
          membershipIdToCustomerId,
          customers.length,
        );
        const enriched = enrichExpandedGroup(group, catalogGroupById) ?? group;
        return { matchedMembershipIds, group: enriched };
      }),
    );

    for (const { matchedMembershipIds, group } of groupedMatches) {
      for (const membershipId of matchedMembershipIds) {
        const existing = groupsByMembershipId.get(membershipId) ?? [];
        groupsByMembershipId.set(membershipId, [...existing, group]);
      }
    }

    return groupsByMembershipId;
  }

  private async loadGroupUserMembershipMatches(
    groupId: string,
    pageMembershipIds: ReadonlySet<string>,
    membershipIdToCustomerId: ReadonlyMap<string, string>,
    expectedMatchedCustomers: number,
  ): Promise<Set<string>> {
    const matchedMembershipIds = new Set<string>();
    const matchedCustomerIds = new Set<string>();
    let pageNumber = 1;

    while (true) {
      const response = await this.iamApi.getGroupUsers(
        groupId,
        { page: pageNumber, size: GROUP_USERS_PAGE_SIZE },
        SERVICE_TOKEN,
      );
      collectMatchedMembershipIds(
        response.items,
        pageMembershipIds,
        membershipIdToCustomerId,
        matchedMembershipIds,
        matchedCustomerIds,
      );

      if (matchedCustomerIds.size >= expectedMatchedCustomers) {
        break;
      }
      if (response.items.length === 0 || response.items.length < GROUP_USERS_PAGE_SIZE) {
        break;
      }

      pageNumber += 1;
      assertPagedCollectionRunaway({
        logger: this.logger,
        pageNumber,
        pageSize: GROUP_USERS_PAGE_SIZE,
        totalCount: response.total,
        context: { groupId },
        exceededTotalMessage: 'Group-users paging exceeded total-count runaway safety',
        missingTotalMessage: 'Group-users paging missing total-count runaway safety',
        errorMessage: 'Group-users paging exceeded runaway-page safety',
      });
    }

    return matchedMembershipIds;
  }

  private async joinGroupsForResultPage(customers: EmporixCustomerAdmin[]): Promise<Map<string, EmporixGroup[]>> {
    const groupsByCustomerId = new Map<string, EmporixGroup[]>();

    for (const batch of chunk(customers, GET_BY_ID_BATCH_SIZE)) {
      const pages = await Promise.all(
        batch.map(async (customer) => {
          const primaryIdentifier = customer.customerNumber || customer.id;
          const fallbackIdentifier = primaryIdentifier === customer.id ? customer.customerNumber : customer.id;
          let response = await this.iamApi.getUserGroups(primaryIdentifier, { size: 60 }, 'service');
          if (response.items.length === 0 && fallbackIdentifier && fallbackIdentifier !== primaryIdentifier) {
            response = await this.iamApi.getUserGroups(fallbackIdentifier, { size: 60 }, 'service');
          }
          return { customerId: customer.id, groups: response.items };
        }),
      );
      for (const { customerId, groups } of pages) {
        groupsByCustomerId.set(customerId, groups);
      }
    }

    return groupsByCustomerId;
  }

  private async companyNamesForGroups(groups: EmporixGroup[]): Promise<Map<string, string>> {
    return this.companyNamesForLegalEntityIds(groups.map((group) => group.b2b?.legalEntityId).filter(isPresent));
  }

  private async companyNamesForLegalEntityIds(legalEntityIds: string[]): Promise<Map<string, string>> {
    const permitted = await this.companyService.getCompanies();
    const names = new Map(permitted.map((company) => [company.id, company.name]));

    for (const legalEntityId of legalEntityIds) {
      if (!legalEntityId || names.has(legalEntityId)) {
        continue;
      }
      const company = await this.companyService.getCompany(legalEntityId);
      if (company) {
        names.set(company.id, company.name);
      }
    }

    return names;
  }

  private async resolveCreatedCustomer(createdId: string): Promise<EmporixCustomerAdmin> {
    const customer = await this.customerAdminApi.getCustomer(createdId, 'service');
    if (!customer) {
      this.logger.error({ createdId, tokenType: 'service' }, 'Created customer service GET missed');
      throw new Error('Created customer could not be retrieved');
    }
    return customer;
  }

  private async requireSelectedLegalEntityCustomer(userId: string): Promise<EmporixCustomerAdmin> {
    const session = await this.sessionService.getCurrent();
    const selectedLegalEntity = await this.requireWriteLegalEntity(session);
    const { memberIds } = await this.collectAssignmentCustomerIds(selectedLegalEntity.id);
    const customer = await this.findCustomerInMemberSet(userId, memberIds);
    if (!customer) {
      throw new Error('Company user not found for the selected legal entity');
    }
    return customer;
  }

  private async requireReadableCustomer(
    userId: string,
    selectedLegalEntityId: string,
    currentCustomerId: string,
  ): Promise<EmporixCustomerAdmin> {
    const readable = await this.findReadableCustomer(userId, selectedLegalEntityId, currentCustomerId);
    if (!readable) {
      throw new Error('Company user not found for the selected legal entity');
    }
    return readable.customer;
  }

  /**
   * Authorize get/update against selected-LE assignments first (Q23), then the
   * Q24 other-Admin-LE assignment set. Selected-LE hits skip the other-LE collect
   * so first-table getUser still makes one target `getUserGroups` via mapCustomer.
   */
  private async findReadableCustomer(
    userId: string,
    selectedLegalEntityId: string,
    currentCustomerId: string,
  ): Promise<ReadableCompanyUser | undefined> {
    const { memberIds: selectedLegalEntityMemberIds } = await this.collectAssignmentCustomerIds(selectedLegalEntityId);
    const selectedMember = await this.findCustomerInMemberSet(userId, selectedLegalEntityMemberIds);
    if (selectedMember) {
      return { customer: selectedMember, isSelectedLegalEntityMember: true };
    }

    const { memberIds: otherMemberIds } = await this.collectOtherAdminLegalEntityAssignments(
      selectedLegalEntityId,
      currentCustomerId,
    );
    const otherMember = await this.findCustomerInMemberSet(userId, otherMemberIds);
    return otherMember ? { customer: otherMember, isSelectedLegalEntityMember: false } : undefined;
  }

  private async collectOtherAdminLegalEntityAssignments(
    selectedLegalEntityId: string,
    currentCustomerId: string,
  ): Promise<{
    otherAdminLegalEntityIds: string[];
    assignments: EmporixContactAssignment[];
    memberIds: Set<string>;
  }> {
    const currentUserGroups = await this.iamApi.getUserGroups(
      currentCustomerId,
      { size: GROUP_USERS_PAGE_SIZE },
      SERVICE_TOKEN,
    );
    const otherAdminLegalEntityIds = [
      ...collectOtherAdminLegalEntityIds(currentUserGroups.items, selectedLegalEntityId),
    ].sort((left, right) => left.localeCompare(right));
    if (otherAdminLegalEntityIds.length === 0) {
      return { otherAdminLegalEntityIds, assignments: [], memberIds: new Set() };
    }

    const otherAssignmentsByLegalEntity = await Promise.all(
      otherAdminLegalEntityIds.map(async (legalEntityId) => ({
        legalEntityId,
        ...(await this.collectAssignmentCustomerIds(legalEntityId)),
      })),
    );
    const assignments = otherAssignmentsByLegalEntity.flatMap((entry) => entry.assignments);
    const memberIds = new Set<string>();
    for (const entry of otherAssignmentsByLegalEntity) {
      for (const memberId of entry.memberIds) {
        memberIds.add(memberId);
      }
    }
    return { otherAdminLegalEntityIds, assignments, memberIds };
  }

  /**
   * Q26 combined list: Admin LEs from one current-user getUserGroups, including the
   * selected LE. findReadableCustomer keeps {@link collectOtherAdminLegalEntityAssignments}.
   */
  private async collectCombinedAdminLegalEntityAssignments(currentCustomerId: string): Promise<{
    adminLegalEntityIds: string[];
    assignments: EmporixContactAssignment[];
    memberIdsByLegalEntityId: Map<string, Set<string>>;
  }> {
    const currentUserGroups = await this.iamApi.getUserGroups(
      currentCustomerId,
      { size: GROUP_USERS_PAGE_SIZE },
      SERVICE_TOKEN,
    );
    const adminLegalEntityIds = [...collectAdminLegalEntityIds(currentUserGroups.items)].sort((left, right) =>
      left.localeCompare(right),
    );
    if (adminLegalEntityIds.length === 0) {
      return { adminLegalEntityIds, assignments: [], memberIdsByLegalEntityId: new Map() };
    }

    const collected = await Promise.all(
      adminLegalEntityIds.map(async (legalEntityId) => ({
        legalEntityId,
        ...(await this.collectAssignmentCustomerIds(legalEntityId)),
      })),
    );
    const assignments: EmporixContactAssignment[] = [];
    const memberIdsByLegalEntityId = new Map<string, Set<string>>();
    for (const entry of collected) {
      assignments.push(...entry.assignments);
      memberIdsByLegalEntityId.set(entry.legalEntityId, entry.memberIds);
    }
    return { adminLegalEntityIds, assignments, memberIdsByLegalEntityId };
  }

  private async findCustomerInMemberSet(
    userId: string,
    memberIds: ReadonlySet<string>,
  ): Promise<EmporixCustomerAdmin | undefined> {
    if (memberIds.size === 0) {
      return undefined;
    }
    const hydrated = await this.hydrateSelectedLegalEntityCustomers(memberIds);
    return hydrated.find((item) => item.customerNumber === userId || item.id === userId);
  }

  private async mapCustomer(
    customer: EmporixCustomerAdmin,
    mapping?: { isSelectedLegalEntityMember?: boolean },
  ): Promise<CompanyUser> {
    const groupsByCustomerId = await this.joinGroupsForResultPage([customer]);
    const customerGroups = groupsByCustomerId.get(customer.id) ?? [];
    const companyNameByLegalEntityId = await this.companyNamesForGroups(customerGroups);
    return this.mapper.mapToService(customer, {
      groups: customerGroups,
      companyNameByLegalEntityId,
      isSelectedLegalEntityMember: mapping?.isSelectedLegalEntityMember,
    });
  }

  /**
   * Documented-prefix CONTACT assignment then IAM Contact (and optional functional assign)
   * with service credentials. Either failure is reported as partial create without rolling
   * back a successful CONTACT.
   */
  private async linkCreatedUserToSelectedLegalEntity(
    customerResourceId: string,
    selectedLegalEntity: WriteLegalEntity,
    picker: SelectedLegalEntityPicker,
    companyNameByLegalEntityId: Map<string, string>,
  ): Promise<string | undefined> {
    const contactFailedName = await this.ensureCreatedUserContactMembership(
      customerResourceId,
      selectedLegalEntity,
      picker,
      companyNameByLegalEntityId,
    );
    if (contactFailedName) {
      return contactFailedName;
    }
    if (picker.kind !== 'functional') {
      return undefined;
    }
    return this.assignFunctionalIamGroup(customerResourceId, picker.assignment, companyNameByLegalEntityId);
  }

  private async ensureCreatedUserContactMembership(
    customerResourceId: string,
    selectedLegalEntity: WriteLegalEntity,
    picker: SelectedLegalEntityPicker,
    companyNameByLegalEntityId: Map<string, string>,
  ): Promise<string | undefined> {
    const logGroupId = picker.kind === 'functional' ? picker.assignment.groupId : picker.contactGroup.id;
    const failedAssignment: CompanyUserGroupAssignment =
      picker.kind === 'functional'
        ? picker.assignment
        : { legalEntityId: selectedLegalEntity.id, groupId: picker.contactGroup.id };
    try {
      await this.ensureContactAssignment(selectedLegalEntity.id, customerResourceId);
    } catch (error) {
      this.logger.error(
        {
          step: 'contact-assignment',
          customerId: customerResourceId,
          legalEntityId: selectedLegalEntity.id,
          groupId: logGroupId,
          forbidden: isForbiddenError(error),
          error: error instanceof Error ? error.message : String(error),
        },
        'User management contact-assignment link failed',
      );
      return this.resolveFailedGroupDisplayName(failedAssignment, companyNameByLegalEntityId);
    }

    try {
      await this.ensureContactIamGroup(picker.contactGroup, customerResourceId);
      return undefined;
    } catch (error) {
      this.logger.error(
        {
          step: 'iam-group',
          customerId: customerResourceId,
          legalEntityId: selectedLegalEntity.id,
          groupId: logGroupId,
          forbidden: isForbiddenError(error),
          error: error instanceof Error ? error.message : String(error),
        },
        'User management IAM group link failed',
      );
      return this.resolveFailedGroupDisplayName(failedAssignment, companyNameByLegalEntityId);
    }
  }

  private async assignFunctionalIamGroup(
    customerResourceId: string,
    assignment: CompanyUserGroupAssignment,
    companyNameByLegalEntityId: Map<string, string>,
  ): Promise<string | undefined> {
    try {
      await this.removeConflictingPredefinedGroups(customerResourceId, assignment.legalEntityId, assignment.groupId);
      await this.iamApi.addUserToGroup(
        assignment.groupId,
        { userId: customerResourceId, userType: 'CUSTOMER' },
        SERVICE_TOKEN,
      );
      return undefined;
    } catch (error) {
      const predefinedConflictMessage = parsePredefinedGroupConflictMessage(error);
      if (predefinedConflictMessage) {
        throw new PredefinedGroupConflictError(predefinedConflictMessage);
      }
      this.logger.error(
        {
          step: 'iam-group',
          customerId: customerResourceId,
          legalEntityId: assignment.legalEntityId,
          groupId: assignment.groupId,
          forbidden: isForbiddenError(error),
          error: error instanceof Error ? error.message : String(error),
        },
        'User management IAM group link failed',
      );
      return this.resolveFailedGroupDisplayName(assignment, companyNameByLegalEntityId);
    }
  }

  private async createInvitedCustomerProfile(
    user: CreateCompanyUserRequest,
    selectedLegalEntity: WriteLegalEntity,
    session: UserManagementSession | undefined,
  ): Promise<EmporixCustomerAdmin> {
    const createRequest = toInviteCreateRequest(user, session);
    const refreshDiagnostics = await this.refreshSelectedLegalEntityCustomerToken(selectedLegalEntity);
    const tokenLegalEntityId = await this.sessionService.getCustomerTokenLegalEntityId();
    const tokenScopeContext = {
      sessionLegalEntityId: selectedLegalEntity.sessionLegalEntityId,
      selectedLegalEntityId: selectedLegalEntity.id,
      tokenLegalEntityId: tokenLegalEntityId ?? null,
      tokenRefreshSucceeded: refreshDiagnostics.tokenRefreshSucceeded,
      tokenLooksLikeJwt: refreshDiagnostics.tokenLooksLikeJwt,
    };
    if (tokenLegalEntityId !== selectedLegalEntity.id) {
      this.logger.error(tokenScopeContext, 'Customer token is not scoped to the selected legal entity');
      throw new Error('Customer token is not scoped to the selected legal entity');
    }
    this.logger.info(tokenScopeContext, 'Customer token scoped to selected legal entity');

    let created: { id: string };
    try {
      // COP-4807: multi-company `_own` create can return a same-company 400 even
      // with a scoped session token, so only this profile create uses service auth.
      created = await this.customerAdminApi.createCustomer(createRequest, selectedLegalEntity.id);
    } catch (error) {
      const logContext = {
        ...toUpstreamErrorLogContext(error, 'Create customer'),
        tokenType: 'service',
        createDtoKeys: Object.keys(createRequest),
        preferredLanguage: createRequest.preferredLanguage,
        preferredSite: createRequest.preferredSite,
        preferredCurrency: createRequest.preferredCurrency,
        preferredLanguageLength: createRequest.preferredLanguage?.length,
        sessionLegalEntityId: selectedLegalEntity.sessionLegalEntityId,
        profileFirstLegalEntityId: selectedLegalEntity.profileFirstLegalEntityId,
        selectedLegalEntityId: selectedLegalEntity.id,
        tokenLegalEntityId,
        tokenRefreshSucceeded: refreshDiagnostics.tokenRefreshSucceeded,
        tokenLooksLikeJwt: refreshDiagnostics.tokenLooksLikeJwt,
        usedProfileFirstFallback: false,
      };
      this.logger.error(logContext, 'User management customer invite create failed');
      if (error && typeof error === 'object') {
        Object.assign(error, { userManagementLogContext: logContext });
      }
      throw error;
    }
    const customer = await this.resolveCreatedCustomer(created.id);
    if (user.active === false) {
      const customerNumber = customer.customerNumber || customer.id;
      await this.customerAdminApi.updateCustomer(customerNumber, { active: false }, 'service');
      customer.active = false;
    }
    return customer;
  }

  private async refreshSelectedLegalEntityCustomerToken(
    selectedLegalEntity: WriteLegalEntity,
  ): Promise<{ tokenRefreshSucceeded: true; tokenLooksLikeJwt: boolean }> {
    // Always remint the token: an expiry refresh may have dropped the legalEntityId claim
    // even when the persisted session context still points at the selected company.
    const baseTokenScopeContext = {
      sessionLegalEntityId: selectedLegalEntity.sessionLegalEntityId,
      selectedLegalEntityId: selectedLegalEntity.id,
    };
    try {
      return await this.sessionService.setLegalEntity(selectedLegalEntity.id);
    } catch (error) {
      this.logger.error(
        {
          ...baseTokenScopeContext,
          tokenLegalEntityId: null,
          tokenRefreshSucceeded: false,
          tokenLooksLikeJwt: false,
          error: error instanceof Error ? error.message : String(error),
        },
        'User management customer token scope refresh failed',
      );
      throw error;
    }
  }

  private async applySelectedLegalEntityGroupAssignments(
    customerResourceId: string,
    selectedLegalEntity: WriteLegalEntity,
    groupAssignments: CompanyUserGroupAssignment[] | undefined,
    picker?: SelectedLegalEntityPicker,
  ): Promise<void> {
    if (groupAssignments === undefined) {
      return;
    }
    if (groupAssignments.length === 0) {
      await this.applyContactOnlySelectedLegalEntityWrite(customerResourceId, selectedLegalEntity);
      return;
    }
    const resolved = picker ?? (await this.resolveSelectedLegalEntityPicker(groupAssignments, selectedLegalEntity.id));
    if (resolved.kind === 'contact-only') {
      await this.applyContactOnlySelectedLegalEntityWrite(
        customerResourceId,
        selectedLegalEntity,
        resolved.contactGroup,
      );
      return;
    }
    await this.syncSelectedLegalEntityGroup(
      customerResourceId,
      selectedLegalEntity,
      resolved.assignment,
      resolved.contactGroup,
    );
  }

  private async applyContactOnlySelectedLegalEntityWrite(
    customerResourceId: string,
    selectedLegalEntity: WriteLegalEntity,
    contactGroup?: ContactCatalogGroup,
  ): Promise<void> {
    const resolvedContact = contactGroup ?? (await this.requireContactCatalogGroup(selectedLegalEntity.id));
    await this.ensureContactAssignment(selectedLegalEntity.id, customerResourceId);
    await this.ensureContactIamGroup(resolvedContact, customerResourceId);
    await this.removeSelectedLegalEntityFunctionalGroups(customerResourceId, selectedLegalEntity.id);
  }

  private async resolveFailedGroupDisplayName(
    assignment: CompanyUserGroupAssignment,
    companyNameByLegalEntityId: Map<string, string>,
  ): Promise<string> {
    const companyName = companyNameByLegalEntityId.get(assignment.legalEntityId) ?? assignment.legalEntityId;
    try {
      const groups = await this.loadAssignableGroupsForLegalEntity(assignment.legalEntityId);
      const group = groups.find((item) => item.id === assignment.groupId);
      if (group) {
        return this.groupDisplayName(group, companyNameByLegalEntityId);
      }
    } catch (error) {
      this.logger.warn(
        {
          legalEntityId: assignment.legalEntityId,
          groupId: assignment.groupId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Could not resolve failed group display name',
      );
    }
    return `${companyName} - ${assignment.groupId}`;
  }

  private groupDisplayName(group: EmporixGroup, companyNameByLegalEntityId: Map<string, string>): string {
    const mapped = this.mapper.mapToService(DISPLAY_NAME_STUB_CUSTOMER, {
      groups: [group],
      companyNameByLegalEntityId,
    }).groups[0];
    return mapped?.displayName ?? group.id ?? group.code ?? 'Unknown group';
  }

  /**
   * After assign, remove extra predefined roles for this LE only when they conflict with
   * one predefined group per LE. Never unconditional DELETE of group code CUSTOMER.
   * Contact may coexist.
   */
  private async removeConflictingPredefinedGroups(
    userId: string,
    legalEntityId: string,
    keepGroupId: string,
  ): Promise<void> {
    const response = await this.iamApi.getUserGroups(userId, { size: 60 }, SERVICE_TOKEN);
    const selectedCatalogById = new Map(
      (await this.loadAssignableGroupsForLegalEntity(legalEntityId))
        .filter((group): group is EmporixGroup & { id: string } => Boolean(group.id))
        .map((group) => [group.id, group]),
    );
    for (const group of response.items) {
      if (!group.id || group.id === keepGroupId) {
        continue;
      }
      const catalogGroup = selectedCatalogById.get(group.id);
      const belongsToSelectedLegalEntity = group.b2b?.legalEntityId
        ? group.b2b.legalEntityId === legalEntityId
        : Boolean(catalogGroup);
      if (!belongsToSelectedLegalEntity) {
        continue;
      }
      if (!isPredefinedGroup(catalogGroup ?? group)) {
        continue;
      }
      await this.iamApi.removeUserFromGroup(group.id, userId, SERVICE_TOKEN);
    }
  }

  private async syncSelectedLegalEntityGroup(
    customerResourceId: string,
    selectedLegalEntity: WriteLegalEntity,
    assignment: CompanyUserGroupAssignment,
    contactGroup: ContactCatalogGroup,
  ): Promise<void> {
    try {
      await this.ensureContactAssignment(selectedLegalEntity.id, customerResourceId);
      await this.ensureContactIamGroup(contactGroup, customerResourceId);
      const currentGroups = (await this.iamApi.getUserGroups(customerResourceId, { size: 60 }, SERVICE_TOKEN)).items;
      // Remove conflicting selected-LE predefined groups first to avoid IAM rejecting add-first updates.
      await this.removeConflictingPredefinedGroups(customerResourceId, selectedLegalEntity.id, assignment.groupId);
      const alreadyAssigned = currentGroups.some((group) => group.id === assignment.groupId);
      if (!alreadyAssigned) {
        await this.iamApi.addUserToGroup(
          assignment.groupId,
          { userId: customerResourceId, userType: 'CUSTOMER' },
          SERVICE_TOKEN,
        );
      }
    } catch (error) {
      const predefinedConflictMessage = parsePredefinedGroupConflictMessage(error);
      if (predefinedConflictMessage) {
        throw new PredefinedGroupConflictError(predefinedConflictMessage);
      }
      this.logger.error(
        {
          customerId: customerResourceId,
          legalEntityId: selectedLegalEntity.id,
          groupId: assignment.groupId,
          forbidden: isForbiddenError(error),
          error: error instanceof Error ? error.message : String(error),
        },
        'User management update group or legal-entity sync failed',
      );
      throw new Error(
        `User update group or legal-entity sync failed: ${this.groupDisplayName(
          { id: assignment.groupId, b2b: { legalEntityId: selectedLegalEntity.id } },
          new Map([[selectedLegalEntity.id, selectedLegalEntity.name]]),
        )}`,
      );
    }
  }

  private async ensureContactIamGroup(contactGroup: ContactCatalogGroup, customerResourceId: string): Promise<void> {
    const currentGroups = (await this.iamApi.getUserGroups(customerResourceId, { size: 60 }, SERVICE_TOKEN)).items;
    if (currentGroups.some((group) => group.id === contactGroup.id)) {
      return;
    }
    await this.iamApi.addUserToGroup(
      contactGroup.id,
      { userId: customerResourceId, userType: 'CUSTOMER' },
      SERVICE_TOKEN,
    );
  }

  private async removeSelectedLegalEntityFunctionalGroups(
    customerResourceId: string,
    selectedLegalEntityId: string,
  ): Promise<void> {
    const selectedFunctionalIds = new Set(
      (await this.loadAssignableGroupsForLegalEntity(selectedLegalEntityId))
        .filter((group) => Boolean(group.id) && isPredefinedGroup(group))
        .map((group) => group.id)
        .filter(isPresent),
    );
    const currentGroups = (await this.iamApi.getUserGroups(customerResourceId, { size: 60 }, SERVICE_TOKEN)).items;

    for (const group of currentGroups) {
      if (group.id && selectedFunctionalIds.has(group.id)) {
        await this.iamApi.removeUserFromGroup(group.id, customerResourceId, SERVICE_TOKEN);
      }
    }
  }

  private async ensureContactAssignment(legalEntityId: string, customerResourceId: string): Promise<void> {
    const existingId = await this.findContactAssignmentId(legalEntityId, customerResourceId);
    if (existingId) {
      return;
    }
    await this.customerManagementApi.createLegalEntityContactAssignment({
      legalEntity: { id: legalEntityId },
      customer: { id: customerResourceId },
    });
  }

  private async findContactAssignmentId(legalEntityId: string, customerId: string): Promise<string | undefined> {
    let pageNumber = 1;

    while (true) {
      const { items, totalCount } = await this.customerManagementApi.getContactAssignmentsByLegalEntityId(
        legalEntityId,
        pageNumber,
        ASSIGNMENT_PAGE_SIZE,
      );
      const match = items.find((item) => item.customer?.id === customerId && item.id);
      if (match?.id) {
        return match.id;
      }
      if (items.length === 0 || items.length < ASSIGNMENT_PAGE_SIZE) {
        break;
      }
      if (totalCount !== undefined && pageNumber * ASSIGNMENT_PAGE_SIZE >= totalCount) {
        break;
      }
      pageNumber += 1;
    }

    return undefined;
  }

  private async loadAssignableGroupsForLegalEntity(legalEntityId: string): Promise<EmporixGroup[]> {
    const searchParams = {
      query: `b2b.legalEntityId:"${legalEntityId}"`,
      criteria: { userType: 'CUSTOMER' as const },
    };
    const groups = await this.iamApi.getGroups(searchParams, 'service');

    return groups
      .filter((group) => {
        if (!group.id || group.code === CUSTOMER_GROUP_CODE) {
          return false;
        }
        if (group.userType === 'EMPLOYEE') {
          return false;
        }
        const groupLegalEntityId = group.b2b?.legalEntityId;
        return groupLegalEntityId ? groupLegalEntityId === legalEntityId : true;
      })
      .map((group) =>
        group.b2b?.legalEntityId
          ? group
          : {
              ...group,
              b2b: { ...group.b2b, legalEntityId },
            },
      );
  }
}

function toInviteCreateRequest(
  user: CreateCompanyUserRequest,
  session: UserManagementSession | undefined,
): EmporixCustomerAdminCreateRequest {
  const request: EmporixCustomerAdminCreateRequest = {
    firstName: user.firstName,
    lastName: user.lastName,
    contactEmail: user.contactEmail,
  };
  if (user.title) {
    request.title = user.title;
  }
  if (user.contactPhone) {
    request.contactPhone = user.contactPhone;
  }
  if (session?.siteCode) {
    request.preferredSite = session.siteCode;
  }
  if (session?.language) {
    request.preferredLanguage = toCustomerServiceLanguage(session.language);
  }
  if (session?.currency) {
    request.preferredCurrency = session.currency;
  }
  return request;
}

function toCustomerServiceLanguage(language: string): string {
  return CUSTOMER_SERVICE_LANGUAGE_BY_STOREFRONT_LOCALE[language] ?? language;
}

function toUpstreamErrorLogContext(
  error: unknown,
  fallbackOperation: string,
): {
  status?: number;
  statusText?: string;
  operation: string;
  type?: string;
  message?: string;
  details?: unknown;
} {
  if (!isEmporixApiError(error)) {
    return { operation: fallbackOperation };
  }

  const parsedBody = parseUpstreamErrorBody(error.body);
  return {
    status: error.status,
    statusText: error.statusText,
    operation: error.operation,
    ...parsedBody,
  };
}

function parseUpstreamErrorBody(body: string | undefined): { type?: string; message?: string; details?: unknown } {
  if (!body) {
    return {};
  }
  try {
    const parsed = JSON.parse(body) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const record = parsed as Record<string, unknown>;
    return {
      type: typeof record.type === 'string' ? redactEmails(record.type) : undefined,
      message: typeof record.message === 'string' ? redactEmails(record.message) : undefined,
      details: record.details === undefined ? undefined : sanitizeUpstreamLogValue(record.details),
    };
  } catch {
    return {};
  }
}

function parsePredefinedGroupConflictMessage(error: unknown): string | undefined {
  if (!isEmporixApiError(error) || error.status !== 400) {
    return undefined;
  }
  const { message } = parseUpstreamErrorBody(error.body);
  if (typeof message === 'string' && message.startsWith(PREDEFINED_GROUP_CONFLICT_PREFIX)) {
    return PREDEFINED_GROUP_CONFLICT_PREFIX;
  }
  return undefined;
}

function sanitizeUpstreamLogValue(value: unknown, key?: string): unknown {
  if (key && /password|token|secret|authorization/i.test(key)) {
    return '[REDACTED]';
  }
  if (key && /email/i.test(key)) {
    return '[REDACTED_EMAIL]';
  }
  if (typeof value === 'string') {
    return redactEmails(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUpstreamLogValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeUpstreamLogValue(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

function redactEmails(value: string): string {
  return value.replaceAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]');
}

function toCustomerPatch(user: UpdateCompanyUserRequest): EmporixCustomerAdminUpdateRequest {
  const patch: EmporixCustomerAdminUpdateRequest = {};
  if (user.title !== undefined) {
    patch.title = user.title;
  }
  if (user.firstName !== undefined) {
    patch.firstName = user.firstName;
  }
  if (user.lastName !== undefined) {
    patch.lastName = user.lastName;
  }
  if (user.contactEmail !== undefined) {
    patch.contactEmail = user.contactEmail;
  }
  if (user.contactPhone !== undefined) {
    patch.contactPhone = user.contactPhone;
  }
  if (user.active !== undefined) {
    patch.active = user.active;
  }
  return patch;
}

function applyCustomerPatch(customer: EmporixCustomerAdmin, patch: EmporixCustomerAdminUpdateRequest): void {
  if (patch.title !== undefined) {
    customer.title = patch.title;
  }
  if (patch.firstName !== undefined) {
    customer.firstName = patch.firstName;
  }
  if (patch.lastName !== undefined) {
    customer.lastName = patch.lastName;
  }
  if (patch.contactEmail !== undefined) {
    customer.contactEmail = patch.contactEmail;
  }
  if (patch.contactPhone !== undefined) {
    customer.contactPhone = patch.contactPhone;
  }
  if (patch.active !== undefined) {
    customer.active = patch.active;
  }
}

function isForbiddenError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /\b403\b|forbidden/i.test(error.message);
}

function isContactGroup(group: EmporixGroup): boolean {
  return group.code === 'CONTACT' || group.b2b?.role === 'Contact';
}

function isPredefinedGroup(group: EmporixGroup): boolean {
  if (isContactGroup(group) || group.code === CUSTOMER_GROUP_CODE) {
    return false;
  }
  if (group.code && PREDEFINED_GROUP_CODES.has(group.code)) {
    return true;
  }
  return Boolean(group.b2b?.role && PREDEFINED_GROUP_ROLES.has(group.b2b.role));
}

function isPresent<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

function enrichExpandedGroup(
  expanded: EmporixGroup,
  groupById: ReadonlyMap<string, EmporixGroup>,
): EmporixGroup | undefined {
  if (!expanded.id) {
    return undefined;
  }
  const catalogGroup = groupById.get(expanded.id);
  if (!catalogGroup) {
    return undefined;
  }
  return {
    ...catalogGroup,
    ...expanded,
    b2b: {
      ...catalogGroup.b2b,
      ...expanded.b2b,
    },
  };
}

function normalizeLegalEntityId(value: unknown): string | undefined {
  let candidate: unknown;
  if (typeof value === 'string') {
    candidate = value;
  } else if (value && typeof value === 'object' && 'value' in value) {
    candidate = (value as { value?: unknown }).value;
  }
  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim();
  }
  return undefined;
}

function tokenizeNameQuery(query?: string): string[] {
  if (!query) {
    return [];
  }
  return query
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function matchesNameTokens(customer: EmporixCustomerAdmin, tokens: string[]): boolean {
  const firstName = (customer.firstName ?? '').toLowerCase();
  const lastName = (customer.lastName ?? '').toLowerCase();
  return tokens.every((token) => {
    const needle = token.toLowerCase();
    return firstName.includes(needle) || lastName.includes(needle);
  });
}

function parseSort(sort?: string): { field: CompanyUserSortField; direction: 1 | -1 } | undefined {
  if (!sort) {
    return undefined;
  }
  const [rawField, rawDirection] = sort.split(':');
  if (!isSortAllowListField(rawField)) {
    return undefined;
  }
  return {
    field: rawField,
    direction: rawDirection === 'desc' ? -1 : 1,
  };
}

function isSortAllowListField(field: string | undefined): field is CompanyUserSortField {
  return SORT_ALLOW_LIST.includes(field as CompanyUserSortField);
}

function sortCustomers(customers: EmporixCustomerAdmin[], sort?: string): EmporixCustomerAdmin[] {
  const parsed = parseSort(sort);
  if (!parsed) {
    return customers;
  }

  return [...customers].sort((left, right) => {
    const leftValue = sortValue(left, parsed.field);
    const rightValue = sortValue(right, parsed.field);
    if (leftValue < rightValue) {
      return -1 * parsed.direction;
    }
    if (leftValue > rightValue) {
      return 1 * parsed.direction;
    }
    return 0;
  });
}

function sortValue(customer: EmporixCustomerAdmin, field: CompanyUserSortField): string | number {
  switch (field) {
    case 'active':
      return customer.active === true ? 1 : 0;
    case 'metadataCreatedAt':
      return customer.metadataCreatedAt ?? customer.metadata?.createdAt ?? '';
    case 'firstName':
      return (customer.firstName ?? '').toLowerCase();
    case 'lastName':
      return (customer.lastName ?? '').toLowerCase();
    case 'contactEmail':
      return (customer.contactEmail ?? '').toLowerCase();
  }
}

function addCustomerForMembershipKeys(
  customersByMembershipKey: Map<string, EmporixCustomerAdmin>,
  membershipIds: ReadonlySet<string>,
  customer: EmporixCustomerAdmin,
): void {
  const membershipKeys = [customer.id, customer.customerNumber].filter(isPresent);
  if (!membershipKeys.some((key) => membershipIds.has(key))) {
    return;
  }
  for (const key of membershipKeys) {
    if (membershipIds.has(key)) {
      customersByMembershipKey.set(key, customer);
    }
  }
}

function selectedCatalogGroupsForCustomer(
  customer: EmporixCustomerAdmin,
  groupsByMembershipId: ReadonlyMap<string, EmporixGroup[]>,
): EmporixGroup[] {
  const mergedById = new Map<string, EmporixGroup>();
  for (const key of [customer.id, customer.customerNumber].filter(isPresent)) {
    const groups = groupsByMembershipId.get(key);
    if (!groups) {
      continue;
    }
    for (const group of groups) {
      if (group.id) {
        mergedById.set(group.id, group);
      }
    }
  }
  return [...mergedById.values()];
}

function toCatalogGroup(group: EmporixCustomerGroup, legalEntityId: string): EmporixGroup {
  return {
    id: group.id,
    name: group.name,
    b2b: {
      legalEntityId,
      role: group.role,
    },
  };
}

function addAssignmentCustomerIds(
  items: readonly EmporixContactAssignment[],
  memberIds: Set<string>,
  legalEntityId: string,
  logger: LoggerService,
): void {
  for (const assignment of items) {
    const userId = assignment.customer?.id;
    if (!userId) {
      continue;
    }
    memberIds.add(userId);
    if (memberIds.size > MAX_SELECTED_LE_USERS) {
      logger.error(
        { legalEntityId, collected: memberIds.size },
        'Selected-LE assignment member volume exceeds showcase memory',
      );
      throw new Error('Selected legal entity user volume exceeds showcase in-memory limit');
    }
  }
}

function assertPagedCollectionRunaway(params: {
  logger: LoggerService;
  pageNumber: number;
  pageSize: number;
  totalCount: number | undefined;
  collected?: number;
  context: Record<string, unknown>;
  exceededTotalMessage: string;
  missingTotalMessage: string;
  errorMessage: string;
}): void {
  const maxPagesWithTotal =
    params.totalCount === undefined ? undefined : Math.ceil(params.totalCount / params.pageSize) + 1;
  const collectedContext = params.collected === undefined ? {} : { collected: params.collected };

  if (maxPagesWithTotal === undefined) {
    if (params.pageNumber > MAX_PAGES_WITHOUT_TOTAL) {
      params.logger.error(
        {
          ...params.context,
          pageNumber: params.pageNumber,
          pageSize: params.pageSize,
          ...collectedContext,
        },
        params.missingTotalMessage,
      );
      throw new Error(params.errorMessage);
    }
    return;
  }

  if (params.pageNumber > maxPagesWithTotal) {
    params.logger.error(
      {
        ...params.context,
        pageNumber: params.pageNumber,
        totalCount: params.totalCount,
        pageSize: params.pageSize,
        ...collectedContext,
      },
      params.exceededTotalMessage,
    );
    throw new Error(params.errorMessage);
  }
}

function mergeCustomerGroupsIntoCatalog(
  customerGroups: readonly EmporixCustomerGroup[],
  legalEntityId: string,
  groupsById: Map<string, EmporixGroup>,
): void {
  for (const customerGroup of customerGroups) {
    if (customerGroup.id) {
      groupsById.set(customerGroup.id, toCatalogGroup(customerGroup, legalEntityId));
    }
  }
}

function mergeEmbeddedCatalogGroupsForLegalEntity(
  legalEntityId: string,
  assignments: readonly EmporixContactAssignment[],
  groupsById: Map<string, EmporixGroup>,
): boolean {
  let hasEmbeddedCustomerGroups = false;
  for (const assignment of assignments) {
    const legalEntity = assignment.legalEntity;
    if (legalEntity?.id === legalEntityId) {
      const customerGroups = legalEntity.customerGroups;
      if (Array.isArray(customerGroups)) {
        hasEmbeddedCustomerGroups = true;
        mergeCustomerGroupsIntoCatalog(customerGroups, legalEntityId, groupsById);
      }
    }
  }
  return hasEmbeddedCustomerGroups;
}

function mergeCatalogGroupsById(groups: readonly EmporixGroup[], groupsById: Map<string, EmporixGroup>): void {
  for (const group of groups) {
    if (group.id) {
      groupsById.set(group.id, group);
    }
  }
}

function collectMatchedMembershipIds(
  assignments: readonly EmporixIamGroupUserAssignment[],
  pageMembershipIds: ReadonlySet<string>,
  membershipIdToCustomerId: ReadonlyMap<string, string>,
  matchedMembershipIds: Set<string>,
  matchedCustomerIds: Set<string>,
): void {
  for (const assignment of assignments) {
    if (!assignment.userId || !pageMembershipIds.has(assignment.userId)) {
      continue;
    }
    matchedMembershipIds.add(assignment.userId);
    const customerId = membershipIdToCustomerId.get(assignment.userId);
    if (customerId) {
      matchedCustomerIds.add(customerId);
    }
  }
}

function catalogGroupsForSourceLegalEntity(
  customer: EmporixCustomerAdmin,
  groupsByMembershipId: ReadonlyMap<string, EmporixGroup[]>,
  sourceLegalEntityId: string,
): EmporixGroup[] {
  return selectedCatalogGroupsForCustomer(customer, groupsByMembershipId).filter((group) => {
    const legalEntityId = group.b2b?.legalEntityId;
    return Boolean(legalEntityId) && legalEntityId === sourceLegalEntityId;
  });
}

function collectAdminLegalEntityIds(groups: readonly EmporixGroup[]): Set<string> {
  const adminLegalEntityIds = new Set<string>();
  for (const group of groups) {
    const legalEntityId = group.b2b?.legalEntityId;
    if (!legalEntityId) {
      continue;
    }
    if (group.code === CUSTOMER_GROUP_CODE) {
      continue;
    }
    if (group.b2b?.role !== 'Admin') {
      continue;
    }
    adminLegalEntityIds.add(legalEntityId);
  }
  return adminLegalEntityIds;
}

function collectOtherAdminLegalEntityIds(groups: readonly EmporixGroup[], selectedLegalEntityId: string): Set<string> {
  const otherAdminLegalEntityIds = collectAdminLegalEntityIds(groups);
  otherAdminLegalEntityIds.delete(selectedLegalEntityId);
  return otherAdminLegalEntityIds;
}

function dedupeCustomersByMembershipKeys(customers: readonly EmporixCustomerAdmin[]): EmporixCustomerAdmin[] {
  const deduplicated: EmporixCustomerAdmin[] = [];
  const seenMembershipIds = new Set<string>();
  for (const customer of customers) {
    const keys = [customer.id, customer.customerNumber].filter(isPresent);
    if (keys.some((key) => seenMembershipIds.has(key))) {
      continue;
    }
    for (const key of keys) {
      seenMembershipIds.add(key);
    }
    deduplicated.push(customer);
  }
  return deduplicated;
}

function compareCustomerMembershipIdentity(left: EmporixCustomerAdmin, right: EmporixCustomerAdmin): number {
  const leftIdentity = (left.customerNumber || left.id).toLowerCase();
  const rightIdentity = (right.customerNumber || right.id).toLowerCase();
  if (leftIdentity < rightIdentity) {
    return -1;
  }
  if (leftIdentity > rightIdentity) {
    return 1;
  }
  return 0;
}

function compareCombinedAdminLeRows(left: CombinedAdminLeAssignmentRow, right: CombinedAdminLeAssignmentRow): number {
  const legalEntityCompare = left.legalEntityId.localeCompare(right.legalEntityId);
  if (legalEntityCompare !== 0) {
    return legalEntityCompare;
  }
  return compareCustomerMembershipIdentity(left.customer, right.customer);
}

function sortCombinedAdminLeRows(
  rows: readonly CombinedAdminLeAssignmentRow[],
  sort?: string,
): CombinedAdminLeAssignmentRow[] {
  const parsed = parseSort(sort);
  return [...rows].sort((left, right) => {
    if (parsed) {
      const leftValue = sortValue(left.customer, parsed.field);
      const rightValue = sortValue(right.customer, parsed.field);
      if (leftValue < rightValue) {
        return -1 * parsed.direction;
      }
      if (leftValue > rightValue) {
        return 1 * parsed.direction;
      }
    }
    return compareCombinedAdminLeRows(left, right);
  });
}

function indexCustomersByMembershipKey(customers: readonly EmporixCustomerAdmin[]): Map<string, EmporixCustomerAdmin> {
  const indexed = new Map<string, EmporixCustomerAdmin>();
  for (const customer of customers) {
    for (const key of [customer.id, customer.customerNumber].filter(isPresent)) {
      indexed.set(key, customer);
    }
  }
  return indexed;
}

function expandCombinedAdminLeRows(
  memberIdsByLegalEntityId: ReadonlyMap<string, Set<string>>,
  customersByMembershipKey: ReadonlyMap<string, EmporixCustomerAdmin>,
  legalEntityNameById: ReadonlyMap<string, string>,
): CombinedAdminLeAssignmentRow[] {
  const rows: CombinedAdminLeAssignmentRow[] = [];
  for (const [legalEntityId, memberIds] of memberIdsByLegalEntityId) {
    const seenCustomerIds = new Set<string>();
    const legalEntityName = legalEntityNameById.get(legalEntityId) ?? legalEntityId;
    for (const membershipKey of memberIds) {
      const customer = customersByMembershipKey.get(membershipKey);
      if (!customer || seenCustomerIds.has(customer.id)) {
        continue;
      }
      seenCustomerIds.add(customer.id);
      rows.push({ customer, legalEntityId, legalEntityName });
    }
  }
  return rows;
}

function legalEntityNamesForCombinedList(
  legalEntityIds: readonly string[],
  assignments: readonly EmporixContactAssignment[],
  companyNames: ReadonlyMap<string, string>,
): Map<string, string> {
  const assignmentNameByLegalEntityId = new Map<string, string>();
  for (const assignment of assignments) {
    const legalEntityId = assignment.legalEntity?.id;
    if (!legalEntityId || assignmentNameByLegalEntityId.has(legalEntityId)) {
      continue;
    }
    const assignmentName = contactAssignmentLegalEntityName(assignment);
    if (assignmentName) {
      assignmentNameByLegalEntityId.set(legalEntityId, assignmentName);
    }
  }

  const names = new Map<string, string>();
  for (const legalEntityId of legalEntityIds) {
    names.set(
      legalEntityId,
      companyNames.get(legalEntityId) ?? assignmentNameByLegalEntityId.get(legalEntityId) ?? legalEntityId,
    );
  }
  return names;
}

function contactAssignmentLegalEntityName(assignment: EmporixContactAssignment): string | undefined {
  const legalEntity = assignment.legalEntity as { id: string; name?: unknown };
  return typeof legalEntity.name === 'string' && legalEntity.name.trim() ? legalEntity.name.trim() : undefined;
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

export default EmporixUserManagementService;
