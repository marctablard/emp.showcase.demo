import type {
  Subscription,
  SubscriptionInterval,
  SubscriptionItem,
} from '@/platform/services/subscription/subscription-rules';

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string; issue?: string };
  return body.issue || body.error || 'Failed to update subscription';
}

export async function fetchSubscriptions(scope: 'mine' | 'company'): Promise<Subscription[]> {
  const response = await fetch(`/api/subscriptions?scope=${scope}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function fetchSubscription(id: string): Promise<Subscription> {
  const response = await fetch(`/api/subscriptions/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function patchSubscription(id: string, body: unknown): Promise<Subscription> {
  const response = await fetch(`/api/subscriptions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function pauseSubscription(id: string): Promise<Subscription> {
  return patchSubscription(id, { action: 'pause' });
}

export async function resumeSubscription(id: string): Promise<Subscription> {
  return patchSubscription(id, { action: 'resume' });
}

export async function cancelSubscription(id: string): Promise<Subscription> {
  return patchSubscription(id, { action: 'cancel' });
}

export async function setSubscriptionCadence(
  id: string,
  every: number,
  unit: SubscriptionInterval,
): Promise<Subscription> {
  return patchSubscription(id, { action: 'cadence', every, unit });
}

export async function setSubscriptionItems(id: string, items: SubscriptionItem[]): Promise<Subscription> {
  return patchSubscription(id, {
    action: 'items',
    items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
  });
}

export async function fetchOrderSubscriptionLinks(orderIds: string[]): Promise<Record<string, string>> {
  if (orderIds.length === 0) return {};
  const response = await fetch('/api/subscriptions/order-links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderIds }),
  });
  if (!response.ok) return {};
  const body = (await response.json()) as { links?: Record<string, string> };
  return body.links ?? {};
}
