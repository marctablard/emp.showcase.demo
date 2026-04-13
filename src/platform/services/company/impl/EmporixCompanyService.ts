import { inject } from 'inversify';
import { resolveLegalEntityIdFromSessionAndCustomer } from '@/lib/common/legal-entity-context';
import { mapLegalEntityLocationToCustomerAddress } from '@/lib/common/map-legal-entity-location-to-customer-address';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCustomerApi } from '@/platform/integrations/emporix/customer/EmporixCustomerApi';
import type { EmporixCustomerManagementApi } from '@/platform/integrations/emporix/customer/EmporixCustomerManagementApi';
import type { EmporixLegalEntity, EmporixLocation, EmporixResourceId } from '@/platform/integrations/emporix/model';
import type { CustomerService } from '../../customer/CustomerService';
import type { LoggerService } from '../../logger/LoggerService';
import { Company } from '../../model/company/company';
import type { CustomerAddress } from '../../model/customer/customer';
import type { SessionService } from '../../session';
import type { CompanyService } from '../CompanyService';

@injectable('CompanyService', 'Singleton')
export class EmporixCompanyService implements CompanyService {
  constructor(
    @inject('EmporixCustomerManagementApi')
    private readonly customerManagementApi: EmporixCustomerManagementApi,
    @inject('EmporixCustomerApi')
    private readonly customerApi: EmporixCustomerApi,
    @inject('CustomerService')
    private readonly customerService: CustomerService,
    @inject('SessionService')
    private readonly sessionService: SessionService,
    @inject('LoggerService')
    private readonly logger: LoggerService,
  ) {}

  async getCompany(companyId?: string): Promise<Company | null> {
    if (!companyId) {
      const session = await this.sessionService.getCurrent();
      const customer = await this.customerService.getCustomer();
      if (!customer) {
        return null;
      }
      companyId = resolveLegalEntityIdFromSessionAndCustomer(session, customer);
    }

    if (!companyId) {
      return null;
    }
    const emporixLegalEntity = await this.customerManagementApi.getLegalEntityById(companyId);
    if (!emporixLegalEntity) {
      return null;
    }
    const creditscore = emporixLegalEntity.mixins?.['creditscore'];

    return {
      id: emporixLegalEntity.id,
      name: emporixLegalEntity.name,
      onboarding: {
        status: this.mapStatus(creditscore?.internalrating),
        updatedAt: creditscore?.statusupdate || new Date(),
      },
    };
  }

  async getLegalEntityCheckoutAddresses(): Promise<CustomerAddress[]> {
    try {
      const session = await this.sessionService.getCurrent();
      const customer = await this.customerService.getCustomer();
      if (!customer) {
        return [];
      }

      const legalEntityId = resolveLegalEntityIdFromSessionAndCustomer(session, customer);
      if (!legalEntityId) {
        return [];
      }

      const entity = await this.customerManagementApi.getLegalEntityById(legalEntityId);
      if (!entity) {
        return [];
      }

      const companyName = entity.legalInfo?.legalName || entity.name;
      const locations = await this.resolveLegalEntityLocations(entity);

      return locations.map((loc) => mapLegalEntityLocationToCustomerAddress(loc, companyName));
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
}
export default EmporixCompanyService;
