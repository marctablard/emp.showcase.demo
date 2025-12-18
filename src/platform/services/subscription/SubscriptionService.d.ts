import type { Paginated } from '@/platform/services/model/common';

export type SubscriptionInterval = 'days' | 'weeks' | 'months' | 'years';

export interface SubscriptionItem {
  productId: string;
  quantity: number;
}

export interface SubscriptionOrderHistoryEntry {
  date: string;
  orderId: string;
}

export interface SubscriptionConfiguration {
  active: boolean;
  companyId: string;
  customerId: string;
  dateCreated?: string;
  endDate?: string | null;
  frequency: number;
  interval: SubscriptionInterval;
  lastOrderDate?: string | null;
  nextOrderDate?: string | null;
  notificationDate?: string | null;
  paymentMethod: 'INVOICE';
  shippingAddressId?: string;
}

export interface Subscription {
  id: string;
  name?: string;
  items: SubscriptionItem[];
  configuration: SubscriptionConfiguration;
  orders: SubscriptionOrderHistoryEntry[];
}

export interface SubscriptionUpsertRequest {
  id?: string;
  name?: string;
  items: SubscriptionItem[];
  configuration: Omit<SubscriptionConfiguration, 'dateCreated' | 'notificationDate'> & {
    dateCreated?: string;
    notificationDate?: string | null;
  };
}

export interface SubscriptionQuery {
  page?: number;
  size?: number;
}

export interface SubscriptionService {
  getSubscriptionsForCurrentCustomer(query: SubscriptionQuery): Promise<Paginated<Subscription>>;
  getSubscription(id: string): Promise<Subscription | null>;
  upsertSubscription(request: SubscriptionUpsertRequest): Promise<Subscription>;
  pauseSubscription(id: string): Promise<void>;
  resumeSubscription(id: string): Promise<void>;
  cancelSubscription(id: string): Promise<void>;
}
