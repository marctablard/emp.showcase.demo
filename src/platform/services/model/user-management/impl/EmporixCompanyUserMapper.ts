import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCustomerAdmin } from '@/platform/integrations/emporix/model/customer';
import type { EmporixGroup } from '@/platform/integrations/emporix/model/iam';
import type { CompanyUser, CompanyUserGroup } from '@/platform/services/model/user-management/company-user';

const CUSTOMER_GROUP_CODE = 'CUSTOMER';

export interface CompanyUserMappingContext {
  groups: EmporixGroup[];
  companyNameByLegalEntityId: ReadonlyMap<string, string>;
  legalEntityId?: string;
  legalEntityName?: string;
  isSelectedLegalEntityMember?: boolean;
}

/**
 * Maps tenant-managed customer DTOs and IAM groups onto {@link CompanyUser}.
 * `CompanyUser.id` is `{customerNumber}` (GET/PATCH/DELETE path), not assignment `customer.id`.
 */
@injectable('EmporixCompanyUserMapper', 'Singleton')
class EmporixCompanyUserMapper {
  mapToService(source: EmporixCustomerAdmin, context: CompanyUserMappingContext): CompanyUser {
    const mapped: CompanyUser = {
      id: source.customerNumber || source.id,
      title: source.title,
      firstName: source.firstName ?? '',
      lastName: source.lastName ?? '',
      contactEmail: source.contactEmail ?? '',
      contactPhone: source.contactPhone,
      active: source.active === true,
      createdAt: source.metadataCreatedAt ?? source.metadata?.createdAt,
      groups: this.mapGroups(context.groups, context.companyNameByLegalEntityId),
    };
    if (context.legalEntityId !== undefined) {
      mapped.legalEntityId = context.legalEntityId;
    }
    if (context.legalEntityName !== undefined) {
      mapped.legalEntityName = context.legalEntityName;
    }
    if (context.isSelectedLegalEntityMember !== undefined) {
      mapped.isSelectedLegalEntityMember = context.isSelectedLegalEntityMember;
    }
    return mapped;
  }

  private mapGroups(
    groups: EmporixGroup[],
    companyNameByLegalEntityId: ReadonlyMap<string, string>,
  ): CompanyUserGroup[] {
    const mapped: CompanyUserGroup[] = [];

    for (const group of groups) {
      if (!group.id || group.code === CUSTOMER_GROUP_CODE) {
        continue;
      }

      const legalEntityId = group.b2b?.legalEntityId ?? '';
      const companyName = (legalEntityId && companyNameByLegalEntityId.get(legalEntityId)) || legalEntityId;
      const role = this.toRoleLabel(group);

      mapped.push({
        id: group.id,
        legalEntityId,
        displayName: `${companyName} - ${role}`,
      });
    }

    return mapped;
  }

  /**
   * Jira picker labels: B2B_ADMIN→Admin, B2B_BUYER→Buyer, B2B_REQUESTER→Requestor, Contact→Contact.
   */
  private toRoleLabel(group: EmporixGroup): string {
    const code = group.code;
    if (code === 'B2B_ADMIN') {
      return 'Admin';
    }
    if (code === 'B2B_BUYER') {
      return 'Buyer';
    }
    if (code === 'B2B_REQUESTER') {
      return 'Requestor';
    }
    if (code === 'CONTACT') {
      return 'Contact';
    }

    const role = group.b2b?.role;
    if (role === 'Requester') {
      return 'Requestor';
    }
    if (role === 'Admin' || role === 'Buyer' || role === 'Contact' || role === 'Requestor') {
      return role;
    }

    return code || role || '';
  }
}

export default EmporixCompanyUserMapper;
