/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { Approval } from '@/platform/services/model/approval';
import { ApprovalSummary } from './approval-summary';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'de-DE',
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
          amount: 100,
        },
      },
    ],
    subtotalAggregate: {
      currency: 'EUR',
      netValue: 100,
      grossValue: 119,
      taxValue: 19,
    },
  },
  requestor: {
    userId: 'requestor-1',
    firstName: 'Requestor',
    lastName: 'One',
    email: 'requestor@example.com',
  },
  approver: {
    userId: 'approver-1',
    firstName: 'Approver',
    lastName: 'One',
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

  it('uses a 2-column box layout for CART approval cards at sm+ (1024px Figma layout)', () => {
    const approval: Approval = {
      ...baseApproval,
      resourceType: 'CART',
      details: {
        currency: 'EUR',
        shipping: { amount: 5 } as any,
        addresses: [{ type: 'SHIPPING' } as any, { type: 'BILLING' } as any],
        paymentMethods: [{ name: 'Card' } as any],
      },
    };

    const { container } = render(<ApprovalSummary approval={approval} />);
    const grid = container.firstElementChild;
    expect(grid).toHaveClass('grid', 'grid-cols-1', 'sm:grid-cols-2');
    expect(grid).not.toHaveClass('lg:grid-cols-4');
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

  it('shows VAT rate percent on Base/Quoted Price when value of goods is positive and formats with formatCurrency', () => {
    const approval: Approval = {
      ...baseApproval,
      resourceType: 'QUOTE',
      details: {
        currency: 'EUR',
        shipping: { amount: 5 } as any,
      },
    };

    render(<ApprovalSummary approval={approval} />);

    expect(screen.getAllByText('vat (19%)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/100,00\s*€/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/19,00\s*€/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/5,00\s*€/).length).toBeGreaterThanOrEqual(1);
  });

  it('omits VAT rate percent when value of goods is not positive', () => {
    const approval: Approval = {
      ...baseApproval,
      resourceType: 'QUOTE',
      resource: {
        ...baseApproval.resource,
        items: [],
        subtotalAggregate: {
          currency: 'EUR',
          netValue: 0,
          grossValue: 0,
          taxValue: 0,
        },
      },
      details: {
        currency: 'EUR',
        shipping: { amount: 0 } as any,
      },
    };

    render(<ApprovalSummary approval={approval} />);

    expect(screen.queryByText(/vat \(/)).not.toBeInTheDocument();
    expect(screen.getAllByText('vat').length).toBeGreaterThanOrEqual(1);
  });

  it('styles Quoted Price with success surface and without dual blue+green border', () => {
    const approval: Approval = {
      ...baseApproval,
      resourceType: 'QUOTE',
      details: {
        currency: 'EUR',
        shipping: { amount: 5 } as any,
      },
    };

    render(<ApprovalSummary approval={approval} />);

    const quotedPrice = screen.getByTestId('approval-summary-quoted-price');
    expect(quotedPrice).toHaveClass('bg-surface-success');
    expect(quotedPrice).not.toHaveClass('bg-surface-action-hover-2');
    expect(quotedPrice).not.toHaveClass('border-2');
    expect(quotedPrice).not.toHaveClass('border-border-success');
  });

  it('uses subtotalAggregate.netValue for Total, never totalPrice.amount or goods+vat invent (finding 26: 60.05)', () => {
    // Characterization: items 37 + 23.05; model net 60.05; totalPrice.amount 63.05 and goods+shipping+vat would be wrong.
    const approval: Approval = {
      ...baseApproval,
      resourceType: 'CART',
      resource: {
        id: 'order-finding-26',
        items: [
          { productId: 'p1', quantity: 1, itemPrice: { currency: 'EUR', amount: 37 } },
          { productId: 'p2', quantity: 1, itemPrice: { currency: 'EUR', amount: 23.05 } },
        ],
        totalPrice: { currency: 'EUR', amount: 63.05 },
        subtotalAggregate: { currency: 'EUR', netValue: 60.05, grossValue: 63.05, taxValue: 3 },
      },
      details: {
        currency: 'EUR',
        shipping: { amount: 0 } as any,
        addresses: [{ type: 'SHIPPING' } as any, { type: 'BILLING' } as any],
        paymentMethods: [{ name: 'Card' } as any],
      },
    };

    render(<ApprovalSummary approval={approval} />);

    // Net value of goods (item sum) and Total both show 60.05; totalPrice.amount 63.05 must not appear.
    expect(screen.getAllByText(/60,05.*€/).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/63,05.*€/)).not.toBeInTheDocument();
  });

  it('does not invent Total from valueOfGoods + shipping + vat when a model net exists', () => {
    const approval: Approval = {
      ...baseApproval,
      resourceType: 'QUOTE',
      resource: {
        ...baseApproval.resource,
        items: [{ productId: 'p1', quantity: 1, itemPrice: { currency: 'EUR', amount: 100 } }],
        totalPrice: undefined,
        subtotalAggregate: { currency: 'EUR', netValue: 100, grossValue: 119, taxValue: 19 },
      },
      details: {
        currency: 'EUR',
        shipping: { amount: 5 } as any,
      },
    };

    render(<ApprovalSummary approval={approval} />);

    // Model net is 100; invented sum would be 100+5+19=124
    expect(screen.getAllByText(/100,00.*€/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/124,00.*€/)).not.toBeInTheDocument();
  });
});
