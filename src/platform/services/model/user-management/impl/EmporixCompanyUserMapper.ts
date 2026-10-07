import { routingConfig } from '@/i18n/routing';
import { l10nOrEmpty } from '@/lib/l10n';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCustomerAdmin } from '@/platform/integrations/emporix/model/customer';
import type { EmporixGroup } from '@/platform/integrations/emporix/model/iam';
import type { CompanyUser, CompanyUserGroup } from '@/platform/services/model/user-management/company-user';

const CUSTOMER_GROUP_CODE = 'CUSTOMER';

export interface CompanyUserMappingContext {
  groups: EmporixGroup[];
  companyNameByLegalEntityId: ReadonlyMap<string, string>;
  /** Storefront locale used to resolve custom IAM group `name` maps. */
  locale?: string;
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
      groups: this.mapGroups(context.groups, context.companyNameByLegalEntityId, context.locale),
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
    locale?: string,
  ): CompanyUserGroup[] {
    const mapped: CompanyUserGroup[] = [];
    const displayLocale = locale?.trim() || routingConfig.defaultLocale;

    for (const group of groups) {
      if (!group.id || group.code === CUSTOMER_GROUP_CODE) {
        continue;
      }

      const legalEntityId = group.b2b?.legalEntityId ?? '';
      const companyName = (legalEntityId && companyNameByLegalEntityId.get(legalEntityId)) || legalEntityId;
      const role = this.toRoleLabel(group, displayLocale);

      mapped.push({
        id: group.id,
        legalEntityId,
        displayName: role ? `${companyName} - ${role}` : companyName,
      });
    }

    return mapped;
  }

  /**
   * Jira picker labels: B2B_ADMIN→Admin, B2B_BUYER→Buyer, B2B_REQUESTER→Requestor, Contact→Contact.
   * Custom groups use IAM localized `name` (Accept-Language: * map or resolved string).
   */
  private toRoleLabel(group: EmporixGroup, locale: string): string {
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

    return localizedCustomGroupName(group.name, locale) || code || role || '';
  }
}

function localizedCustomGroupName(name: EmporixGroup['name'], locale: string): string {
  const language = locale.split(/[-_]/)[0] || locale;
  const resolved = l10nOrEmpty(name, language, routingConfig.defaultLocale, locale);
  if (resolved) {
    return resolved;
  }
  if (!name || typeof name !== 'object' || Array.isArray(name)) {
    return '';
  }
  const first = Object.values(name).find((value): value is string => typeof value === 'string' && value.trim() !== '');
  return first?.trim() ?? '';
}

export default EmporixCompanyUserMapper;
