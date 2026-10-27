import type { Subscription } from '@/platform/services/subscription/subscription-rules';
import { mentionsSubscriptions, toAgentSubscriptions } from './subscription-context';

describe('subscription context for the AI agent', () => {
  it('recognises subscription questions in English and German', () => {
    expect(mentionsSubscriptions('show me my subscriptions')).toBe(true);
    expect(mentionsSubscriptions('show me my most recently reorder subscriptions')).toBe(true);
    expect(mentionsSubscriptions('Zeig mir meine Abonnements')).toBe(true);
    expect(mentionsSubscriptions('Welche Abos habe ich?')).toBe(true);
    expect(mentionsSubscriptions('show my open quotes')).toBe(false);
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
