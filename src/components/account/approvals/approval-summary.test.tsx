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
    expect(screen.getByRole('heading', { level: 5, name: 'shippingMethod' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 5, name: 'shippingAddress' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 5, name: 'paymentMethod' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 5, name: 'billingAddress' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 5, name: 'totalValue' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 5, name: 'note' })).toBeInTheDocument();
  });

  it('uses 2 columns from sm and 4 columns from lg for CART approval cards', () => {
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
    expect(grid).toHaveClass('grid', 'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-4');
  });

  it('omits blank leading contact-name lines from shipping and billing addresses', () => {
    const approval: Approval = {
      ...baseApproval,
      resourceType: 'CART',
      details: {
        currency: 'EUR',
        shipping: { amount: 0, methodName: 'DHL Standard' } as any,
        addresses: [
          { type: 'SHIPPING', street: 'Hauptstraße', houseNumber: '123', city: 'Berlin', country: 'DE' } as any,
          { type: 'BILLING', street: 'Hauptstraße', houseNumber: '123', city: 'Berlin', country: 'DE' } as any,
        ],
        paymentMethods: [{ name: 'Card' } as any],
      },
    };

    render(<ApprovalSummary approval={approval} />);

    const shippingAddressHeading = screen.getByRole('heading', { level: 5, name: 'shippingAddress' });
    const shippingAddressValue = shippingAddressHeading.parentElement?.querySelector('.text-base');
    expect(shippingAddressValue?.textContent).toBe('Hauptstraße 123BerlinDE');
    expect(shippingAddressValue?.innerHTML.startsWith('<br')).toBe(false);
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

  it('renders Quote Reference / Number of products as H5 field headings (SummaryField)', () => {
    const approval: Approval = {
      ...baseApproval,
      resourceType: 'QUOTE',
      details: {
        currency: 'EUR',
        shipping: { amount: 0 } as any,
      },
    };

    render(<ApprovalSummary approval={approval} />);

    expect(screen.getByRole('heading', { level: 5, name: 'quoteReference' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 5, name: 'numberOfProducts' })).toBeInTheDocument();
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

    expect(screen.getAllByText('tax (19%)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/100,00\s*€/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/19,00\s*€/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/5,00\s*€/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows Free for shipping fee when shipping amount is 0 on Base and Quoted price cards', () => {
    const approval: Approval = {
      ...baseApproval,
      resourceType: 'QUOTE',
      details: {
        currency: 'EUR',
        shipping: { amount: 0 } as any,
      },
    };

    render(<ApprovalSummary approval={approval} />);

    expect(screen.getAllByText('free').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryAllByText(/5,00\s*€/)).toHaveLength(0);
  });

  it('shows Free for shipping fee on CART order overview when shipping is 0', () => {
    const approval: Approval = {
      ...baseApproval,
      details: {
        currency: 'EUR',
        shipping: { amount: 0 } as any,
      },
    };

    render(<ApprovalSummary approval={approval} />);

    expect(screen.getByText('free')).toBeInTheDocument();
  });

  it('omits the tax row when tax value is 0', () => {
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

    expect(screen.queryByText(/tax/)).not.toBeInTheDocument();
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

  it('renders Base Price from unitPrice and Quoted Price from aggregate nets', () => {
    const approval: Approval = {
      ...baseApproval,
      resourceType: 'QUOTE',
      resource: {
        id: 'Q1000457',
        items: [
          {
            quantity: 1,
            itemPrice: {
              currency: 'EUR',
              amount: 183.14,
              unitPrice: 171,
              newUnitPrice: 153.9,
              netValue: 153.9,
              grossValue: 183.14,
              taxValue: 29.24,
            },
          },
          {
            quantity: 1,
            itemPrice: {
              currency: 'EUR',
              amount: 24.69,
              unitPrice: 23.05,
              newUnitPrice: 20.75,
              netValue: 20.75,
              grossValue: 24.69,
              taxValue: 3.94,
            },
          },
          {
            quantity: 1,
            itemPrice: {
              currency: 'EUR',
              amount: 18.21,
              unitPrice: 17,
              newUnitPrice: 15.3,
              netValue: 15.3,
              grossValue: 18.21,
              taxValue: 2.91,
            },
          },
        ],
        subtotalAggregate: { currency: 'EUR', netValue: 189.95, grossValue: 226.04, taxValue: 36.09 },
      },
      details: {
        currency: 'EUR',
        shipping: { amount: 0 } as any,
      },
    };

    render(<ApprovalSummary approval={approval} />);

    // Base net = 171 + 23.05 + 17
    expect(screen.getByText(/211,05\s*€/)).toBeInTheDocument();
    // Quoted net from aggregate
    expect(screen.getByText(/189,95\s*€/)).toBeInTheDocument();
    // Quoted total = 189.95 + 36.09 (must not use gross amount sum as Base *net*)
    expect(screen.getByText(/226,04\s*€/)).toBeInTheDocument();
    expect(screen.getByText('discount')).toBeInTheDocument();
  });

  it('uses Quote-style Base/Quoted card totals (net + tax + shipping) when unit prices are absent', () => {
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

    // 100 + 19 + 5
    expect(screen.getAllByText(/124,00.*€/).length).toBeGreaterThanOrEqual(1);
  });
});
