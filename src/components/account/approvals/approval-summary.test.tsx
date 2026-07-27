/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { Approval } from '@/platform/services/model/approval';
import { ApprovalSummary } from './approval-summary';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const baseApproval: Approval = {
  id: 'approval-1',
  status: 'PENDING',
  action: 'CHECKOUT',
  resourceType: 'CART',
  resource: {
    id: 'order-1',
    items: [
      {
        productId: 'product-1',
        quantity: 2,
        itemPrice: {
          currency: 'EUR',
          amount: 20,
        },
      },
    ],
  },
  requestor: {
    userId: 'requestor-1',
    firstName: 'Requestor',
    lastName: 'One',
    email: 'requestor@example.com',
  },
  approver: {
    userId: 'approver-1',
  },
  createdAt: '2026-06-03T07:09:38.112Z',
  updatedAt: '2026-06-03T07:10:38.112Z',
};

describe('ApprovalSummary', () => {
  it('renders the order overview, shipping, payment, and other cards with H4 headings for a CART approval', () => {
    const approval: Approval = {
      ...baseApproval,
      resourceType: 'CART',
      comment: 'requestor comment',
      details: {
        currency: 'EUR',
        shipping: { amount: 5 } as any,
        addresses: [{ type: 'SHIPPING' } as any, { type: 'BILLING' } as any],
        paymentMethods: [{ name: 'Card' } as any],
      },
    };

    render(<ApprovalSummary approval={approval} />);

    expect(screen.getByRole('heading', { level: 4, name: 'orderOverview' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'shipping' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'payment' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'other' })).toBeInTheDocument();
  });

  it('renders the quote details, base price, and quoted price cards with H4 headings for a QUOTE approval', () => {
    const approval: Approval = {
      ...baseApproval,
      resourceType: 'QUOTE',
      details: {
        currency: 'EUR',
        shipping: { amount: 5 } as any,
      },
    };

    render(<ApprovalSummary approval={approval} />);

    expect(screen.getByRole('heading', { level: 4, name: 'quoteDetails' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'basePrice' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'quotedPrice' })).toBeInTheDocument();
  });
});
