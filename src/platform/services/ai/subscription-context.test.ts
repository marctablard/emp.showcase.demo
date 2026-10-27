import type { Subscription } from '@/platform/services/subscription/subscription-rules';
import { mentionsSubscriptions, toAgentSubscriptions, withSubscriptionWidget } from './subscription-context';

const context = toAgentSubscriptions('mine', []);

describe('subscription context for the AI agent', () => {
  it('recognises subscription questions in English and German', () => {
    expect(mentionsSubscriptions('show me my subscriptions')).toBe(true);
    expect(mentionsSubscriptions('show me my most recently reorder subscriptions')).toBe(true);
    expect(mentionsSubscriptions('Zeig mir meine Abonnements')).toBe(true);
    expect(mentionsSubscriptions('Welche Abos habe ich?')).toBe(true);
    expect(mentionsSubscriptions('show my open quotes')).toBe(false);
  });

  it('turns a text reply into a subscription list that keeps the agent sentence', () => {
    const raw = JSON.stringify({
      agentId: 'frontendAgent',
      message: JSON.stringify({ type: 'text', message: 'Here are your subscriptions.' }),
    });
    expect(JSON.parse(withSubscriptionWidget(raw, context))).toEqual({
      type: 'subscription_list',
      message: 'Here are your subscriptions.',
      data: { scope: 'mine', subscriptions: [] },
    });
    expect(JSON.parse(withSubscriptionWidget('Plain text answer', context)).message).toBe('Plain text answer');
  });

  it('keeps a widget the agent returned itself', () => {
    const raw = JSON.stringify({ type: 'order_list', message: 'Orders', data: { orders: [] } });
    expect(withSubscriptionWidget(raw, context)).toBe(raw);
  });

  it('summarises each subscription with a link and hides the next order of a cancelled one', () => {
    const subscription: Subscription = {
      id: 'sub-1',
      name: 'Acme',
      companyId: 'co',
      customerId: 'cu',
      customerName: 'Jane Doe',
      status: 'CANCELLED',
      active: false,
      every: 2,
      unit: 'weeks',
      frequencyLocked: true,
      items: [{ productId: 'p1', quantity: 3, name: 'Gloves' }],
      orders: [{ orderId: 'EON1', date: '2026-01-01' }],
      nextOrderDate: '2026-02-01',
      endDate: '2026-01-20',
    };

    const context = toAgentSubscriptions('company', [subscription]);

    expect(context.scope).toBe('company');
    expect(context.items[0]).toMatchObject({
      id: 'sub-1',
      owner: 'Jane Doe',
      renewEvery: '2 weeks',
      scheduleLocked: true,
      nextOrderDate: undefined,
      products: [{ productId: 'p1', name: 'Gloves', quantity: 3 }],
      orderIds: ['EON1'],
      link: '/account/subscriptions/sub-1',
    });
  });
});
