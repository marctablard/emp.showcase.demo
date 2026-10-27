import type { RenewIssue, RenewPlan, Subscription, SubscriptionInterval, SubscriptionItem } from './subscription-rules';

export interface SubscriptionService {
  list(scope: 'mine' | 'company', requestedCompanyId?: string): Promise<Subscription[]>;
  get(id: string): Promise<Subscription>;
  pause(id: string): Promise<Subscription>;
  resume(id: string): Promise<Subscription>;
  cancel(id: string): Promise<Subscription>;
  setCadence(id: string, every: number, unit: SubscriptionInterval): Promise<Subscription>;
  setItems(id: string, items: SubscriptionItem[]): Promise<Subscription>;
  plan(lines: SubscriptionItem[], chosen?: { every: number; unit: SubscriptionInterval }): Promise<RenewPlan>;
  createForOrder(orderId: string, chosen: { every: number; unit: SubscriptionInterval }): Promise<Subscription>;
  orderLinks(orderIds: string[]): Promise<Record<string, string>>;
}

export type { RenewIssue, Subscription, SubscriptionInterval, SubscriptionItem };
