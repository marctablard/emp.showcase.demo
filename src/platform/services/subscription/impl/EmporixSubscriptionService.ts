import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCustomEntity } from '@/platform/integrations/emporix/model/schema';
import type { EmporixSchemaApi } from '@/platform/integrations/emporix/schema/EmporixSchemaApi';
import type { Paginated, PaginationQuery } from '@/platform/services/model/common';
import type { SessionService } from '@/platform/services/session/SessionService';
import type {
  Subscription,
  SubscriptionConfiguration,
  SubscriptionItem,
  SubscriptionOrderHistoryEntry,
  SubscriptionQuery,
  SubscriptionService,
  SubscriptionUpsertRequest,
} from '../SubscriptionService';

const DEFAULT_SUBSCRIPTION_ENTITY_TYPE = process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENTITY_TYPE || 'SUBSCRIPTIONS';

@injectable('SubscriptionService', 'Singleton')
export class EmporixSubscriptionService implements SubscriptionService {
  constructor(
    @inject('EmporixSchemaApi') private schemaApi: EmporixSchemaApi,
    @inject('SessionService') private sessionService: SessionService,
  ) {}

  private get type(): string {
    return DEFAULT_SUBSCRIPTION_ENTITY_TYPE;
  }

  private mapFromCustomEntity(entity: EmporixCustomEntity): Subscription {
    const mixins = entity.mixins || {};
    const itemsMixin = (mixins.subscriptionitems as any) || {};
    const configMixin = (mixins.configuration as any) || {};
    const ordersMixin = (mixins.orders as any) || {};

    const items: SubscriptionItem[] = Array.isArray(itemsMixin.items)
      ? itemsMixin.items.map((item: any) => ({
          productId: item.product?.id || '',
          quantity: item.quantity || 0,
        }))
      : [];

    const configuration: SubscriptionConfiguration = {
      active: Boolean(configMixin.active),
      companyId: configMixin.company?.id || '',
      customerId: configMixin.customer?.id || '',
      dateCreated: configMixin.datecreated,
      endDate: configMixin.enddate ?? null,
      frequency: Number(configMixin.frequency) || 1,
      interval: configMixin.interval || 'months',
      lastOrderDate: configMixin.lastorderdate ?? null,
      nextOrderDate: configMixin.nextorderdate ?? null,
      notificationDate: configMixin.notificationdate ?? null,
      paymentMethod: configMixin.paymentmethod || 'INVOICE',
      shippingAddressId: configMixin.shippingaddressid,
    };

    const orders: SubscriptionOrderHistoryEntry[] = Array.isArray(ordersMixin.history)
      ? ordersMixin.history.map((entry: any) => ({
          date: entry.date || '',
          orderId: entry.order?.id || '',
        }))
      : [];

    return {
      id: entity.id!,
      name: entity.name?.en,
      items,
      configuration,
      orders,
    };
  }

  private buildCustomEntityPayload(request: SubscriptionUpsertRequest): EmporixCustomEntity {
    const nowIso = new Date().toISOString();
    const config = request.configuration;

    const nextOrderDate = config.nextOrderDate || nowIso.split('T')[0];
    const notificationDate =
      config.notificationDate ||
      new Date(new Date(nextOrderDate).getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const itemsMixin = {
      items: request.items.map((item) => ({
        product: {
          emporixReferenceType: 'PRODUCT',
          id: item.productId,
        },
        quantity: item.quantity,
      })),
    };

    const configurationMixin = {
      active: config.active,
      company: {
        emporixReferenceType: 'COMPANY',
        id: config.companyId,
      },
      customer: {
        emporixReferenceType: 'CUSTOMER',
        id: config.customerId,
      },
      datecreated: config.dateCreated || nowIso,
      enddate: config.endDate ?? null,
      frequency: config.frequency,
      interval: config.interval,
      lastorderdate: config.lastOrderDate ?? null,
      nextorderdate: nextOrderDate,
      notificationdate: notificationDate,
      paymentmethod: config.paymentMethod || 'INVOICE',
      shippingaddressid: config.shippingAddressId,
    };

    return {
      id: request.id,
      type: this.type,
      name: request.name ? { en: request.name } : undefined,
      mixins: {
        subscriptionitems: itemsMixin,
        configuration: configurationMixin,
      },
      metadata: {
        mixins: {},
      },
    };
  }

  private async getCurrentCustomerId(): Promise<string> {
    const session = await this.sessionService.getCurrent();
    if (!session?.customerId) {
      throw new Error('Subscriptions are only available for authenticated customers.');
    }
    return session.customerId;
  }

  async getSubscriptionsForCurrentCustomer(query: SubscriptionQuery): Promise<Paginated<Subscription>> {
    const customerId = await this.getCurrentCustomerId();

    const pagination: PaginationQuery = {
      page: query.page ?? 0,
      size: query.size ?? 10,
    };

    // Fetch all subscriptions of this type and filter by customer ID
    // Emporix search query syntax for nested mixins may not work reliably
    const response = await this.schemaApi.getCustomEntities(this.type, {
      page: 0,
      size: 1000, // Fetch a large batch to ensure we get all subscriptions
    });

    // Filter by customer ID
    const filteredItems = response.items.filter((entity) => {
      const configMixin = (entity.mixins?.configuration as any) || {};
      const entityCustomerId = configMixin.customer?.id;
      return entityCustomerId === customerId;
    });

    // Apply pagination to filtered results
    const startIndex = pagination.page * (query.size ?? 10);
    const endIndex = startIndex + (query.size ?? 10);
    const paginatedItems = filteredItems.slice(startIndex, endIndex);

    return {
      items: paginatedItems.map((e) => this.mapFromCustomEntity(e)),
      page: pagination.page,
      pageSize: query.size ?? 10,
      total: filteredItems.length,
    };
  }

  async getSubscription(id: string): Promise<Subscription | null> {
    const entity = await this.schemaApi.getCustomEntity(this.type, id);
    if (!entity) {
      return null;
    }
    return this.mapFromCustomEntity(entity);
  }

  async upsertSubscription(request: SubscriptionUpsertRequest): Promise<Subscription> {
    const payload = this.buildCustomEntityPayload(request);

    let id = request.id;
    if (!id) {
      id = await this.schemaApi.createCustomEntity(this.type, payload);
    } else {
      await this.schemaApi.updateCustomEntity(this.type, id, payload);
    }

    const updated = await this.schemaApi.getCustomEntity(this.type, id);
    if (!updated) {
      throw new Error('Failed to load subscription after save.');
    }
    return this.mapFromCustomEntity(updated);
  }

  async pauseSubscription(id: string): Promise<void> {
    await this.schemaApi.patchCustomEntity(this.type, id, [
      {
        op: 'replace',
        path: '/mixins/configuration/active',
        value: false,
      },
    ]);
  }

  async resumeSubscription(id: string): Promise<void> {
    await this.schemaApi.patchCustomEntity(this.type, id, [
      {
        op: 'replace',
        path: '/mixins/configuration/active',
        value: true,
      },
    ]);
  }

  async cancelSubscription(id: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    await this.schemaApi.patchCustomEntity(this.type, id, [
      {
        op: 'replace',
        path: '/mixins/configuration/active',
        value: false,
      },
      {
        op: 'replace',
        path: '/mixins/configuration/enddate',
        value: today,
      },
    ]);
  }
}

export default EmporixSubscriptionService;
