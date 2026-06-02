import { inject } from 'inversify';
import { getPublicDefaultSite } from '@/lib/common/public-default-env';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCustomEntity } from '@/platform/integrations/emporix/model/schema';
import type { EmporixSchemaApi } from '@/platform/integrations/emporix/schema/EmporixSchemaApi';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Customer } from '@/platform/services/model/customer/customer';
import type {
  FormSubmission,
  FormSubmissionCreateInput,
  FormSubmissionCustomerRef,
  FormSubmissionFormData,
  FormSubmissionUpdateInput,
} from '@/platform/services/model/form-submission/form-submission';
import type { RequestContextService } from '@/platform/services/request-context/RequestContextService';
import type { SessionService } from '@/platform/services/session/SessionService';
import type { FormSubmissionService as IFormSubmissionService } from '../FormSubmissionService';

type FormSubmissionMixin = {
  customer?: {
    customer?: { emporixReferenceType: 'CUSTOMER'; id: string };
    company?: { emporixReferenceType: 'COMPANY'; id: string };
  };
  formdata?: {
    subject?: string;
    email?: string;
    phone?: string;
    description?: string;
  };
  site?: {
    sitecode?: string;
  };
};

@injectable('FormSubmissionService', 'Singleton')
export class EmporixFormSubmissionService implements IFormSubmissionService {
  private readonly ENTITY_TYPE = 'FORMSUBMISSIONS';
  private readonly MIXIN_KEY = 'formsubmissiondata';

  constructor(
    @inject('EmporixSchemaApi') private schemaApi: EmporixSchemaApi,
    @inject('SessionService') private sessionService: SessionService,
    @inject('RequestContextService') private requestContext: RequestContextService,
    @inject('CustomerService') private customerService: CustomerService,
    @inject('LoggerService') private logger: LoggerService,
  ) {}

  async createFormSubmission(input: FormSubmissionCreateInput): Promise<string> {
    const siteCode = await this.resolveSiteCode();

    const customer = await this.customerService.getCustomer();
    const customerRef = this.buildCustomerRef(customer);
    const entity = this.mapToSource({
      formData: input.formData,
      siteCode,
      customerRef,
      customer,
    });
    await this.ensureMixinMetadata(entity);

    try {
      return await this.schemaApi.createCustomEntity(this.ENTITY_TYPE, entity);
    } catch (error) {
      this.logger.error({ err: error instanceof Error ? error : String(error) }, 'Failed to create form submission');
      throw new Error(`Failed to create form submission: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getFormSubmission(id: string): Promise<FormSubmission> {
    const entity = await this.schemaApi.getCustomEntity(this.ENTITY_TYPE, id);
    if (!entity) {
      throw new Error(`Form submission ${id} not found`);
    }
    return this.mapToService(entity);
  }

  async updateFormSubmission(id: string, input: FormSubmissionUpdateInput): Promise<void> {
    const existing = await this.schemaApi.getCustomEntity(this.ENTITY_TYPE, id);
    if (!existing) {
      throw new Error(`Form submission ${id} not found`);
    }

    const current = this.mapToService(existing);
    const mergedFormData: FormSubmissionFormData = {
      ...current.formData,
      ...input.formData,
    };

    const customer = await this.customerService.getCustomer();
    const customerRef = this.buildCustomerRef(customer) ?? current.customer;

    const siteCode = current.site.siteCode || (await this.resolveSiteCode());
    const entity = this.mapToSource({
      formData: mergedFormData,
      siteCode,
      customerRef,
      customer,
      existingEntity: existing,
    });
    await this.ensureMixinMetadata(entity);

    try {
      await this.schemaApi.updateCustomEntity(this.ENTITY_TYPE, id, {
        ...entity,
        id,
        type: this.ENTITY_TYPE,
      });
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error : String(error), id },
        'Failed to update form submission',
      );
      throw new Error(`Failed to update form submission: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private buildCustomerRef(customer: Customer | null | undefined): FormSubmissionCustomerRef | undefined {
    if (!customer?.id) {
      return undefined;
    }
    const ref: FormSubmissionCustomerRef = { customerId: customer.id };
    if (customer.legalEntityId) {
      ref.companyId = customer.legalEntityId;
    }
    return ref;
  }

  private buildEntityName(customer: Customer | null | undefined, formData: FormSubmissionFormData): string {
    const parts = [customer?.firstName, customer?.lastName].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(' ').trim();
    }
    if (formData.subject?.trim()) {
      return formData.subject.trim();
    }
    if (formData.email?.trim()) {
      return formData.email.trim();
    }
    return 'Form submission';
  }

  private buildLocalizedName(name: string): Record<string, string> {
    return { en: name };
  }

  private async resolveSiteCode(): Promise<string> {
    const session = await this.sessionService.getCurrent();
    if (session?.siteCode) {
      return session.siteCode;
    }
    try {
      return await this.requestContext.getSite();
    } catch {
      return getPublicDefaultSite();
    }
  }

  /**
   * Emporix requires metadata.mixins URLs when posting mixin data.
   * createCustomEntity resolves these via getSchema, but only when the schema id matches.
   */
  private async ensureMixinMetadata(entity: EmporixCustomEntity): Promise<void> {
    if (!entity.mixins?.[this.MIXIN_KEY]) {
      return;
    }

    entity.metadata ??= {};
    entity.metadata.mixins ??= {};

    if (entity.metadata.mixins[this.MIXIN_KEY]) {
      return;
    }

    const schemaIds = [this.MIXIN_KEY, 'FORMSUBMISSIONDATA'];
    for (const schemaId of schemaIds) {
      try {
        const schema = await this.schemaApi.getSchema(schemaId);
        if (schema.metadata?.url) {
          entity.metadata.mixins[this.MIXIN_KEY] = schema.metadata.url;
          return;
        }
      } catch {
        // try next schema id
      }
    }

    this.logger.warn(
      { mixinKey: this.MIXIN_KEY, schemaIds },
      'Could not resolve formsubmissiondata schema URL — Emporix create may fail',
    );
  }

  private mapToSource(params: {
    formData: FormSubmissionFormData;
    siteCode: string;
    customerRef?: FormSubmissionCustomerRef;
    customer?: Customer | null;
    existingEntity?: EmporixCustomEntity;
  }): EmporixCustomEntity {
    const { formData, siteCode, customerRef, customer, existingEntity } = params;
    const mixin: FormSubmissionMixin = {
      formdata: {
        subject: formData.subject,
        email: formData.email,
        phone: formData.phone,
        description: formData.description,
      },
      site: {
        sitecode: siteCode,
      },
    };

    if (customerRef?.customerId || customerRef?.companyId) {
      mixin.customer = {};
      if (customerRef.customerId) {
        mixin.customer.customer = {
          emporixReferenceType: 'CUSTOMER',
          id: customerRef.customerId,
        };
      }
      if (customerRef.companyId) {
        mixin.customer.company = {
          emporixReferenceType: 'COMPANY',
          id: customerRef.companyId,
        };
      }
    }

    const name = this.buildLocalizedName(this.buildEntityName(customer, formData));

    return {
      type: this.ENTITY_TYPE,
      name,
      mixins: {
        [this.MIXIN_KEY]: mixin,
      },
      metadata: existingEntity?.metadata,
      owner: existingEntity?.owner,
    };
  }

  private mapToService(entity: EmporixCustomEntity): FormSubmission {
    const mixin = entity.mixins?.[this.MIXIN_KEY] as FormSubmissionMixin | undefined;
    if (!mixin || !entity.id) {
      throw new Error(`Form submission ${entity.id ?? 'unknown'} is missing ${this.MIXIN_KEY} mixin or id`);
    }

    const formData = mixin.formdata ?? {};
    const customerMixin = mixin.customer;

    const localizedName = entity.name?.en ?? 'Form submission';

    return {
      id: entity.id,
      name: localizedName,
      formData: {
        subject: formData.subject ?? '',
        email: formData.email,
        phone: formData.phone,
        description: formData.description,
      },
      customer: customerMixin?.customer?.id
        ? {
            customerId: customerMixin.customer.id,
            companyId: customerMixin.company?.id,
          }
        : undefined,
      site: {
        siteCode: mixin.site?.sitecode ?? '',
      },
      created: entity.metadata?.createdAt,
      modified: entity.metadata?.modifiedAt,
    };
  }
}

export default EmporixFormSubmissionService;
