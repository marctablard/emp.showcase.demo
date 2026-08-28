import type { Approval } from '@/platform/services/model/approval';
import type { Quote } from '@/platform/services/model/quote';
import { applyQuoteSnapshotToApproval } from './apply-quote-snapshot';

const baseApproval: Approval = {
  id: 'approval-1',
  status: 'PENDING',
  resourceType: 'QUOTE',
  action: 'CHECKOUT',
  resource: { id: 'Q1000510' },
  requestor: { userId: 'r1', firstName: 'A', lastName: 'B', email: 'a@example.com' },
  approver: { userId: 'a1', firstName: 'C', lastName: 'D' },
  createdAt: '2026-08-01T00:00:00.000Z',
};

const baseQuote: Quote = {
  id: 'Q1000510',
  status: 'OPEN',
  submittedDate: '2026-08-01T00:00:00.000Z',
  customerId: 'c1',
  currency: 'EUR',
  totalGross: 8517.74,
  totalNet: 7942,
  totalVat: 575.74,
  items: [],
  shippingAddress: {
    type: 'SHIPPING',
    contactName: 'Ada',
    street: 'Main 1',
    zipCode: '10115',
    city: 'Berlin',
    country: 'DE',
  },
  shippingCost: 20,
  shippingGross: 21.4,
  shippingMethod: 'DHL',
  taxAggregate: {
    lines: [
      { name: 'STANDARD', amount: 31.35, rate: 19, taxable: 196.35 },
      { name: 'REDUCED', amount: 545.79, rate: 7, taxable: 8342.79 },
    ],
  },
};

describe('applyQuoteSnapshotToApproval', () => {
  it('fills shipping and taxAggregate when the approval snapshot omitted details', () => {
    const enriched = applyQuoteSnapshotToApproval(baseApproval, baseQuote);

    expect(enriched.details?.shipping?.amount).toBe(20);
    expect(enriched.details?.shipping?.methodName).toBe('DHL');
    expect(enriched.details?.shipping?.grossAmount).toBe(21.4);
    expect(enriched.details?.currency).toBe('EUR');
    expect(enriched.resource.taxAggregate?.lines).toHaveLength(2);
    expect(enriched.details?.addresses?.[0]?.city).toBe('Berlin');
  });

  it('keeps a non-zero approval shipping amount', () => {
    const enriched = applyQuoteSnapshotToApproval(
      {
        ...baseApproval,
        details: {
          currency: 'EUR',
          shipping: { methodId: 'x', methodName: 'Cart ship', amount: 11, zoneId: 'de' },
        },
      },
      baseQuote,
    );

    expect(enriched.details?.shipping?.amount).toBe(11);
    expect(enriched.details?.shipping?.methodName).toBe('Cart ship');
    expect(enriched.details?.shipping?.grossAmount).toBe(21.4);
  });
});
