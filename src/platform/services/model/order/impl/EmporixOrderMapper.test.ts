import type { EmporixOrder } from '@/platform/integrations/emporix/model/order';
import EmporixOrderMapper from './EmporixOrderMapper';

describe('EmporixOrderMapper', () => {
  const mapper = new EmporixOrderMapper({} as never);

  const buildOrder = (overrides: Partial<EmporixOrder> = {}): EmporixOrder => ({
    id: 'order-1',
    quoteId: undefined,
    status: 'CREATED',
    entries: [],
    customer: {
      id: 'customer-1',
      email: 'customer@example.com',
    },
    ...overrides,
  });

  it('maps quoteId when the upstream order is linked to a quote', () => {
    const result = mapper.mapToService(
      buildOrder({
        quoteId: 'quote-123',
      }),
    );

    expect(result.quoteId).toBe('quote-123');
  });

  it('leaves quoteId undefined when the upstream order is not linked', () => {
    const result = mapper.mapToService(buildOrder());

    expect(result.quoteId).toBeUndefined();
  });
});
