/**
 * Subscription schedule rules. These match the sales cockpit
 * (`packages/core/src/subscriptions.ts`): one order is one SUBSCRIPTIONS
 * instance, and product cadence names are swapped versus the subscription.
 *
 * Product mixin (schema 69447b6196883064119611f6): frequency is the unit,
 * interval is the count. Subscription mixin: frequency is the count, interval
 * is the unit.
 */

export const PRODUCT_SUBSCRIPTION_SCHEMA_ID = '69447b6196883064119611f6';

export const SUBSCRIPTION_INTERVALS = ['days', 'weeks', 'months', 'years'] as const;
export type SubscriptionInterval = (typeof SUBSCRIPTION_INTERVALS)[number];
export type SubscriptionFulfillment = 'DIGITAL' | 'SERVICE' | 'PHYSICAL';
export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED';

export type ProductSubscription = {
  subscribable: boolean;
  fulfillment?: SubscriptionFulfillment;
  /** How many units between renewals (product mixin `interval`). */
  every?: number;
  /** Unit (product mixin `frequency`). */
  unit?: SubscriptionInterval;
};

export type SubscriptionItem = { productId: string; quantity: number; name?: string; imageUrl?: string };
export type SubscriptionOrderRef = { orderId: string; date: string };

export type SubscriptionProductRef = {
  id: string;
  mixins?: Record<string, unknown>;
};

export type Subscription = {
  id: string;
  name: string;
  companyId?: string;
  customerId?: string;
  customerName?: string;
  status: SubscriptionStatus;
  active: boolean;
  every: number;
  unit: SubscriptionInterval;
  /** True when a digital or service product on the subscription owns the cadence. */
  frequencyLocked: boolean;
  paymentMethod?: string;
  shippingAddressId?: string;
  createdAt?: string;
  lastOrderDate?: string;
  nextOrderDate?: string;
  notificationDate?: string;
  endDate?: string;
  items: SubscriptionItem[];
  orders: SubscriptionOrderRef[];
};

export type RenewIssue = 'empty' | 'missing-cadence' | 'conflicting-cadence' | 'invalid-every' | 'cancelled';

export type RenewPlan =
  | { ok: true; every: number; unit: SubscriptionInterval; locked: boolean; items: SubscriptionItem[] }
  | { ok: false; issue: RenewIssue };

export class SubscriptionPlanError extends Error {
  readonly issue: RenewIssue;

  constructor(issue: RenewIssue) {
    super(issue);
    this.name = 'SubscriptionPlanError';
    this.issue = issue;
  }
}

const NOTIFY_DAYS_BEFORE = 2;

export const isSubscriptionInterval = (value: unknown): value is SubscriptionInterval =>
  value === 'days' || value === 'weeks' || value === 'months' || value === 'years';

const isFulfillment = (value: unknown): value is SubscriptionFulfillment =>
  value === 'DIGITAL' || value === 'SERVICE' || value === 'PHYSICAL';

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;

/** Read the product subscription mixin. Does not mutate the product. */
export const productSubscription = (product: SubscriptionProductRef): ProductSubscription => {
  const raw = asRecord(product.mixins?.[PRODUCT_SUBSCRIPTION_SCHEMA_ID]);
  if (!raw) return { subscribable: false };
  const every = typeof raw.interval === 'number' && Number.isFinite(raw.interval) ? raw.interval : undefined;
  const unit = isSubscriptionInterval(raw.frequency) ? raw.frequency : undefined;
  return {
    subscribable: raw.subscription === true,
    fulfillment: isFulfillment(raw.fulfillment) ? raw.fulfillment : undefined,
    every,
    unit,
  };
};

/**
 * Digital and service products fix the cadence. A product saved before the
 * fulfillment field existed, with a cadence already stored, is treated the
 * same way. Physical products are never locked.
 */
export const cadenceIsLocked = (config: ProductSubscription): boolean => {
  if (!config.subscribable) return false;
  if (config.fulfillment === 'PHYSICAL') return false;
  if (config.fulfillment === 'DIGITAL' || config.fulfillment === 'SERVICE') return true;
  return config.every != null && config.every >= 1 && config.unit != null;
};

/** True when any product on the subscription is digital or a service. */
export const itemsLockCadence = (items: SubscriptionItem[], products: SubscriptionProductRef[]): boolean => {
  const byId = new Map(products.map((product) => [product.id, product]));
  return items.some((item) => {
    const product = byId.get(item.productId);
    return product ? cadenceIsLocked(productSubscription(product)) : false;
  });
};

export const addInterval = (from: Date, every: number, unit: SubscriptionInterval): Date => {
  const next = new Date(from.getTime());
  if (unit === 'days') next.setUTCDate(next.getUTCDate() + every);
  else if (unit === 'weeks') next.setUTCDate(next.getUTCDate() + every * 7);
  else if (unit === 'months') next.setUTCMonth(next.getUTCMonth() + every);
  else next.setUTCFullYear(next.getUTCFullYear() + every);
  return next;
};

/** Two days before the next order. */
export const notificationDate = (nextOrder: Date): Date => {
  const date = new Date(nextOrder.getTime());
  date.setUTCDate(date.getUTCDate() - NOTIFY_DAYS_BEFORE);
  return date;
};

/** Move a due date forward by whole intervals until it is after now. */
export const rollForward = (next: Date, every: number, unit: SubscriptionInterval, now = new Date()): Date => {
  let cursor = new Date(next.getTime());
  let steps = 0;
  while (cursor.getTime() <= now.getTime() && steps < 500) {
    cursor = addInterval(cursor, every, unit);
    steps += 1;
  }
  return cursor;
};

const validEvery = (every: number): boolean => Number.isInteger(every) && every >= 1;

export const scheduleFrom = (lastOrder: Date, every: number, unit: SubscriptionInterval, now = new Date()) => {
  const next = rollForward(addInterval(lastOrder, every, unit), every, unit, now);
  return { nextOrderDate: next.toISOString(), notificationDate: notificationDate(next).toISOString() };
};

/**
 * One subscription for the whole order. Digital and service lines lock the
 * cadence and must agree. Otherwise the shopper's choice is used. Every line
 * is included.
 */
export const planRenewal = (
  lines: SubscriptionItem[],
  products: SubscriptionProductRef[],
  chosen?: { every: number; unit: SubscriptionInterval },
): RenewPlan => {
  if (lines.length === 0) return { ok: false, issue: 'empty' };
  const byId = new Map(products.map((product) => [product.id, product]));
  const locked = lines
    .map((line) => productSubscription(byId.get(line.productId) ?? { id: line.productId, mixins: {} }))
    .filter(cadenceIsLocked);
  const items = lines.map((line) => ({ productId: line.productId, quantity: line.quantity }));
  if (locked.length > 0) {
    if (locked.some((config) => !validEvery(config.every ?? 0) || !config.unit)) {
      return { ok: false, issue: 'missing-cadence' };
    }
    const first = locked[0];
    const conflict = locked.some((config) => config.every !== first.every || config.unit !== first.unit);
    if (conflict) return { ok: false, issue: 'conflicting-cadence' };
    return { ok: true, every: first.every as number, unit: first.unit as SubscriptionInterval, locked: true, items };
  }
  if (!chosen || !validEvery(chosen.every) || !isSubscriptionInterval(chosen.unit)) {
    return { ok: false, issue: 'invalid-every' };
  }
  return { ok: true, every: chosen.every, unit: chosen.unit, locked: false, items };
};

const clone = (sub: Subscription): Subscription => ({
  ...sub,
  items: sub.items.map((item) => ({ ...item })),
  orders: sub.orders.map((order) => ({ ...order })),
});

export const withStatus = (sub: Subscription, status: SubscriptionStatus, now = new Date()): Subscription => {
  const next = clone(sub);
  if (sub.status === 'CANCELLED' || status === sub.status) return next;
  if (status === 'CANCELLED') {
    next.status = 'CANCELLED';
    next.active = false;
    next.endDate = now.toISOString().slice(0, 10);
    return next;
  }
  if (status === 'PAUSED') {
    next.status = 'PAUSED';
    next.active = false;
    return next;
  }
  const last = sub.lastOrderDate ? new Date(sub.lastOrderDate) : now;
  const schedule = scheduleFrom(last, sub.every, sub.unit, now);
  next.status = 'ACTIVE';
  next.active = true;
  next.endDate = undefined;
  next.nextOrderDate = schedule.nextOrderDate;
  next.notificationDate = schedule.notificationDate;
  return next;
};

export const withCadence = (
  sub: Subscription,
  every: number,
  unit: SubscriptionInterval,
  now = new Date(),
): Subscription => {
  if (sub.frequencyLocked) {
    throw new Error('The renewal schedule is set by a digital or service product and cannot be changed.');
  }
  if (sub.status === 'CANCELLED') throw new Error('A cancelled subscription cannot be changed.');
  if (!validEvery(every)) throw new Error('Renewal interval must be a whole number of 1 or more.');
  const next = clone(sub);
  const last = sub.lastOrderDate ? new Date(sub.lastOrderDate) : now;
  const schedule = scheduleFrom(last, every, unit, now);
  next.every = every;
  next.unit = unit;
  next.nextOrderDate = schedule.nextOrderDate;
  next.notificationDate = schedule.notificationDate;
  return next;
};

/** Replace the products. A digital or service product locks (and may replace) the cadence. */
export const withItems = (
  sub: Subscription,
  items: SubscriptionItem[],
  products: SubscriptionProductRef[],
  now = new Date(),
): Subscription => {
  if (sub.status === 'CANCELLED') throw new Error('A cancelled subscription cannot be changed.');
  const plan = planRenewal(items, products, { every: sub.every, unit: sub.unit });
  if (!plan.ok) {
    throw new SubscriptionPlanError(plan.issue);
  }
  const next = clone(sub);
  next.items = plan.items;
  next.frequencyLocked = plan.locked;
  if (plan.locked && (plan.every !== sub.every || plan.unit !== sub.unit)) {
    const last = sub.lastOrderDate ? new Date(sub.lastOrderDate) : now;
    const schedule = scheduleFrom(last, plan.every, plan.unit, now);
    next.every = plan.every;
    next.unit = plan.unit;
    next.nextOrderDate = schedule.nextOrderDate;
    next.notificationDate = schedule.notificationDate;
  }
  return next;
};
