/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import type { Return } from '@/platform/services/model/return';
import { ReturnDetail } from './return-detail';

const mockUseReturn = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en-US',
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} {...props} />,
}));

jest.mock('@/hooks/return/useReturn', () => ({
  useReturn: (...args: unknown[]) => mockUseReturn(...args),
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
      finalPrice: { netValue: 100, grossValue: 119, taxValue: 19, currency: 'EUR' },
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the Return Details strip before the full-width overview and product list', () => {
    const { container } = render(<ReturnDetail returnId="return-123" />);

    const returnDetails = screen.getByText('returnDetails');
    const overview = screen.getByText('returnOverview');
    const productsHeader = screen.getByText('product');
    expect(returnDetails.compareDocumentPosition(overview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(overview.compareDocumentPosition(productsHeader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const detailsCard = returnDetails.closest('.rounded-md');
    expect(detailsCard).toHaveClass('bg-surface-primary', 'shadow-sm', 'p-6');
    expect(
      Array.from(container.querySelectorAll('div')).some((element) =>
        element.classList.contains('sm:grid-cols-[200px_minmax(0,1fr)]'),
      ),
    ).toBe(true);
  });

  it('keeps the top-level reason and its details in the summary strip', () => {
    render(<ReturnDetail returnId="return-123" />);

    expect(screen.getByText('reasonLabel')).toBeInTheDocument();
    expect(screen.getByText('claimReasons.WRONG_ITEM')).toHaveClass('!bg-surface-disabled', '!font-bold');
    expect(screen.getByText('reasonDetails')).toBeInTheDocument();
    expect(screen.getByText('The wrong item was delivered.')).toBeInTheDocument();
  });

  it('renders Return Overview net-first with Net value of goods before Total return value', () => {
    render(<ReturnDetail returnId="return-123" />);

    const netLabel = screen.getByText('netValueOfGoods');
    const totalLabel = screen.getByText('totalReturnValue');
    expect(netLabel.compareDocumentPosition(totalLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const overview = screen.getByText('returnOverview').closest('.bg-surface-primary') as HTMLElement;
    expect(within(overview).getAllByText('€100.00')).toHaveLength(2);

    const grossLabel = within(overview).getByText('gross');
    const grossValue = within(overview).getByText('€119.00');
    expect(totalLabel.compareDocumentPosition(grossLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(grossLabel.compareDocumentPosition(grossValue) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('uses the shared product-grid contract for return items with refund and metadata extensions', () => {
    render(<ReturnDetail returnId="return-123" />);

    const desktopRow = screen.getByTestId('product-item-desktop-item-123');
    const mobileRow = screen.getByTestId('product-item-mobile-item-123');

    expect(within(desktopRow).getAllByText('€100.00').length).toBeGreaterThanOrEqual(1);
    expect(within(desktopRow).getByText('gross €119.00')).toBeInTheDocument();
    expect(within(mobileRow).getByText('claimReasons.CHANGED_MIND')).toBeInTheDocument();
    expect(within(mobileRow).getByText('Item reason details.')).toBeInTheDocument();
  });

  it('does not render a separate Returned products heading but keeps H6 column headers', () => {
    render(<ReturnDetail returnId="return-123" />);

    expect(screen.queryByText('returnedProducts')).not.toBeInTheDocument();

    const header = screen.getByText('product').closest('.pb-4') as HTMLElement;
    expect(screen.getByText('product').tagName).toBe('H6');
    expect(within(header).getByText('price').tagName).toBe('H6');
    expect(within(header).getByText('quantity').tagName).toBe('H6');
    expect(within(header).getByText('refundAmount').tagName).toBe('H6');
  });

  it('keeps product Price and Refund Amount net first with gross shown as the secondary value', () => {
    render(<ReturnDetail returnId="return-123" />);

    const desktopRow = screen.getByTestId('product-item-desktop-item-123');
    const netValues = within(desktopRow).getAllByText('€100.00');
    const grossValues = within(desktopRow).getAllByText('gross €119.00');
    expect(netValues.length).toBeGreaterThanOrEqual(1);
    expect(grossValues).toHaveLength(1);

    expect(netValues[0].compareDocumentPosition(grossValues[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('falls back the primary unit price to the gross value when no net value is available', () => {
    mockUseReturn.mockReturnValue({
      returnItem: {
        ...buildReturn(),
        orders: [
          {
            id: 'order-123',
            items: [
              {
                id: 'item-456',
                name: 'Gross Only Item',
                quantity: 1,
                grossUnitPrice: { value: 59.99, currency: 'EUR' },
              },
            ],
          },
        ],
      },
      loading: false,
      error: null,
      refreshReturn: jest.fn(),
    });

    render(<ReturnDetail returnId="return-123" />);

    const row = screen
      .getAllByText((_, node) => node?.textContent === 'Gross Only Item')[0]
      .closest('[data-testid^="product-item-row-"]') as HTMLElement;
    const primaryValues = within(row).getAllByText('€59.99');
    expect(primaryValues.length).toBeGreaterThanOrEqual(1);
  });

  it('never presents a gross-only value as net when a legitimate net-equivalent unitPrice fallback exists', () => {
    mockUseReturn.mockReturnValue({
      returnItem: {
        ...buildReturn(),
        orders: [
          {
            id: 'order-123',
            items: [
              {
                id: 'gross-fallback-item',
                name: 'Gross Fallback Item',
                // Quantity 2 keeps the unit-price column (80) and the refund column (80 * 2)
                // numerically distinct so the assertions below cannot coincidentally overlap.
                quantity: 2,
                // No calculatedUnitPrice / netPrice: the net-first fallback must resolve to
                // `unitPrice.value` (80), never to the unrelated gross value (119).
                unitPrice: { value: 80, currency: 'EUR' },
                grossUnitPrice: { value: 119, currency: 'EUR' },
              },
            ],
          },
        ],
      },
      loading: false,
      error: null,
      refreshReturn: jest.fn(),
    });

    render(<ReturnDetail returnId="return-123" />);

    const desktopRow = screen.getByTestId('product-item-desktop-gross-fallback-item');

    expect(within(desktopRow).getByText('€80.00')).toBeInTheDocument();
    expect(within(desktopRow).queryByText('€119.00')).not.toBeInTheDocument();

    const grossSecondary = desktopRow.querySelector('.text-sm');
    expect(grossSecondary).toHaveTextContent('119.00');
  });

  it('reshapes the smallest-mobile row like the Order/Quote pattern while retaining reason and comment', () => {
    const { container } = render(<ReturnDetail returnId="return-123" />);

    const mobileRow = screen.getByTestId('product-item-mobile-item-123');
    const image = container.querySelector('img[alt="BlueSolar 55 W"]') as HTMLElement;

    expect(mobileRow).toHaveClass('flex', 'flex-col', 'gap-3', 'sm:hidden');
    expect(image).toBeInTheDocument();
    expect(within(mobileRow).getByText('claimReasons.CHANGED_MIND')).toBeInTheDocument();
    expect(within(mobileRow).getByText('Item reason details.')).toBeInTheDocument();
    expect(within(mobileRow).getByText(/blue-solar-55w/)).toBeInTheDocument();
  });

  it('uses the shared overview and product-list visual hierarchy while retaining Return data', () => {
    const { container } = render(<ReturnDetail returnId="return-123" />);

    const overview = screen.getByText('returnOverview').closest('.bg-surface-primary');
    expect(overview?.parentElement).toHaveClass('bg-surface-action-hover-2', 'rounded-md', 'p-6', 'shadow-sm');
    expect(overview).toHaveClass('rounded-md', 'p-4');
    expect(screen.getByText('totalReturnValue')).toBeInTheDocument();
    expect(within(overview as HTMLElement).getByText('€119.00')).toBeInTheDocument();

    expect(screen.getAllByRole('link', { name: 'BlueSolar 55 W' })[0]).toHaveAttribute('href', '/product/blue-solar');
    expect(screen.getAllByText((_, node) => node?.textContent === 'Nature Home').length).toBeGreaterThanOrEqual(1);
    expect(
      within(screen.getByTestId('product-item-desktop-item-123')).getByText('claimReasons.CHANGED_MIND'),
    ).toHaveClass('!bg-surface-disabled');
    expect(
      within(screen.getByTestId('product-item-mobile-item-123')).getByText('Item reason details.'),
    ).toBeInTheDocument();
    expect(container.querySelector('img[alt="BlueSolar 55 W"]')).toHaveAttribute('width', '120');
  });
});
