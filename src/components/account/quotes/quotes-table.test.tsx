/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Quote } from '@/platform/services/model/quote';
import { QuotesTable } from './quotes-table';

const push = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    if (values && 'id' in values) {
      return `${key}:${values.id}`;
    }
    return key;
  },
  useLocale: () => 'en-US',
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push }),
}));

function buildQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'Q-1000',
    status: 'ACCEPTED',
    reference: 'PO-42',
    submittedDate: '2026-05-31T10:00:00.000Z',
    customerId: 'customer-1',
    customerName: 'Ada Lovelace',
    approverName: 'Grace Hopper',
    currency: 'EUR',
    totalGross: 120,
    totalNet: 100,
    totalVat: 20,
    items: [
      {
        quantity: { quantity: 3, unitCode: 'EA' },
        product: {
          id: 'product-1',
          quantity: 3,
          itemPrice: { amount: 120, currency: 'EUR', baseAmount: 100, tax: 20 },
        },
      },
    ],
    ...overrides,
  };
}

describe('QuotesTable', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders columns in the contract order: Quote ID, Quotation Date, Status, Related Order, Quote Reference, Requested By, Authorization, Net Value, Number of Products, Action', () => {
    render(<QuotesTable quotes={[buildQuote()]} />);

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).toEqual([
      'quoteId',
      'quotationDate',
      'status',
      'relatedOrder',
      'quoteReference',
      'requestedBy',
      'authorization',
      'netValue',
      'numberOfProducts',
      'action',
    ]);
  });

  it('keeps Requested By, Authorization, Number of Products, and Related Order non-sortable', () => {
    render(<QuotesTable quotes={[buildQuote()]} />);

    for (const name of ['requestedBy', 'authorization', 'numberOfProducts']) {
      const header = screen.getByRole('columnheader', { name });
      expect(within(header).queryByRole('button')).not.toBeInTheDocument();
      expect(header).not.toHaveAttribute('aria-sort');
    }

    const relatedOrderHeader = screen.getByRole('columnheader', { name: 'relatedOrder' });
    expect(within(relatedOrderHeader).queryByRole('button')).not.toBeInTheDocument();
    expect(relatedOrderHeader).not.toHaveAttribute('aria-sort');
  });

  it('keeps the Action column non-sortable, centered, and arrow-only', () => {
    render(<QuotesTable quotes={[buildQuote()]} />);

    const actionHeader = screen.getByRole('columnheader', { name: 'action' });
    expect(within(actionHeader).queryByRole('button')).not.toBeInTheDocument();
    expect(actionHeader).not.toHaveAttribute('aria-sort');

    const arrowLink = screen.getByRole('link', { name: 'viewQuoteAriaLabel:Q-1000' });
    expect(arrowLink).toHaveTextContent('');
  });

  it('marks Quotation Date as descending-sorted by default and reflects the active sort field/direction', () => {
    render(<QuotesTable quotes={[buildQuote()]} sortField="quotationDate" sortDirection="desc" />);

    const dateHeader = screen.getByRole('columnheader', { name: /quotationDate/ });
    expect(dateHeader).toHaveAttribute('aria-sort', 'descending');

    const statusHeader = screen.getByRole('columnheader', { name: /status/ });
    expect(statusHeader).toHaveAttribute('aria-sort', 'none');
  });

  it('calls onToggleSort with the clicked sortable field', () => {
    const onToggleSort = jest.fn();
    render(<QuotesTable quotes={[buildQuote()]} onToggleSort={onToggleSort} />);

    const referenceHeader = screen.getByRole('columnheader', { name: /quoteReference/ });
    fireEvent.click(within(referenceHeader).getByRole('button'));

    expect(onToggleSort).toHaveBeenCalledWith('quoteReference');
  });

  it('navigates the full row, bold Quote ID link, and Action arrow to the same quote detail destination', () => {
    render(<QuotesTable quotes={[buildQuote({ id: 'Q-42' })]} />);

    const row = screen.getByText('Q-42').closest('tr') as HTMLTableRowElement;
    fireEvent.click(row);
    expect(push).toHaveBeenCalledWith('/account/quotes/Q-42');

    const idLink = screen.getByRole('link', { name: 'Q-42' });
    expect(idLink).toHaveAttribute('href', '/account/quotes/Q-42');
    expect(idLink.className).toContain('font-bold');

    const arrowLink = screen.getByRole('link', { name: 'viewQuoteAriaLabel:Q-42' });
    expect(arrowLink).toHaveAttribute('href', '/account/quotes/Q-42');
  });

  it('uses shared table-link styling (no underline, table typography, pointer) for quote table links', () => {
    render(<QuotesTable quotes={[buildQuote({ id: 'Q-42', orderId: 'order-42' })]} />);

    const idLink = screen.getByRole('link', { name: 'Q-42' });
    expect(idLink).toHaveClass(
      'no-underline',
      'cursor-pointer',
      'font-secondary',
      'text-[16px]',
      'leading-[24px]',
      'text-text-action',
      'font-bold',
    );
    expect(idLink).not.toHaveClass('underline');

    const relatedOrderLink = screen.getByRole('link', { name: 'order-42' });
    expect(relatedOrderLink).toHaveClass(
      'no-underline',
      'cursor-pointer',
      'font-secondary',
      'text-[16px]',
      'leading-[24px]',
    );
    expect(relatedOrderLink).not.toHaveClass('underline');

    const arrowLink = screen.getByRole('link', { name: 'viewQuoteAriaLabel:Q-42' });
    expect(arrowLink).toHaveClass('no-underline', 'cursor-pointer', 'font-secondary', 'text-[16px]', 'leading-[24px]');
  });

  it('does not trigger row navigation when the nested Quote ID or Action links are clicked', () => {
    render(<QuotesTable quotes={[buildQuote({ id: 'Q-42' })]} />);

    const idLink = screen.getByRole('link', { name: 'Q-42' });
    fireEvent.click(idLink);
    expect(push).not.toHaveBeenCalled();

    const arrowLink = screen.getByRole('link', { name: 'viewQuoteAriaLabel:Q-42' });
    fireEvent.click(arrowLink);
    expect(push).not.toHaveBeenCalled();
  });

  it('supports keyboard row navigation with Enter and does not navigate on Space', () => {
    render(<QuotesTable quotes={[buildQuote({ id: 'Q-42' })]} />);

    const row = screen.getByRole('row', { name: 'viewQuoteAriaLabel:Q-42' });

    fireEvent.keyDown(row, { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/account/quotes/Q-42');

    push.mockClear();
    fireEvent.keyDown(row, { key: ' ' });
    expect(push).not.toHaveBeenCalled();
  });

  it('does not row-navigate when Enter is pressed on nested links', () => {
    render(<QuotesTable quotes={[buildQuote({ id: 'Q-42', orderId: 'order-42' })]} />);

    const idLink = screen.getByRole('link', { name: 'Q-42' });
    fireEvent.keyDown(idLink, { key: 'Enter' });
    expect(push).not.toHaveBeenCalled();

    const orderLink = screen.getByRole('link', { name: 'order-42' });
    fireEvent.keyDown(orderLink, { key: 'Enter' });
    expect(push).not.toHaveBeenCalled();

    const arrowLink = screen.getByRole('link', { name: 'viewQuoteAriaLabel:Q-42' });
    fireEvent.keyDown(arrowLink, { key: 'Enter' });
    expect(push).not.toHaveBeenCalled();
  });

  it('displays Net Value from totalNet, never totalGross', () => {
    render(<QuotesTable quotes={[buildQuote({ totalNet: 100, totalGross: 120, currency: 'EUR' })]} />);

    const row = screen.getByText('Q-1000').closest('tr') as HTMLTableRowElement;
    expect(within(row).getByText('€100.00')).toBeInTheDocument();
    expect(within(row).queryByText('€120.00')).not.toBeInTheDocument();
  });

  it('shows the related order link in a standalone column when orderId is present', () => {
    render(<QuotesTable quotes={[buildQuote({ id: 'Q-77', orderId: 'order-77' })]} />);

    const orderLink = screen.getByRole('link', { name: 'order-77' });
    expect(orderLink).toHaveAttribute('href', '/account/orders/order-77');

    const row = screen.getByText('Q-77').closest('tr') as HTMLTableRowElement;
    const cells = within(row).getAllByRole('cell');
    expect(cells).toHaveLength(10);
    expect(within(cells[3]).getByRole('link', { name: 'order-77' })).toBe(orderLink);
    expect(cells[0]).not.toHaveTextContent('relatedOrder');
  });

  it('shows a placeholder in the Related Order column when a quote has no related order', () => {
    render(<QuotesTable quotes={[buildQuote({ id: 'Q-88', orderId: undefined })]} />);

    const row = screen.getByText('Q-88').closest('tr') as HTMLTableRowElement;
    const cells = within(row).getAllByRole('cell');
    expect(cells[3]).toHaveTextContent('-');
    expect(within(cells[3]).queryByRole('link')).not.toBeInTheDocument();
  });

  it('does not navigate the row when the related order link is clicked', () => {
    render(<QuotesTable quotes={[buildQuote({ id: 'Q-99', orderId: 'order-99' })]} />);

    const orderLink = screen.getByRole('link', { name: 'order-99' });
    fireEvent.click(orderLink);
    expect(push).not.toHaveBeenCalled();
  });

  it('shows the empty-quotes message when there are no quotes and no active search', () => {
    render(<QuotesTable quotes={[]} hasActiveSearch={false} />);
    expect(screen.getByText('noQuotes')).toBeInTheDocument();
    expect(screen.queryByText('noMatches')).not.toBeInTheDocument();
  });

  it('shows the no-matches message instead of the empty-quotes message when a search is active and there are no results', () => {
    render(<QuotesTable quotes={[]} hasActiveSearch />);
    expect(screen.getByText('noMatches')).toBeInTheDocument();
    expect(screen.queryByText('noQuotes')).not.toBeInTheDocument();
  });

  it('shows a loading indicator instead of rows while loading', () => {
    render(<QuotesTable quotes={[]} loading />);
    expect(screen.queryByText('noQuotes')).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2); // header row + loading row
  });
});
