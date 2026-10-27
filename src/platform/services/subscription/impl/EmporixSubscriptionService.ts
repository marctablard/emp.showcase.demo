import { inject } from 'inversify';
import { resolveLegalEntityIdFromSessionAndCustomer } from '@/lib/common/legal-entity-context';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixApiInvoker from '@/platform/integrations/emporix/common/impl/EmporixApiInvoker';
import { extractItemsFromPaginatedJsonBody } from '@/platform/integrations/emporix/common/util/common';
import type { EmporixConfig } from '@/platform/integrations/emporix/config';
import type { EmporixOrder } from '@/platform/integrations/emporix/model/order';
import type { EmporixProduct } from '@/platform/integrations/emporix/model/product';
import type { EmporixOrderApi } from '@/platform/integrations/emporix/order/EmporixOrderApi';
import type { EmporixProductApi } from '@/platform/integrations/emporix/product/EmporixProductApi';
import type { CompanyService } from '@/platform/services/company/CompanyService';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { CustomerRole } from '@/platform/services/model/customer/roles';
import type { SessionService } from '@/platform/services/session/SessionService';
import type { SubscriptionService } from '../SubscriptionService';
import {
  type SubscriptionActor,
  SubscriptionRequestError,
  canReadSubscription,
  companyListDecision,
} from '../subscription-access';
import {
  type RenewPlan,
  type Subscription,
  type SubscriptionInterval,
  type SubscriptionItem,
  SubscriptionPlanError,
  type SubscriptionProductRef,
  type SubscriptionStatus,
  isSubscriptionInterval,
  itemsLockCadence,
  planRenewal,
  scheduleFrom,
  withCadence,
  withItems,
  withStatus,
} from '../subscription-rules';

const ENTITY = 'SUBSCRIPTIONS';
const MIXIN_IDS = ['configuration', 'subscriptionitems', 'orders'] as const;
const READ_SCOPES = ['schema.custominstance_read'];
const WRITE_SCOPES = ['schema.custominstance_manage'];

type Ref = { id?: string; emporixReferenceType?: string };
type ConfigurationMixin = {
  active?: boolean;
  status?: string;
  frequencylocked?: boolean;
  company?: Ref;
  customer?: Ref;
  enddate?: string | null;
  interval?: string;
  frequency?: number;
  datecreated?: string;
  lastorderdate?: string;
  nextorderdate?: string;
  paymentmethod?: string;
  notificationdate?: string;
  shippingaddressid?: string | null;
};
type RawInstance = {
  id: string;
  name?: Record<string, string> | string;
  mixins?: {
    configuration?: ConfigurationMixin;
    subscriptionitems?: { items?: { product?: Ref; quantity?: number }[] };
    orders?: { history?: { date?: string; order?: Ref }[] };
    [key: string]: unknown;
  };
  metadata?: { version?: number; createdAt?: string; modifiedAt?: string; mixins?: Record<string, string> };
};

const qValue = (value: string): string => (/^[\w.@-]+$/.test(value) ? value : `"${value.replace(/"/g, '\\"')}"`);

const statusOf = (config: ConfigurationMixin): SubscriptionStatus => {
  if (config.status === 'ACTIVE' || config.status === 'PAUSED' || config.status === 'CANCELLED') return config.status;
  if (config.active === false && config.enddate) return 'CANCELLED';
  if (config.active === false) return 'PAUSED';
  return 'ACTIVE';
};

const localize = (name: RawInstance['name'], fallback: string): string => {
  if (typeof name === 'string' && name.trim()) return name;
  if (name && typeof name === 'object') {
    return name.en || Object.values(name).find((value) => value) || fallback;
  }
  return fallback;
};

const toSubscription = (instance: RawInstance): Subscription => {
  const config = instance.mixins?.configuration ?? {};
  const unit = isSubscriptionInterval(config.interval) ? config.interval : 'months';
  const every = typeof config.frequency === 'number' && config.frequency >= 1 ? config.frequency : 1;
  const status = statusOf(config);
  return {
    id: instance.id,
    name: localize(instance.name, instance.id),
    companyId: config.company?.id || undefined,
    customerId: config.customer?.id || undefined,
    status,
    active: config.active !== false && status === 'ACTIVE',
    every,
    unit,
    frequencyLocked: config.frequencylocked === true,
    paymentMethod: config.paymentmethod || undefined,
    shippingAddressId: config.shippingaddressid || undefined,
    createdAt: config.datecreated,
    lastOrderDate: config.lastorderdate,
    nextOrderDate: config.nextorderdate,
    notificationDate: config.notificationdate,
    endDate: config.enddate || undefined,
    items: (instance.mixins?.subscriptionitems?.items ?? [])
      .filter((item) => item.product?.id)
      .map((item) => ({
        productId: item.product?.id as string,
        quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
      })),
    orders: (instance.mixins?.orders?.history ?? [])
      .filter((entry) => entry.order?.id)
      .map((entry) => ({ orderId: entry.order?.id as string, date: entry.date ?? '' })),
  };
};

const configurationOf = (sub: Subscription): ConfigurationMixin => ({
  active: sub.status === 'ACTIVE',
  status: sub.status,
  frequencylocked: sub.frequencyLocked,
  ...(sub.companyId ? { company: { id: sub.companyId, emporixReferenceType: 'COMPANY' } } : {}),
  ...(sub.customerId ? { customer: { id: sub.customerId, emporixReferenceType: 'CUSTOMER' } } : {}),
  enddate: sub.endDate ?? null,
  interval: sub.unit,
  frequency: sub.every,
  datecreated: sub.createdAt,
  lastorderdate: sub.lastOrderDate,
  nextorderdate: sub.nextOrderDate,
  notificationdate: sub.notificationDate,
  paymentmethod: sub.paymentMethod ?? 'INVOICE',
  shippingaddressid: sub.shippingAddressId ?? null,
});

const displayProductName = (product: EmporixProduct): string | undefined => {
  if (!product.name) return undefined;
  if (typeof product.name === 'string') return product.name;
  return product.name.en || Object.values(product.name).find((value) => value);
};

const displayProductImage = (product: EmporixProduct): string | undefined => product.media?.[0]?.url;

type NamedProduct = SubscriptionProductRef & { name?: string; imageUrl?: string };

const customerLabel = (row: { firstName?: string; lastName?: string }): string =>
  [row.firstName, row.lastName]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ');

const paymentMethodOf = (order: EmporixOrder): string => {
  const method = order.payments?.[0]?.method?.trim();
  if (!method || method.toUpperCase() === 'INVOICE') return 'INVOICE';
  return method;
};

const orderLines = (order: EmporixOrder): SubscriptionItem[] =>
  (order.entries ?? [])
    .filter((entry) => entry.product?.id)
    .map((entry) => ({
      productId: entry.product?.id as string,
      quantity: entry.amount > 0 ? entry.amount : 1,
    }));

@injectable('SubscriptionService', 'Singleton')
class EmporixSubscriptionService implements SubscriptionService {
  constructor(
    @inject('EmporixApiInvoker') private readonly api: EmporixApiInvoker,
    @inject('EmporixConfig') private readonly config: EmporixConfig,
    @inject('EmporixOrderApi') private readonly orderApi: EmporixOrderApi,
    @inject('EmporixProductApi') private readonly productApi: EmporixProductApi,
    @inject('CustomerService') private readonly customerService: CustomerService,
    @inject('SessionService') private readonly sessionService: SessionService,
    @inject('CompanyService') private readonly companyService: CompanyService,
    @inject('LoggerService') private readonly logger: LoggerService,
  ) {}

  async list(scope: 'mine' | 'company', requestedCompanyId?: string): Promise<Subscription[]> {
    const actor = await this.actor();
    if (scope === 'company') {
      const decision = companyListDecision(actor, requestedCompanyId);
      if (!decision.ok) throw new SubscriptionRequestError(decision.message, decision.status);
      const instances = await this.searchInstances(`mixins.configuration.company.id:${qValue(decision.companyId)}`);
      const rows = instances
        .map(toSubscription)
        .filter((subscription) => subscription.companyId === decision.companyId);
      return this.present(rows);
    }
    if (requestedCompanyId) {
      throw new SubscriptionRequestError('A customer cannot list every subscription of the company.', 403);
    }
    const instances = await this.searchInstances(`mixins.configuration.customer.id:${qValue(actor.customerId)}`);
    const rows = instances.map(toSubscription).filter((subscription) => subscription.customerId === actor.customerId);
    return this.present(rows);
  }

  async get(id: string): Promise<Subscription> {
    const loaded = await this.loadEditable(id);
    return this.withNames(loaded.subscription);
  }

  async pause(id: string): Promise<Subscription> {
    return this.edit(id, (current) => withStatus(current, 'PAUSED'));
  }

  async resume(id: string): Promise<Subscription> {
    return this.edit(id, (current) => withStatus(current, 'ACTIVE'));
  }

  async cancel(id: string): Promise<Subscription> {
    return this.edit(id, (current) => withStatus(current, 'CANCELLED'));
  }

  async setCadence(id: string, every: number, unit: SubscriptionInterval): Promise<Subscription> {
    const { subscription } = await this.loadEditable(id);
    const products = await this.loadProducts(subscription.items.map((item) => item.productId));
    return this.edit(id, (current) =>
      withCadence(
        { ...current, frequencyLocked: current.frequencyLocked || itemsLockCadence(current.items, products) },
        every,
        unit,
      ),
    );
  }

  async setItems(id: string, items: SubscriptionItem[]): Promise<Subscription> {
    const products = await this.loadProducts(items.map((item) => item.productId));
    return this.edit(id, (current) => withItems(current, items, products));
  }

  async plan(lines: SubscriptionItem[], chosen?: { every: number; unit: SubscriptionInterval }): Promise<RenewPlan> {
    await this.actor();
    const products = await this.loadProducts(lines.map((line) => line.productId));
    return planRenewal(lines, products, chosen);
  }

  async createForOrder(orderId: string, chosen: { every: number; unit: SubscriptionInterval }): Promise<Subscription> {
    const actor = await this.actor();
    const order = await this.readOrder(orderId);
    if (!order) throw new SubscriptionRequestError('Order not found.', 404);
    const orderCustomerId = order.customer?.id;
    if (!orderCustomerId || orderCustomerId !== actor.customerId) {
      throw new SubscriptionRequestError('This order cannot be renewed for the signed-in customer.', 403);
    }
    const companyId = (order as EmporixOrder & { legalEntityId?: string }).legalEntityId || actor.legalEntityId;
    if (!companyId) throw new SubscriptionRequestError('This order has no company.', 400);
    const lines = orderLines(order);
    if (lines.length !== (order.entries?.length ?? 0)) {
      throw new SubscriptionRequestError('This order has a line without a product.', 400);
    }
    const products = await this.loadProducts(lines.map((line) => line.productId));
    const renewal = planRenewal(lines, products, chosen);
    if (!renewal.ok) throw new SubscriptionPlanError(renewal.issue);

    const orderedAt = order.created ? new Date(order.created) : new Date();
    const schedule = scheduleFrom(orderedAt, renewal.every, renewal.unit, orderedAt);
    const created = orderedAt.toISOString();
    const company = await this.companyService.getCompany(companyId).catch(() => null);
    const draft: Subscription = {
      id: '',
      name: `${company?.name || 'Subscription'} · every ${renewal.every} ${renewal.unit}`,
      companyId,
      customerId: orderCustomerId,
      status: 'ACTIVE',
      active: true,
      every: renewal.every,
      unit: renewal.unit,
      frequencyLocked: renewal.locked,
      paymentMethod: paymentMethodOf(order),
      shippingAddressId: order.shippingAddress?.id,
      createdAt: created,
      lastOrderDate: created,
      nextOrderDate: schedule.nextOrderDate,
      notificationDate: schedule.notificationDate,
      items: renewal.items.map((item) => ({ ...item })),
      orders: [{ orderId, date: created }],
    };
    const urls = await this.mixinUrls();
    const response = await this.api.authenticatedFetch(
      `/schema/${this.config.tenant}/custom-entities/${ENTITY}/instances?validateReferences=false`,
      {
        method: 'POST',
        headers: this.writeHeaders('en'),
        body: JSON.stringify({
          name: { en: draft.name },
          mixins: {
            configuration: configurationOf(draft),
            subscriptionitems: {
              items: draft.items.map((item) => ({
                product: { id: item.productId, emporixReferenceType: 'PRODUCT' },
                quantity: item.quantity,
              })),
            },
            orders: {
              history: draft.orders.map((entry) => ({
                date: entry.date,
                order: { id: entry.orderId, emporixReferenceType: 'ORDER' },
              })),
            },
          },
          metadata: { mixins: urls },
        }),
      },
      'service',
      { scopes: WRITE_SCOPES },
    );
    if (!response.ok) {
      const body = await response.text();
      this.logger.error({ status: response.status, orderId }, 'Failed to create subscription');
      throw new SubscriptionRequestError(`Failed to create subscription: ${response.status} ${body}`, response.status);
    }
    const createdBody = (await response.json()) as { id?: string };
    return { ...draft, id: createdBody.id ?? draft.id };
  }

  async orderLinks(orderIds: string[]): Promise<Record<string, string>> {
    const actor = await this.actor();
    const wanted = new Set(
      orderIds
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 100),
    );
    if (wanted.size === 0) return {};
    const mine = await this.list('mine');
    const company = actor.companyAdmin && actor.legalEntityId ? await this.list('company', actor.legalEntityId) : [];
    const links: Record<string, string> = {};
    for (const subscription of [...mine, ...company]) {
      for (const order of subscription.orders) {
        if (wanted.has(order.orderId) && !links[order.orderId]) links[order.orderId] = subscription.id;
      }
    }
    return links;
  }

  private async edit(id: string, change: (current: Subscription) => Subscription): Promise<Subscription> {
    const { instance, subscription } = await this.loadEditable(id);
    if (subscription.status === 'CANCELLED') {
      throw new SubscriptionRequestError('A cancelled subscription cannot be changed.', 409);
    }
    let next: Subscription;
    try {
      next = change(subscription);
    } catch (error) {
      if (error instanceof SubscriptionPlanError || error instanceof SubscriptionRequestError) throw error;
      const message = error instanceof Error ? error.message : 'The subscription could not be changed.';
      throw new SubscriptionRequestError(message, 400);
    }
    await this.save(instance, next);
    return this.withNames(next);
  }

  private async loadEditable(id: string): Promise<{ instance: RawInstance; subscription: Subscription }> {
    const actor = await this.actor();
    const instance = await this.readInstance(id);
    if (!instance) throw new SubscriptionRequestError('Subscription not found.', 404);
    const subscription = toSubscription(instance);
    if (!canReadSubscription(subscription, actor)) {
      throw new SubscriptionRequestError('Subscription not found.', 404);
    }
    return { instance, subscription };
  }

  private async actor(): Promise<SubscriptionActor> {
    const customer = await this.customerService.getCustomer();
    if (!customer) throw new SubscriptionRequestError('Sign in to manage subscriptions.', 401);
    const session = await this.sessionService.getCurrent();
    return {
      customerId: customer.id,
      legalEntityId: resolveLegalEntityIdFromSessionAndCustomer(session, customer),
      companyAdmin: customer.roles?.includes(CustomerRole.B2B_ADMIN) === true,
    };
  }

  private async searchInstances(q: string): Promise<RawInstance[]> {
    const collected: RawInstance[] = [];
    for (let page = 1; page <= 10; page += 1) {
      const response = await this.api.authenticatedFetch(
        `/schema/${this.config.tenant}/custom-entities/${ENTITY}/instances/search?pageSize=200&pageNumber=${page}`,
        {
          method: 'POST',
          headers: {
            ...this.readHeaders(),
            'Content-Type': 'application/json',
            'X-Total-Count': 'true',
          },
          body: JSON.stringify({ q }),
        },
        'service',
        { scopes: READ_SCOPES },
      );
      if (!response.ok) {
        const body = await response.text();
        throw new SubscriptionRequestError(`Failed to list subscriptions: ${response.status} ${body}`, response.status);
      }
      const items = extractItemsFromPaginatedJsonBody<RawInstance>(await response.json());
      collected.push(...items);
      if (items.length < 200) break;
    }
    return collected;
  }

  private async readInstance(id: string): Promise<RawInstance | null> {
    const response = await this.api.authenticatedFetch(
      `/schema/${this.config.tenant}/custom-entities/${ENTITY}/instances/${encodeURIComponent(id)}`,
      { method: 'GET', headers: this.readHeaders() },
      'service',
      { scopes: READ_SCOPES },
    );
    if (response.status === 404) return null;
    if (!response.ok) {
      const body = await response.text();
      throw new SubscriptionRequestError(`Failed to read subscription: ${response.status} ${body}`, response.status);
    }
    return (await response.json()) as RawInstance;
  }

  private async save(instance: RawInstance, sub: Subscription): Promise<void> {
    const urls = await this.mixinUrls();
    const response = await this.api.authenticatedFetch(
      `/schema/${this.config.tenant}/custom-entities/${ENTITY}/instances/${encodeURIComponent(instance.id)}?validateReferences=false`,
      {
        method: 'PUT',
        headers: this.writeHeaders('*'),
        body: JSON.stringify({
          ...instance,
          name: typeof instance.name === 'string' ? { en: instance.name } : { en: sub.name, ...(instance.name ?? {}) },
          mixins: {
            ...(instance.mixins ?? {}),
            configuration: configurationOf(sub),
            subscriptionitems: {
              items: sub.items.map((item) => ({
                product: { id: item.productId, emporixReferenceType: 'PRODUCT' },
                quantity: item.quantity,
              })),
            },
            orders: {
              history: sub.orders.map((order) => ({
                date: order.date,
                order: { id: order.orderId, emporixReferenceType: 'ORDER' },
              })),
            },
          },
          metadata: {
            ...(instance.metadata ?? {}),
            mixins: { ...(instance.metadata?.mixins ?? {}), ...urls },
          },
        }),
      },
      'service',
      { scopes: WRITE_SCOPES },
    );
    if (!response.ok) {
      const body = await response.text();
      throw new SubscriptionRequestError(`Failed to update subscription: ${response.status} ${body}`, response.status);
    }
  }

  private async mixinUrls(): Promise<Record<string, string>> {
    const pairs = await Promise.all(
      MIXIN_IDS.map(async (id) => {
        const response = await this.api.authenticatedFetch(
          `/schema/${this.config.tenant}/schemas/${id}`,
          { method: 'GET', headers: this.readHeaders() },
          'service',
        );
        if (!response.ok) {
          const body = await response.text();
          throw new SubscriptionRequestError(
            `Subscription schema ${id} could not be read: ${response.status} ${body}`,
            response.status,
          );
        }
        const schema = (await response.json()) as { metadata?: { url?: string } };
        const url = schema.metadata?.url;
        if (!url) throw new SubscriptionRequestError(`Subscription schema ${id} has no published url.`, 502);
        return [id, url] as const;
      }),
    );
    return Object.fromEntries(pairs);
  }

  private async loadProducts(ids: string[]): Promise<NamedProduct[]> {
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    const products = await Promise.all(unique.map((id) => this.readProduct(id)));
    return products.filter((product): product is NamedProduct => product != null);
  }

  private rememberCustomer(
    names: Map<string, string>,
    row: { id?: string; customerNumber?: string; firstName?: string; lastName?: string },
    requestedId?: string,
  ) {
    const label = customerLabel(row);
    if (!label) return;
    if (requestedId) names.set(requestedId, label);
    if (row.id) names.set(row.id, label);
    if (row.customerNumber) names.set(row.customerNumber, label);
  }

  private async searchCustomers(
    query: string,
    pageSize: number,
  ): Promise<{ id?: string; customerNumber?: string; firstName?: string; lastName?: string }[]> {
    const response = await this.api.authenticatedFetch(
      `/customer/${this.config.tenant}/customers?pageNumber=1&pageSize=${pageSize}&q=${encodeURIComponent(query)}`,
      { method: 'GET', headers: { Accept: 'application/json' } },
      'service',
    );
    if (!response.ok) {
      this.logger.warn({ status: response.status }, 'Subscription owner lookup failed');
      return [];
    }
    return extractItemsFromPaginatedJsonBody(await response.json());
  }

  private async loadCustomerNames(ids: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    for (let offset = 0; offset < unique.length; offset += 40) {
      const chunk = unique.slice(offset, offset + 40);
      try {
        const byId = await this.searchCustomers(`id:(${chunk.join(',')})`, Math.max(chunk.length, 1));
        for (const row of byId) this.rememberCustomer(names, row);
        const missingNumber = chunk.filter((id) => !names.has(id));
        if (missingNumber.length > 0) {
          const byNumber = await this.searchCustomers(
            `customerNumber:(${missingNumber.join(',')})`,
            Math.max(missingNumber.length, 1),
          );
          for (const row of byNumber) this.rememberCustomer(names, row);
        }
        await Promise.all(
          chunk
            .filter((id) => !names.has(id))
            .map(async (id) => {
              const response = await this.api.authenticatedFetch(
                `/customer/${this.config.tenant}/customers/${encodeURIComponent(id)}`,
                { method: 'GET', headers: { Accept: 'application/json' } },
                'service',
              );
              if (!response.ok) return;
              this.rememberCustomer(names, await response.json(), id);
            }),
        );
      } catch (error) {
        this.logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          'Subscription owner names could not be loaded',
        );
      }
    }
    return names;
  }

  private async present(subscriptions: Subscription[]): Promise<Subscription[]> {
    if (subscriptions.length === 0) return subscriptions;
    const [products, customers] = await Promise.all([
      this.loadProducts(subscriptions.flatMap((subscription) => subscription.items.map((item) => item.productId))),
      this.loadCustomerNames(subscriptions.map((subscription) => subscription.customerId || '').filter(Boolean)),
    ]);
    const byProduct = new Map(products.map((product) => [product.id, product]));
    return subscriptions.map((subscription) => this.applyNames(subscription, byProduct, customers));
  }

  private applyNames(
    subscription: Subscription,
    products: Map<string, NamedProduct>,
    customers: Map<string, string>,
  ): Subscription {
    return {
      ...subscription,
      frequencyLocked: subscription.frequencyLocked || itemsLockCadence(subscription.items, [...products.values()]),
      customerName: subscription.customerId ? customers.get(subscription.customerId) : undefined,
      items: subscription.items.map((item) => {
        const product = products.get(item.productId);
        return product ? { ...item, name: product.name, imageUrl: product.imageUrl } : item;
      }),
    };
  }

  private async withNames(subscription: Subscription): Promise<Subscription> {
    const [products, customers] = await Promise.all([
      this.loadProducts(subscription.items.map((item) => item.productId)),
      this.loadCustomerNames(subscription.customerId ? [subscription.customerId] : []),
    ]);
    return this.applyNames(subscription, new Map(products.map((product) => [product.id, product])), customers);
  }

  private async readProduct(id: string): Promise<NamedProduct | undefined> {
    try {
      const response = await this.api.authenticatedFetch(
        `/product/${this.config.tenant}/products/${encodeURIComponent(id)}`,
        { method: 'GET', headers: this.readHeaders() },
        'service',
      );
      if (response.ok) {
        const product = (await response.json()) as EmporixProduct;
        if (product.id) {
          return {
            id: product.id,
            name: displayProductName(product),
            imageUrl: displayProductImage(product),
            mixins: product.mixins as SubscriptionProductRef['mixins'],
          };
        }
      }
    } catch (error) {
      this.logger.warn(
        { productId: id, error: error instanceof Error ? error.message : String(error) },
        'Service product read failed',
      );
    }
    const fallback = (await this.productApi.getProduct(id)) as EmporixProduct | undefined;
    if (!fallback?.id) return undefined;
    return {
      id: fallback.id,
      name: displayProductName(fallback),
      imageUrl: displayProductImage(fallback),
      mixins: fallback.mixins as SubscriptionProductRef['mixins'],
    };
  }

  private async readOrder(orderId: string): Promise<EmporixOrder | null> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const order = await this.orderApi.getOrder(orderId);
      if (order) return order;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
    return null;
  }

  private readHeaders(): Record<string, string> {
    return {
      Accept: 'application/json',
      'Accept-Language': '*',
      'Content-Language': '*',
      'emporix-tenant': this.config.tenant,
    };
  }

  private writeHeaders(language: string): Record<string, string> {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Content-Language': language,
      'emporix-tenant': this.config.tenant,
    };
  }
}

export default EmporixSubscriptionService;
