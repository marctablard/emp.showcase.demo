/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ReturnApiError } from '@/lib/client/returns';
import type { Return } from '@/platform/services/model/return';
import { ReturnDetail } from './return-detail';

const mockUseReturn = jest.fn();
const mockUseProducts = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: () => true }),
  useLocale: () => 'en-US',
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} {...props} />,
}));

jest.mock('@/hooks/return/useReturn', () => ({
  useReturn: (...args: unknown[]) => mockUseReturn(...args),
}));

jest.mock('@/hooks/product/useProducts', () => ({
  useProducts: () => mockUseProducts(),
}));

jest.mock('@/hooks/useL10n', () => ({
  useL10n: () => ({
    l10n: (value: unknown) => (typeof value === 'string' ? value : ''),
  }),
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock('./return-status-badge', () => ({
  ReturnStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

function buildReturn(): Return {
  return {
    id: 'return-123',
    status: 'PENDING',
    received: false,
    isExpired: false,
    reason: { code: 'WRONG_ITEM', details: 'The wrong item was delivered.' },
    total: { value: 119, currency: 'EUR' },
    calculatedPrice: {
      finalPrice: { netValue: 100, grossValue: 119, taxValue: 19, taxRate: 19, currency: 'EUR' },
    },
    orders: [
      {
        id: 'order-123',
        items: [
          {
            id: 'item-123',
            name: 'BlueSolar 55 W',
            quantity: 1,
            vendorName: 'Nature Home',
            itemNumber: 'blue-solar-55w',
            productId: 'blue-solar',
            brand: 'Nature Home',
            images: ['https://example.com/blue-solar.jpg'],
            reason: { code: 'CHANGED_MIND', details: 'Item reason details.' },
            calculatedUnitPrice: { netValue: 100, grossValue: 119, taxValue: 19, currency: 'EUR' },
            calculatedPrice: {
              finalPrice: { netValue: 100, grossValue: 119, taxValue: 19, currency: 'EUR' },
            },
          },
        ],
      },
    ],
  } as Return;
}

describe('ReturnDetail', () => {
  beforeEach(() => {
    mockUseReturn.mockReturnValue({
      returnItem: buildReturn(),
      loading: false,
      error: null,
      refreshReturn: jest.fn(),
    });
    mockUseProducts.mockReturnValue({
      products: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
      setAsCurrent: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function withReturn(returnItem: Return) {
    mockUseReturn.mockReturnValue({ returnItem, loading: false, error: null, refreshReturn: jest.fn() });
  }

  function getTotals(): HTMLElement {
    return screen.getByText('totalReturnValue').closest('table') as HTMLElement;
  }

  it('renders the return id as H1 with the return-details eyebrow', () => {
    render(<ReturnDetail returnId="return-123" />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('return-123');
    expect(heading).not.toHaveTextContent('title:');
    expect(screen.getByText('returnDetails')).toBeInTheDocument();
  });

  it('renders the summary before the returned products and totals', () => {
    render(<ReturnDetail returnId="return-123" />);

    const orderNumber = screen.getByText('order-123');
    const productsBar = screen.getByText('returnedProducts');
    const totalLabel = screen.getByText('totalReturnValue');
    expect(orderNumber.compareDocumentPosition(productsBar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(productsBar.compareDocumentPosition(totalLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps the top-level reason and its details in the summary', () => {
    render(<ReturnDetail returnId="return-123" />);

    expect(screen.getByText('reason')).toBeInTheDocument();
    expect(screen.getByText('claimReasons.WRONG_ITEM')).toBeInTheDocument();
    expect(screen.getByText('reasonDetails')).toBeInTheDocument();
    expect(screen.getByText('The wrong item was delivered.')).toBeInTheDocument();
  });

  it('renders Net value of goods, Tax when rate > 0, and a single gross Total return value', () => {
    render(<ReturnDetail returnId="return-123" />);

    const netLabel = screen.getByText('netValueOfGoods');
    const taxLabel = screen.getByText('tax (19%)');
    const totalLabel = screen.getByText('totalReturnValue');
    expect(netLabel.compareDocumentPosition(taxLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(taxLabel.compareDocumentPosition(totalLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const totals = getTotals();
    expect(within(totals).getByText('€100.00')).toBeInTheDocument();
    expect(within(totals).getByText('€19.00')).toBeInTheDocument();
    expect(within(totals).getByText('€119.00')).toBeInTheDocument();
    expect(within(totals).queryByText(/gross/)).not.toBeInTheDocument();
  });

  it('shows Tax without a percent when finalPrice omits taxRate', () => {
    withReturn({
      ...buildReturn(),
      calculatedPrice: { finalPrice: { netValue: 100, grossValue: 119, taxValue: 19, currency: 'EUR' } },
    } as Return);

    render(<ReturnDetail returnId="return-123" />);

    const totals = getTotals();
    expect(within(totals).getByText('tax')).toBeInTheDocument();
    expect(within(totals).queryByText(/tax \(/)).not.toBeInTheDocument();
    expect(within(totals).getByText('€19.00')).toBeInTheDocument();
  });

  it('omits Tax from the totals when tax rate is 0%', () => {
    withReturn({
      ...buildReturn(),
      calculatedPrice: { finalPrice: { netValue: 100, grossValue: 100, taxValue: 0, taxRate: 0, currency: 'EUR' } },
    } as Return);

    render(<ReturnDetail returnId="return-123" />);

    const totals = getTotals();
    expect(within(totals).queryByText(/tax/)).not.toBeInTheDocument();
    expect(within(totals).getAllByText('€100.00')).toHaveLength(2);
  });

  it('shows Total return value as "-" when finalPrice.grossValue is missing', () => {
    withReturn({
      ...buildReturn(),
      calculatedPrice: { finalPrice: { netValue: 100, taxValue: 19, currency: 'EUR' } },
    } as Return);

    render(<ReturnDetail returnId="return-123" />);

    const totals = getTotals();
    expect(within(totals).getByText('€100.00')).toBeInTheDocument();
    expect(within(totals).queryByText('€119.00')).not.toBeInTheDocument();
    const totalRow = within(totals).getByText('totalReturnValue').closest('tr') as HTMLElement;
    expect(within(totalRow).getByText('-')).toBeInTheDocument();
  });

  it('renders item reason and description under the item number', () => {
    render(<ReturnDetail returnId="return-123" />);

    const row = screen.getByTestId('return-detail-item-item-123');
    const itemNumber = within(row).getByText(/blue-solar-55w/);
    const reason = within(row).getByText('claimReasons.CHANGED_MIND');
    expect(within(row).getByText('Item reason details.')).toBeInTheDocument();
    expect(itemNumber.compareDocumentPosition(reason) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('links the product name and shows the brand', () => {
    render(<ReturnDetail returnId="return-123" />);

    const row = screen.getByTestId('return-detail-item-item-123');
    expect(within(row).getByRole('link', { name: 'BlueSolar 55 W' })).toHaveAttribute('href', '/product/blue-solar');
    expect(within(row).getByText('Nature Home')).toBeInTheDocument();
    expect(within(row).getByRole('img', { name: 'BlueSolar 55 W' })).toBeInTheDocument();
  });

  it('keeps product Price and Refund Amount net first with gross shown as the secondary value', () => {
    render(<ReturnDetail returnId="return-123" />);

    const row = screen.getByTestId('return-detail-item-item-123');
    const netValues = within(row).getAllByText('€100.00');
    const grossValues = within(row).getAllByText('gross €119.00');
    expect(netValues).toHaveLength(2);
    expect(grossValues).toHaveLength(2);
    expect(netValues[0].compareDocumentPosition(grossValues[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps unit price and refund amount distinct for multi-quantity items', () => {
    const base = buildReturn();
    withReturn({
      ...base,
      orders: [
        {
          id: 'order-123',
          items: [
            {
              ...base.orders[0].items[0],
              id: 'distinct-price-item',
              quantity: 2,
              calculatedUnitPrice: { netValue: 50, grossValue: 59.5, taxValue: 9.5, currency: 'EUR' },
            },
          ],
        },
      ],
    } as Return);

    render(<ReturnDetail returnId="return-123" />);

    const cells = within(screen.getByTestId('return-detail-item-distinct-price-item')).getAllByRole('cell');
    expect(cells[2]).toHaveTextContent('€50.00');
    expect(cells[2]).toHaveTextContent('gross €59.50');
    expect(cells[4]).toHaveTextContent('€100.00');
    expect(cells[4]).toHaveTextContent('gross €119.00');
  });

  it('falls back the primary unit price to the gross value when no net value is available', () => {
    withReturn({
      ...buildReturn(),
      orders: [
        {
          id: 'order-123',
          items: [
            { id: 'item-456', name: 'Gross Only Item', quantity: 1, grossUnitPrice: { value: 59.99, currency: 'EUR' } },
          ],
        },
      ],
    } as Return);

    render(<ReturnDetail returnId="return-123" />);

    const cells = within(screen.getByTestId('return-detail-item-item-456')).getAllByRole('cell');
    expect(cells[2]).toHaveTextContent('€59.99');
    expect(cells[2]).not.toHaveTextContent('gross');
  });

  it('never presents a gross-only value as net when a net-equivalent unitPrice fallback exists', () => {
    withReturn({
      ...buildReturn(),
      orders: [
        {
          id: 'order-123',
          items: [
            {
              id: 'gross-fallback-item',
              name: 'Gross Fallback Item',
              quantity: 2,
              unitPrice: { value: 80, currency: 'EUR' },
              grossUnitPrice: { value: 119, currency: 'EUR' },
            },
          ],
        },
      ],
    } as Return);

    render(<ReturnDetail returnId="return-123" />);

    const priceCell = within(screen.getByTestId('return-detail-item-gross-fallback-item')).getAllByRole('cell')[2];
    expect(priceCell.firstElementChild).toHaveTextContent('€80.00');
    expect(priceCell).toHaveTextContent('gross €119.00');
  });

  it('renders the column headers for the returned products', () => {
    render(<ReturnDetail returnId="return-123" />);

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).toEqual(['product', '', 'price', 'quantity', 'refundAmount']);
  });

  it('shows a translated error alert and retries via refreshReturn on click', () => {
    const refreshReturn = jest.fn();
    mockUseReturn.mockReturnValue({
      returnItem: null,
      loading: false,
      error: new Error('Network exploded'),
      refreshReturn,
    });

    render(<ReturnDetail returnId="return-err" />);

    expect(screen.getByText('error')).toBeInTheDocument();
    // The raw Error carries no code; the page names this one return, not the whole list.
    expect(screen.getByText('apiError.RETURN_FETCH_FAILED')).toBeInTheDocument();
    expect(screen.queryByText('errorLoading')).not.toBeInTheDocument();
    expect(screen.queryByText('Network exploded')).not.toBeInTheDocument();
    expect(screen.queryByText('returnNotFound')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('return-detail-retryButton'));
    expect(refreshReturn).toHaveBeenCalledTimes(1);
  });

  it('shows the translated message for a coded failure instead of the load-context fallback', () => {
    mockUseReturn.mockReturnValue({
      returnItem: null,
      loading: false,
      error: new ReturnApiError('Failed to fetch return', 500, { code: 'RETURN_FETCH_FAILED' }),
      refreshReturn: jest.fn(),
    });

    render(<ReturnDetail returnId="return-err" />);

    expect(screen.getByText('RETURN_FETCH_FAILED')).toBeInTheDocument();
    expect(screen.queryByText('apiError.RETURN_FETCH_FAILED')).not.toBeInTheDocument();
  });

  it('names the product from the catalog when the return payload carries no name', () => {
    // The return payload frequently omits the name; without a fallback the link renders empty and
    // the image alternative text reads "undefined".
    const nameless = buildReturn();
    delete (nameless.orders[0].items[0] as { name?: string }).name;
    mockUseReturn.mockReturnValue({ returnItem: nameless, loading: false, error: null, refreshReturn: jest.fn() });
    mockUseProducts.mockReturnValue({
      products: [{ id: 'blue-solar', name: 'BlueSolar aus dem Katalog' }],
      loading: false,
      error: null,
      refetch: jest.fn(),
      setAsCurrent: jest.fn(),
    });

    render(<ReturnDetail returnId="return-1" />);

    expect(screen.getAllByText('BlueSolar aus dem Katalog').length).toBeGreaterThan(0);
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('falls back to the item number when neither payload nor catalog knows the name', () => {
    const nameless = buildReturn();
    delete (nameless.orders[0].items[0] as { name?: string }).name;
    mockUseReturn.mockReturnValue({ returnItem: nameless, loading: false, error: null, refreshReturn: jest.fn() });

    render(<ReturnDetail returnId="return-1" />);

    expect(screen.getAllByText('blue-solar-55w').length).toBeGreaterThan(0);
  });
});
