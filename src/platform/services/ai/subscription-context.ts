import type { AIChatSubscriptions } from '@/platform/integrations/ai/model';
import type { Subscription } from '@/platform/services/subscription/subscription-rules';

const SUBSCRIPTION_TOPIC = /subscri|abonnement|\babos?\b|recurring|renew|re-?order|wiederkehr|nachbestell|erneuer/i;

/** The agent has no subscription tool, so subscription questions get the data in the context. */
export const mentionsSubscriptions = (message: string): boolean => SUBSCRIPTION_TOPIC.test(message);

export const toAgentSubscriptions = (
  scope: 'mine' | 'company',
  subscriptions: Subscription[],
): AIChatSubscriptions => ({
  scope,
  note:
    scope === 'company'
      ? 'All subscriptions of the signed-in company admin’s company. Read-only: changes are made on the subscription page (link).'
      : 'Subscriptions of the signed-in customer. Read-only: changes are made on the subscription page (link).',
  items: subscriptions.map((subscription) => ({
    id: subscription.id,
    status: subscription.status,
    owner: subscription.customerName || subscription.customerId,
    renewEvery: `${subscription.every} ${subscription.unit}`,
    scheduleLocked: subscription.frequencyLocked,
    nextOrderDate: subscription.status === 'CANCELLED' ? undefined : subscription.nextOrderDate,
    lastOrderDate: subscription.lastOrderDate,
    endDate: subscription.endDate,
    products: subscription.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
    })),
    orderIds: subscription.orders.map((order) => order.orderId),
    link: `/account/subscriptions/${subscription.id}`,
  })),
});
