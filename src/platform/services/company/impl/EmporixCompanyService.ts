import { randomUUID } from 'crypto';
import { inject } from 'inversify';
import { resolveLegalEntityIdFromSessionAndCustomer } from '@/lib/common/legal-entity-context';
import { mapLegalEntityLocationToCustomerAddress } from '@/lib/common/map-legal-entity-location-to-customer-address';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCustomerApi } from '@/platform/integrations/emporix/customer/EmporixCustomerApi';
import type { EmporixCustomerManagementApi } from '@/platform/integrations/emporix/customer/EmporixCustomerManagementApi';
import type { EmporixIamApi } from '@/platform/integrations/emporix/iam/EmporixIamApi';
import type {
  EmporixContactAssignment,
  EmporixLegalEntity,
  EmporixLocation,
  EmporixResourceId,
} from '@/platform/integrations/emporix/model';
import type { EmporixGroup } from '@/platform/integrations/emporix/model/iam';
import type { CustomerService } from '../../customer/CustomerService';
import type { LoggerService } from '../../logger/LoggerService';
import type { Company, CompanyDetails, CompanyUpdateDto } from '../../model/company/company';
import type { CustomerAddress } from '../../model/customer/customer';
import type { CompanyGroup, CompanyRole, CreateTeamMemberInput, TeamMember } from '../../model/team/team';
import type { SessionService } from '../../session';
import type { CompanyService } from '../CompanyService';

const PREDEFINED_MANAGED_ROLES: CompanyRole[] = ['ADMIN', 'BUYER', 'REQUESTER'];
const TEAM_PAGE_SIZE = 200;

@injectable('CompanyService', 'Singleton')
export class EmporixCompanyService implements CompanyService {
  constructor(
    @inject('EmporixCustomerManagementApi')
    private readonly customerManagementApi: EmporixCustomerManagementApi,
    @inject('EmporixCustomerApi')
    private readonly customerApi: EmporixCustomerApi,
    @inject('EmporixIamApi')
    private readonly iamApi: EmporixIamApi,
    @inject('CustomerService')
    private readonly customerService: CustomerService,
    @inject('SessionService')
    private readonly sessionService: SessionService,
    @inject('LoggerService')
    private readonly logger: LoggerService,
  ) {}

  /**
   * Resolve the legal entity id to operate on. When no id is provided the
   * currently selected legal entity (session attribute, then customer profile)
   * is used.
   */
  private async resolveCompanyId(companyId?: string): Promise<string | undefined> {
    if (companyId) {
      return companyId;
    }
    const session = await this.sessionService.getCurrent();
    const customer = await this.customerService.getCustomer();
    return resolveLegalEntityIdFromSessionAndCustomer(session, customer ?? undefined);
  }

  async getCompany(companyId?: string): Promise<Company | null> {
    const resolvedId = await this.resolveCompanyId(companyId);
    if (!resolvedId) {
      return null;
    }
    const emporixLegalEntity = await this.customerManagementApi.getLegalEntityById(resolvedId);
    if (!emporixLegalEntity) {
      return null;
    }
    const creditscore = emporixLegalEntity.mixins?.['creditscore'];

    return {
      id: emporixLegalEntity.id ?? resolvedId,
      name: emporixLegalEntity.name,
      onboarding: {
        status: this.mapStatus(creditscore?.internalrating),
        updatedAt: creditscore?.statusupdate || new Date(),
      },
    };
  }

  async getCompanyDetails(companyId?: string): Promise<CompanyDetails | null> {
    const resolvedId = await this.resolveCompanyId(companyId);
    if (!resolvedId) {
      return null;
    }

    const entity = await this.customerManagementApi.getLegalEntityById(resolvedId);
    if (!entity) {
      return null;
    }

    const creditscore = entity.mixins?.['creditscore'];
    const companyName = entity.legalInfo?.legalName || entity.name;

    let addresses: CustomerAddress[] = [];
    try {
      const locations = await this.resolveLegalEntityLocations(entity);
      addresses = locations
        .map((loc) => mapLegalEntityLocationToCustomerAddress(loc, companyName))
        .filter((addr): addr is CustomerAddress => addr !== null);
    } catch (err) {
      this.logger.warn({ err: err instanceof Error ? err : String(err) }, 'Failed to resolve company addresses');
    }

    return {
      id: entity.id ?? resolvedId,
      name: entity.name,
      type: entity.type,
      parentId: entity.parentId,
      legalInfo: entity.legalInfo,
      accountLimit: entity.accountLimit,
      addresses,
      version: entity.metadata?.version,
      onboarding: {
        status: this.mapStatus(creditscore?.internalrating),
        updatedAt: creditscore?.statusupdate || new Date(),
      },
    };
  }

  async updateCompany(update: CompanyUpdateDto, companyId?: string): Promise<CompanyDetails> {
    const resolvedId = await this.resolveCompanyId(companyId);
    if (!resolvedId) {
      throw new Error('No company selected');
    }

    const current = await this.customerManagementApi.getLegalEntityById(resolvedId);
    if (!current) {
      throw new Error('Company not found');
    }

    // Merge the editable fields onto the current entity to avoid dropping
    // server-managed data (locations, customer groups, mixins, ...).
    const payload: EmporixLegalEntity = {
      ...current,
      name: update.name ?? current.name,
      legalInfo: update.legalInfo ? { ...current.legalInfo, ...update.legalInfo } : current.legalInfo,
      accountLimit: update.accountLimit ? { ...current.accountLimit, ...update.accountLimit } : current.accountLimit,
    } as EmporixLegalEntity;

    await this.customerManagementApi.updateLegalEntity(resolvedId, payload);

    const updated = await this.getCompanyDetails(resolvedId);
    if (!updated) {
      throw new Error('Failed to load updated company');
    }
    return updated;
  }

  async getCompanyGroups(companyId?: string): Promise<CompanyGroup[]> {
    const resolvedId = await this.resolveCompanyId(companyId);
    if (!resolvedId) {
      return [];
    }
    return this.mapCompanyGroups(await this.getCompanyGroupEntities(resolvedId));
  }

  /**
   * Fetch the IAM customer groups that belong to a specific legal entity.
   *
   * Groups are legal-entity-aware (`b2b.legalEntityId`), so we read them from
   * the Groups API and keep only the ones for the given company. This excludes
   * groups that belong to subsidiaries or other legal entities the user may
   * have access to.
   */
  private async getCompanyGroupEntities(companyId: string): Promise<(EmporixGroup & { id: string })[]> {
    const groups = await this.iamApi.getGroups({ size: 200 });
    return groups.filter(
      (group): group is EmporixGroup & { id: string } => !!group.id && group.b2b?.legalEntityId === companyId,
    );
  }

  async getTeamMembers(companyId?: string): Promise<TeamMember[]> {
    const resolvedId = await this.resolveCompanyId(companyId);
    if (!resolvedId) {
      return [];
    }

    const groups = await this.getCompanyGroupEntities(resolvedId);

    const [assignments, groupUserLists] = await Promise.all([
      this.customerManagementApi
        .getContactAssignmentsByLegalEntityId(resolvedId, 1, TEAM_PAGE_SIZE)
        .then((page) => page.items)
        .catch((err) => {
          this.logger.warn(
            { err: err instanceof Error ? err : String(err), legalEntityId: resolvedId },
            'Failed to load contact assignments',
          );
          return [] as EmporixContactAssignment[];
        }),
      Promise.all(
        groups.map((group) =>
          this.iamApi
            .getGroupUsers(group.id, { size: TEAM_PAGE_SIZE })
            .then((users) => users.items.map((u) => u.userId).filter((id): id is string => Boolean(id)))
            .catch(() => [] as string[]),
        ),
      ),
    ]);

    const members = new Map<string, TeamMember>();
    const ensure = (customerId: string): TeamMember => {
      let member = members.get(customerId);
      if (!member) {
        member = { customerId, groupIds: [], roles: [] };
        members.set(customerId, member);
      }
      return member;
    };

    // Roles come from group memberships.
    groups.forEach((group, index) => {
      const role = this.classifyGroup(group);
      for (const userId of groupUserLists[index]) {
        const member = ensure(userId);
        if (!member.groupIds.includes(group.id)) {
          member.groupIds.push(group.id);
        }
        if (!member.roles.includes(role)) {
          member.roles.push(role);
        }
      }
    });

    // Contact assignments carry the assignment metadata (and, when available,
    // some expanded customer fields).
    for (const assignment of assignments) {
      const customerId = assignment.customer?.id;
      if (!customerId) {
        continue;
      }
      const member = ensure(customerId);
      member.firstName = assignment.customer.name ?? member.firstName;
      member.lastName = assignment.customer.surname ?? member.lastName;
      member.email = assignment.customer.email ?? member.email;
      member.phone = assignment.customer.phone ?? member.phone;
      member.contactAssignmentId = assignment.id;
      member.contactType = assignment.type;
      member.primary = assignment.primary;
    }

    // The authoritative source for name/email is the customer profile, so fetch
    // each member's profile by id and fill in any missing details.
    await Promise.all(
      Array.from(members.values()).map(async (member) => {
        try {
          const profile = await this.customerApi.getCustomerById(member.customerId);
          member.firstName = profile.firstName ?? member.firstName;
          member.lastName = profile.lastName ?? member.lastName;
          member.email = profile.contactEmail ?? member.email;
          member.phone = profile.contactPhone ?? member.phone;
        } catch (err) {
          this.logger.warn(
            { err: err instanceof Error ? err : String(err), customerId: member.customerId },
            'Failed to load customer profile for team member',
          );
        }
      }),
    );

    return Array.from(members.values());
  }

  async createTeamMember(input: CreateTeamMemberInput, companyId?: string): Promise<TeamMember> {
    const resolvedId = await this.resolveCompanyId(companyId);
    if (!resolvedId) {
      throw new Error('No company selected');
    }

    const customerId = await this.resolveOrCreateCustomer(input);

    // Assigning the customer to the legal entity also makes the platform add
    // them to the company Contact group automatically.
    await this.ensureContactAssignment(customerId, resolvedId);

    // Add the explicitly selected groups (single managed role + any custom
    // groups). The Contact group is kept as well (handled by reconcile).
    await this.reconcileMemberGroups(customerId, resolvedId, input.groupIds);

    const members = await this.getTeamMembers(resolvedId);
    const created = members.find((member) => member.customerId === customerId);
    if (created) {
      return created;
    }

    return {
      customerId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      groupIds: input.groupIds,
      roles: [],
      contactType: 'CONTACT',
      primary: false,
    };
  }

  /**
   * Create the customer for a new team member, or reuse the existing account
   * when one already exists for the given email. Re-inviting someone (or
   * retrying after a partial failure) must not hard-fail with a duplicate error.
   */
  private async resolveOrCreateCustomer(input: CreateTeamMemberInput): Promise<string> {
    try {
      const { id } = await this.customerApi.signup({
        email: input.email,
        password: this.generateTemporaryPassword(),
        customerDetails: {
          firstName: input.firstName,
          lastName: input.lastName,
          contactEmail: input.email,
          businessModel: 'B2B',
        },
      });

      // New accounts get a password-setup email so the member can choose their
      // own password instead of the generated temporary one.
      try {
        await this.customerApi.passwordReset(input.email);
      } catch (err) {
        this.logger.warn(
          { err: err instanceof Error ? err : String(err), email: input.email },
          'Failed to send password setup email to new team member',
        );
      }

      return id;
    } catch (err) {
      if (!this.isDuplicateAccountError(err)) {
        throw err;
      }

      // The account already exists — recover it so we can (re)assign the
      // member to the company and groups.
      const existing = await this.customerApi.findCustomerByEmail(input.email);
      if (!existing?.id) {
        throw err;
      }
      this.logger.info(
        { email: input.email, customerId: existing.id },
        'Reusing existing customer account for team member',
      );
      return existing.id;
    }
  }

  private isDuplicateAccountError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return /conflict|duplicate|already exists|409/i.test(message);
  }

  /**
   * Ensure a contact assignment links the customer to the legal entity. Creating
   * the assignment also adds the customer to the company Contact group.
   */
  private async ensureContactAssignment(customerId: string, companyId: string): Promise<void> {
    try {
      const assignments = await this.customerManagementApi.getContactAssignmentsByCustomerId(customerId);
      const alreadyAssigned = assignments.some((assignment) => assignment.legalEntity?.id === companyId);
      if (alreadyAssigned) {
        return;
      }
    } catch (err) {
      // If the lookup fails we still attempt to create the assignment below.
      this.logger.warn(
        { err: err instanceof Error ? err : String(err), customerId, companyId },
        'Failed to check existing contact assignments before creating one',
      );
    }

    await this.customerManagementApi.createContactAssignment({
      legalEntity: { id: companyId },
      customer: { id: customerId },
      type: 'CONTACT',
      primary: false,
    });
  }

  async updateTeamMemberGroups(customerId: string, groupIds: string[], companyId?: string): Promise<TeamMember> {
    const resolvedId = await this.resolveCompanyId(companyId);
    if (!resolvedId) {
      throw new Error('No company selected');
    }

    await this.reconcileMemberGroups(customerId, resolvedId, groupIds);

    const members = await this.getTeamMembers(resolvedId);
    const updated = members.find((member) => member.customerId === customerId);
    if (updated) {
      return updated;
    }
    return {
      customerId,
      groupIds,
      roles: [],
    };
  }

  /**
   * Reconcile a member's company group memberships to match the desired set.
   *
   * Rules enforced here:
   * - The member is always kept in the company's Contact group(s).
   * - At most one managed role group (Admin / Buyer / Requester) is allowed.
   * - Any number of custom groups is allowed.
   * Groups not in the resulting target set are removed; groups in it are added.
   */
  private async reconcileMemberGroups(customerId: string, companyId: string, desiredGroupIds: string[]): Promise<void> {
    const groups = await this.getCompanyGroupEntities(companyId);
    const groupById = new Map(groups.map((group) => [group.id, group]));

    // Only consider ids that actually belong to this company.
    const requested = desiredGroupIds.filter((id) => groupById.has(id));

    // Reject more than one managed role group.
    const managedRequested = requested.filter((id) =>
      PREDEFINED_MANAGED_ROLES.includes(this.classifyGroup(groupById.get(id)!)),
    );
    if (managedRequested.length > 1) {
      throw new Error('A member can only belong to one of the Admin, Buyer or Requester role groups');
    }

    // Always keep the member in the company's Contact group(s).
    const contactGroupIds = groups.filter((group) => this.classifyGroup(group) === 'CONTACT').map((group) => group.id);
    const target = new Set<string>([...requested, ...contactGroupIds]);

    for (const group of groups) {
      try {
        const { items: users } = await this.iamApi.getGroupUsers(group.id, { size: TEAM_PAGE_SIZE });
        const isMember = users.some((user) => user.userId === customerId);
        const shouldBeMember = target.has(group.id);

        if (shouldBeMember && !isMember) {
          await this.iamApi.addUserToGroup(group.id, { userId: customerId, userType: 'CUSTOMER' });
        } else if (!shouldBeMember && isMember) {
          await this.iamApi.removeUserFromGroup(group.id, customerId);
        }
      } catch (err) {
        this.logger.warn(
          { err: err instanceof Error ? err : String(err), groupId: group.id, customerId },
          'Failed to reconcile member group membership',
        );
      }
    }
  }

  async removeTeamMember(customerId: string, companyId?: string): Promise<void> {
    const resolvedId = await this.resolveCompanyId(companyId);
    if (!resolvedId) {
      throw new Error('No company selected');
    }

    const groups = await this.getCompanyGroupEntities(resolvedId);

    for (const group of groups) {
      try {
        const { items: users } = await this.iamApi.getGroupUsers(group.id, { size: TEAM_PAGE_SIZE });
        if (users.some((user) => user.userId === customerId)) {
          await this.iamApi.removeUserFromGroup(group.id, customerId);
        }
      } catch (err) {
        this.logger.warn(
          { err: err instanceof Error ? err : String(err), groupId: group.id, customerId },
          'Failed to remove member from group',
        );
      }
    }

    try {
      const { items: assignments } = await this.customerManagementApi.getContactAssignmentsByLegalEntityId(
        resolvedId,
        1,
        TEAM_PAGE_SIZE,
      );
      for (const assignment of assignments) {
        if (assignment.customer?.id === customerId && assignment.id) {
          await this.customerManagementApi.deleteContactAssignment(assignment.id);
        }
      }
    } catch (err) {
      this.logger.warn(
        { err: err instanceof Error ? err : String(err), customerId },
        'Failed to delete member contact assignment',
      );
    }
  }

  async getLegalEntityCheckoutAddresses(): Promise<CustomerAddress[]> {
    try {
      const legalEntityId = await this.resolveCompanyId();
      if (!legalEntityId) {
        return [];
      }

      const entity = await this.customerManagementApi.getLegalEntityById(legalEntityId);
      if (!entity) {
        return [];
      }

      const companyName = entity.legalInfo?.legalName || entity.name;
      const locations = await this.resolveLegalEntityLocations(entity);

      return locations
        .map((loc) => mapLegalEntityLocationToCustomerAddress(loc, companyName))
        .filter((addr): addr is CustomerAddress => addr !== null);
    } catch (err) {
      this.logger.error({ err: err instanceof Error ? err : String(err) }, 'Legal entity checkout addresses failed');
      return [];
    }
  }

  private isExpandedEmporixLocation(value: unknown): value is EmporixLocation {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const loc = value as Partial<EmporixLocation>;
    return (
      typeof loc.name === 'string' &&
      typeof loc.type === 'string' &&
      loc.contactDetails !== undefined &&
      loc.contactDetails !== null
    );
  }

  private async resolveLegalEntityLocations(entity: EmporixLegalEntity): Promise<EmporixLocation[]> {
    const raw = entity.entitiesAddresses ?? [];
    const out: EmporixLocation[] = [];

    for (const item of raw as unknown[]) {
      if (this.isExpandedEmporixLocation(item)) {
        out.push(item);
        continue;
      }

      const id =
        typeof item === 'object' && item !== null && 'id' in item && typeof (item as EmporixResourceId).id === 'string'
          ? (item as EmporixResourceId).id
          : undefined;

      if (!id) {
        continue;
      }

      try {
        const loc = await this.customerManagementApi.getLocationById(id);
        if (loc && this.isExpandedEmporixLocation(loc)) {
          out.push(loc);
        }
      } catch (err) {
        this.logger.warn(
          { err: err instanceof Error ? err : String(err), locationId: id },
          'Skipped legal-entity location reference',
        );
      }
    }

    return out;
  }

  async getCompanies(): Promise<Company[]> {
    // Get customer profile with b2b.legalEntities data
    const customerProfile = await this.customerApi.getCustomerProfile();

    if (!customerProfile || !customerProfile.b2b?.legalEntities) {
      return [];
    }

    const companies: Company[] = [];
    for (const legalEntity of customerProfile.b2b.legalEntities) {
      if (legalEntity.id && legalEntity.name) {
        companies.push({
          id: legalEntity.id,
          name: legalEntity.name,
          onboarding: {
            status: this.mapStatus(undefined),
            updatedAt: new Date(),
          },
        });
      }
    }

    return companies;
  }

  mapStatus(internalrating?: string): 'approved' | 'pending' | 'rejected' {
    if (!internalrating) {
      return 'pending';
    }
    switch (internalrating) {
      case 'approved':
      case 'auto-approved':
      case 'whitelisted':
        return 'approved';
      case 'blacklisted':
        return 'rejected';
      default:
        return 'pending';
    }
  }

  /** Normalize an IAM customer group into one of the well-known company roles. */
  private classifyGroup(group: EmporixGroup): CompanyRole {
    // Predefined groups expose their role directly on the b2b attribute.
    const role = group.b2b?.role?.toUpperCase();
    if (role === 'ADMIN' || role === 'BUYER' || role === 'REQUESTER' || role === 'CONTACT') {
      return role;
    }

    // Otherwise fall back to a name/code heuristic.
    const candidates = [group.b2b?.role, group.code, ...Object.values(group.name ?? {})]
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.toLowerCase());

    const matches = (keyword: string) => candidates.some((value) => value.includes(keyword));

    if (matches('admin')) return 'ADMIN';
    if (matches('buyer')) return 'BUYER';
    if (matches('requester')) return 'REQUESTER';
    if (matches('contact')) return 'CONTACT';
    return 'OTHER';
  }

  private mapCompanyGroups(groups: (EmporixGroup & { id: string })[]): CompanyGroup[] {
    return groups.map((group) => {
      const localizedName = Object.values(group.name ?? {}).find((value): value is string => typeof value === 'string');
      return {
        id: group.id,
        role: this.classifyGroup(group),
        rawRole: group.b2b?.role,
        name: localizedName ?? group.code ?? group.b2b?.role ?? group.id,
      };
    });
  }

  /** Generate a temporary password that satisfies the default password policy. */
  private generateTemporaryPassword(): string {
    const random = randomUUID().replace(/-/g, '').slice(0, 16);
    return `Aa1!${random}`;
  }
}
export default EmporixCompanyService;
