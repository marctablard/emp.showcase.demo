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

    const row = screen.getByText('BlueSolar 55 W').closest('.py-6') as HTMLElement;
    const netValues = within(row).getAllByText('€100.00');
    const grossValues = within(row).getAllByText('gross €119.00');
    expect(netValues).toHaveLength(2);
    expect(grossValues).toHaveLength(2);

    // Price cell: net value precedes its gross secondary value.
    expect(netValues[0].compareDocumentPosition(grossValues[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Refund Amount cell: net value (H6) precedes its gross secondary value.
    expect(netValues[1].tagName).toBe('H6');
    expect(netValues[1].compareDocumentPosition(grossValues[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

    const row = screen.getByText('Gross Only Item').closest('.py-6') as HTMLElement;
    const primaryValues = within(row).getAllByText('€59.99');
    expect(primaryValues.length).toBeGreaterThanOrEqual(1);
  });

  it('reshapes the smallest-mobile row like the Order/Quote pattern while retaining reason, status, and comment', () => {
    const { container } = render(<ReturnDetail returnId="return-123" />);

    const image = container.querySelector('img[alt="BlueSolar 55 W"]') as HTMLElement;
    const mobileWrapper = image.closest('.flex-col-reverse');
    expect(mobileWrapper).toHaveClass('flex-col-reverse', 'sm:flex-row');

    expect(screen.getByText('claimReasons.CHANGED_MIND')).toBeInTheDocument();
    expect(screen.getByText('Item reason details.')).toBeInTheDocument();
    expect(screen.getByText(/blue-solar-55w/)).toBeInTheDocument();
  });

  it('uses the shared overview and product-list visual hierarchy while retaining Return data', () => {
    const { container } = render(<ReturnDetail returnId="return-123" />);

    const overview = screen.getByText('returnOverview').closest('.bg-surface-primary');
    expect(overview?.parentElement).toHaveClass('bg-surface-action-hover-2', 'rounded-md', 'p-6', 'shadow-sm');
    expect(overview).toHaveClass('rounded-md', 'p-4');
    expect(screen.getByText('totalReturnValue')).toBeInTheDocument();
    expect(within(overview as HTMLElement).getByText('€119.00')).toBeInTheDocument();

    expect(screen.getByText('BlueSolar 55 W')).toHaveAttribute('href', '/product/blue-solar');
    expect(screen.getByText('Nature Home')).toBeInTheDocument();
    expect(screen.getByText('claimReasons.CHANGED_MIND')).toHaveClass('!bg-surface-disabled');
    expect(screen.getByText('Item reason details.')).toBeInTheDocument();
    expect(container.querySelector('img[alt="BlueSolar 55 W"]')).toHaveAttribute('width', '80');
  });
});
