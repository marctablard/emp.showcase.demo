import { WIDGET_TYPES } from '@/lib/common/ai-stream-preview';
import type { AIChatSubscriptions } from '@/platform/integrations/ai/model';
import type { Subscription } from '@/platform/services/subscription/subscription-rules';

const SUBSCRIPTION_TOPIC = /subscri|abonnement|\babos?\b|recurring|renew|re-?order|wiederkehr|nachbestell|erneuer/i;

export const SUBSCRIPTION_WIDGET_TYPE = 'subscription_list';

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
    every: subscription.every,
    unit: subscription.unit,
    scheduleLocked: subscription.frequencyLocked,
    nextOrderDate: subscription.status === 'CANCELLED' ? undefined : subscription.nextOrderDate,
    lastOrderDate: subscription.lastOrderDate,
    endDate: subscription.endDate,
    products: subscription.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      imageUrl: item.imageUrl,
      quantity: item.quantity,
    })),
    orderIds: subscription.orders.map((order) => order.orderId),
    link: `/account/subscriptions/${subscription.id}`,
  })),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

/** The agent reply as `{ type, message }`, unwrapping one nested agent envelope. */
const readAgentReply = (raw: string): { type: string; message: string } => {
  let parsed = parseJson(raw);
  if (isRecord(parsed) && typeof parsed.message === 'string' && parsed.message.trim().startsWith('{')) {
    const nested = parseJson(parsed.message);
    if (isRecord(nested)) parsed = nested;
  }
  if (!isRecord(parsed)) return { type: 'text', message: raw };
  return {
    type: typeof parsed.type === 'string' ? parsed.type : 'text',
    message: typeof parsed.message === 'string' ? parsed.message : '',
  };
};

/**
 * The storefront renders subscriptions itself: the agent's sentence stays as the caption and the
 * list comes from the data the storefront loaded. A widget the agent did return is kept.
 */
export const withSubscriptionWidget = (rawMessage: string, subscriptions: AIChatSubscriptions): string => {
  const reply = readAgentReply(rawMessage);
  if (WIDGET_TYPES.has(reply.type) && reply.type !== SUBSCRIPTION_WIDGET_TYPE) return rawMessage;
  return JSON.stringify({
    type: SUBSCRIPTION_WIDGET_TYPE,
    message: reply.message,
    data: { scope: subscriptions.scope, subscriptions: subscriptions.items },
  });
};
