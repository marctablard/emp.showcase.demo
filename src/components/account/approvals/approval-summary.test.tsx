/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import deOrdersTranslations from '@/i18n/translations/de/orders/index.json';
import enOrdersTranslations from '@/i18n/translations/en/orders/index.json';
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
  it('uses the estimated shipping-VAT copy so CART VAT is marked as frontend-calculated', () => {
    expect(enOrdersTranslations.Approval.shippingVatEstimated).toBe('Shipping VAT (estimated)');
    expect(deOrdersTranslations.Approval.shippingVatEstimated).toBe('Versand-MwSt. (geschätzt)');
  });

  it('uses CART-only goods-total and estimated shipping-fee copy', () => {
    expect(enOrdersTranslations.Approval.totalValueOfGoods).toBe('Total value of goods');
    expect(deOrdersTranslations.Approval.totalValueOfGoods).toBe('Gesamt-Warenwert');
    expect(enOrdersTranslations.Approval.shippingFeeEstimated).toBe('Shipping fee (estimated)');
    expect(deOrdersTranslations.Approval.shippingFeeEstimated).toBe('Versandgebühr (geschätzt)');
    expect(enOrdersTranslations.Approval.totalValue).toBe('Total value');
    expect(enOrdersTranslations.Approval.shippingFee).toBe('Shipping fee');
  });

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
    expect(screen.getByRole('heading', { level: 5, name: 'totalValueOfGoods' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 5, name: 'totalValue' })).not.toBeInTheDocument();
    expect(screen.getByText('shippingFeeEstimated')).toBeInTheDocument();
    expect(screen.queryByText('shippingFee')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 5, name: 'note' })).toBeInTheDocument();
  });

  it('shows VAT without a percent when CART items omit taxRate (does not calculate tax/net)', () => {
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

    render(<ApprovalSummary approval={approval} />);

    expect(screen.getByText('tax')).toBeInTheDocument();
    expect(screen.queryByText(/tax \(/)).not.toBeInTheDocument();
  });

  it('lists CART goods total before estimated shipping because totalPrice.grossValue excludes shipping', () => {
    const approval: Approval = {
      ...baseApproval,
      resourceType: 'CART',
      comment: '500+10',
      resource: {
        id: '6a968d9ef2ed195dd3e8a481',
        items: [
          {
            productId: 'enjoysolar-200w-module',
            quantity: 10,
            itemPrice: {
              currency: 'CHF',
              amount: 538.5,
              unitPrice: 50,
              newUnitPrice: 50,
              netValue: 500,
              taxRate: 7.7,
            },
          },
        ],
        totalPrice: {
          currency: 'CHF',
          amount: 500,
          netValue: 500,
          grossValue: 538.5,
          taxValue: 38.5,
        },
        subtotalAggregate: { currency: 'CHF', netValue: 500, grossValue: 538.5, taxValue: 38.5 },
      },
      details: {
        currency: 'CHF',
        shipping: {
          methodId: 'fw-shipping',
          zoneId: 'fw-zone',
          methodName: 'Super Shipping',
          amount: 10,
          shippingTaxCode: 'REDUCED_3',
        } as any,
        addresses: [{ type: 'SHIPPING' } as any, { type: 'BILLING' } as any],
        paymentMethods: [{ provider: 'none', method: 'invoice' } as any],
      },
    };

    const { container } = render(<ApprovalSummary approval={approval} />);
    const overview = container.querySelector('[data-slot="card"]');
    const text = overview?.textContent ?? '';

    expect(text.indexOf('netValueOfGoods')).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('tax (7.7%)')).toBeGreaterThan(text.indexOf('netValueOfGoods'));
    expect(text.indexOf('totalValueOfGoods')).toBeGreaterThan(text.indexOf('tax (7.7%)'));
    expect(text.indexOf('shippingFeeEstimated')).toBeGreaterThan(text.indexOf('totalValueOfGoods'));
    expect(screen.queryByTestId('approval-overview-shipping-tax-estimated')).not.toBeInTheDocument();
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
    expect(screen.getAllByText('shippingFee').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('shippingFeeEstimated')).not.toBeInTheDocument();
    expect(screen.queryByText('totalValueOfGoods')).not.toBeInTheDocument();
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

  it('shows VAT rate percent on Base/Quoted Price from item taxRate', () => {
    const approval: Approval = {
      ...baseApproval,
      resourceType: 'QUOTE',
      resource: {
        ...baseApproval.resource,
        items: [
          {
            productId: 'product-1',
            quantity: 2,
            itemPrice: {
              currency: 'EUR',
              amount: 100,
              taxRate: 19,
            },
          },
        ],
        taxAggregate: { lines: [{ name: 'STANDARD', amount: 19, rate: 19, taxable: 100 }] },
      },
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

  it('still shows goods and shipping VAT percents when taxAggregate mixes rates', () => {
    const approval: Approval = {
      ...baseApproval,
      resourceType: 'QUOTE',
      resource: {
        ...baseApproval.resource,
        items: [
          {
            productId: 'enjoysolar-200w-module',
            quantity: 2,
            itemPrice: {
              currency: 'CHF',
              amount: 107.7,
              netValue: 100,
              taxValue: 7.7,
              taxRate: 7.7,
            },
          },
        ],
        subtotalAggregate: { currency: 'CHF', netValue: 100, grossValue: 107.7, taxValue: 7.7 },
        taxAggregate: {
          lines: [
            { name: 'STANDARD', amount: 7.7, rate: 7.7, taxable: 100 },
            { name: 'REDUCED_3', amount: 0.74, rate: 3.7, taxable: 20 },
          ],
        },
      },
      details: {
        currency: 'CHF',
        shipping: { amount: 20, methodName: 'Super Shipping', grossAmount: 20.74, taxRate: 3.7 } as any,
      },
    };

    render(<ApprovalSummary approval={approval} />);

    expect(screen.getAllByText('tax (7.7%)').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('shippingVat (3.7%)').length).toBeGreaterThanOrEqual(2);
  });

  it('shows shipping tax on Base and Quoted Price when quote grossAmount exceeds net fee', () => {
    const approval: Approval = {
      ...baseApproval,
      resourceType: 'QUOTE',
      resource: {
        ...baseApproval.resource,
        subtotalAggregate: { currency: 'EUR', netValue: 7942, grossValue: 8517.74, taxValue: 575.74 },
      },
      details: {
        currency: 'EUR',
        shipping: { amount: 20, methodName: 'DHL', grossAmount: 21.4 } as any,
      },
    };

    render(<ApprovalSummary approval={approval} />);

    expect(screen.getAllByText('shippingVat').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/1,40\s*€/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/8\.539,14\s*€/).length).toBeGreaterThanOrEqual(2);
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

  it('hides Shipping fee (estimated) on CART order overview when shipping is 0', () => {
    const approval: Approval = {
      ...baseApproval,
      details: {
        currency: 'EUR',
        shipping: { amount: 0 } as any,
      },
    };

    render(<ApprovalSummary approval={approval} />);

    expect(screen.queryByText('shippingFeeEstimated')).not.toBeInTheDocument();
    expect(screen.queryByText('free')).not.toBeInTheDocument();
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

  it('uses totalPrice.grossValue for CART Total value and never totalPrice.amount (170 vs 182.29)', () => {
    const approval: Approval = {
      ...baseApproval,
      resourceType: 'CART',
      resource: {
        id: 'cart-ch-shipping-tax',
        items: [
          { productId: 'p1', quantity: 1, itemPrice: { currency: 'CHF', amount: 150, netValue: 150, taxRate: 7.7 } },
        ],
        totalPrice: {
          currency: 'CHF',
          amount: 170,
          netValue: 170,
          grossValue: 182.29,
          taxValue: 12.29,
        },
        subtotalAggregate: { currency: 'CHF', netValue: 150, grossValue: 161.55, taxValue: 11.55 },
      },
      details: {
        currency: 'CHF',
        shipping: { amount: 20, taxCode: 'REDUCED_3', taxRate: 3.7 } as any,
        addresses: [{ type: 'SHIPPING' } as any, { type: 'BILLING' } as any],
        paymentMethods: [{ name: 'Card' } as any],
      },
    };

    render(<ApprovalSummary approval={approval} />);

    const totalValueHeading = screen.getByRole('heading', { level: 5, name: 'totalValueOfGoods' });
    const totalValueAmount = totalValueHeading.parentElement?.querySelectorAll('h5')[1];
    expect(totalValueAmount).toHaveTextContent(/182,29/);
    expect(totalValueAmount).not.toHaveTextContent(/170,00/);

    expect(screen.getByText('tax (7.7%)')).toBeInTheDocument();
    const shippingTaxRow = screen.getByTestId('approval-overview-shipping-tax-estimated');
    expect(shippingTaxRow).toHaveTextContent('shippingVatEstimated (3.7%)');
    expect(shippingTaxRow).toHaveTextContent(/0,74/);
  });

  it('uses subtotalAggregate.netValue for estimated shipping VAT when line items are missing', () => {
    const approval: Approval = {
      ...baseApproval,
      resourceType: 'CART',
      resource: {
        id: 'cart-empty-items',
        items: [],
        totalPrice: {
          currency: 'CHF',
          amount: 170,
          netValue: 170,
          grossValue: 182.29,
          taxValue: 12.29,
        },
        subtotalAggregate: { currency: 'CHF', netValue: 150, grossValue: 161.55, taxValue: 11.55 },
      },
      details: {
        currency: 'CHF',
        shipping: { amount: 20, taxCode: 'REDUCED_3' } as any,
        addresses: [{ type: 'SHIPPING' } as any, { type: 'BILLING' } as any],
        paymentMethods: [{ name: 'Card' } as any],
      },
    };

    render(<ApprovalSummary approval={approval} />);

    const shippingTaxRow = screen.getByTestId('approval-overview-shipping-tax-estimated');
    expect(shippingTaxRow).toHaveTextContent(/0,74/);
    expect(shippingTaxRow).not.toHaveTextContent(/150,74/);
  });

  it('omits Shipping VAT (estimated) when leftover is 0 and still uses grossValue for Total', () => {
    const approval: Approval = {
      ...baseApproval,
      resourceType: 'CART',
      resource: {
        id: 'order-finding-26',
        items: [
          { productId: 'p1', quantity: 1, itemPrice: { currency: 'EUR', amount: 37 } },
          { productId: 'p2', quantity: 1, itemPrice: { currency: 'EUR', amount: 23.05 } },
        ],
        totalPrice: { currency: 'EUR', amount: 63.05, grossValue: 63.05 },
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

    expect(screen.getByText(/60,05.*€/)).toBeInTheDocument();
    const totalValueHeading = screen.getByRole('heading', { level: 5, name: 'totalValueOfGoods' });
    const totalValueAmount = totalValueHeading.parentElement?.querySelectorAll('h5')[1];
    expect(totalValueAmount).toHaveTextContent(/63,05.*€/);
    expect(screen.queryByTestId('approval-overview-shipping-tax-estimated')).not.toBeInTheDocument();
  });

  it('omits Shipping VAT (estimated) when leftover is negative and shows totalPrice.grossValue', () => {
    const approval: Approval = {
      ...baseApproval,
      resourceType: 'CART',
      resource: {
        id: 'order-cop-6178-footer',
        items: [
          { productId: 'p1', quantity: 1, itemPrice: { currency: 'EUR', amount: 37 } },
          { productId: 'p2', quantity: 1, itemPrice: { currency: 'EUR', amount: 23.05 } },
        ],
        totalPrice: { currency: 'EUR', amount: 63.05, grossValue: 63.05 },
        subtotalAggregate: { currency: 'EUR', netValue: 60.05, grossValue: 63.05, taxValue: 3 },
      },
      details: {
        currency: 'EUR',
        shipping: { amount: 11 } as any,
        addresses: [{ type: 'SHIPPING' } as any, { type: 'BILLING' } as any],
        paymentMethods: [{ name: 'Card' } as any],
      },
    };

    render(<ApprovalSummary approval={approval} />);

    const totalValueHeading = screen.getByRole('heading', { level: 5, name: 'totalValueOfGoods' });
    const totalValueAmount = totalValueHeading.parentElement?.querySelectorAll('h5')[1];
    expect(totalValueAmount).toHaveTextContent(/63,05.*€/);
    expect(screen.queryByTestId('approval-overview-shipping-tax-estimated')).not.toBeInTheDocument();

    const shippingFeeLabel = screen.getByText('shippingFeeEstimated');
    expect(shippingFeeLabel.parentElement).toHaveTextContent(/11,00.*€/);
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
