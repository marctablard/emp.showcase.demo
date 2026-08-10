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

jest.mock('@/hooks/product/useProducts', () => ({
  useProducts: () => ({ products: [], loading: false, error: null, refetch: jest.fn(), setAsCurrent: jest.fn() }),
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders H1 as returnLabel + id (not list title Returns & Claims)', () => {
    render(<ReturnDetail returnId="return-123" />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('returnLabel: return-123');
    expect(heading).not.toHaveTextContent('title:');
  });

  it('renders the Return Details strip before the full-width overview and product list', () => {
    const { container } = render(<ReturnDetail returnId="return-123" />);

    const returnDetails = screen.getByText('returnDetails');
    const overview = screen.getByText('returnOverview');
    const productsHeader = screen.getByRole('heading', { level: 6, name: 'product', hidden: true });
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

  it('renders Return Overview with Net value of goods, Tax when rate > 0, and a single gross Total return value', () => {
    render(<ReturnDetail returnId="return-123" />);

    const netLabel = screen.getByText('netValueOfGoods');
    const taxLabel = screen.getByText('tax (19%)');
    const totalLabel = screen.getByText('totalReturnValue');
    expect(netLabel.compareDocumentPosition(taxLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(taxLabel.compareDocumentPosition(totalLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const overview = screen.getByText('returnOverview').closest('.bg-surface-primary') as HTMLElement;
    // Net row keeps net; Tax from finalPrice; Total is a single gross amount with no Gross prefix.
    expect(within(overview).getByText('€100.00')).toBeInTheDocument();
    expect(within(overview).getByText('€19.00')).toBeInTheDocument();
    expect(within(overview).getByText('€119.00')).toBeInTheDocument();
    expect(within(overview).queryByText('gross')).not.toBeInTheDocument();
  });

  it('omits Tax from Return Overview when tax rate is 0%', () => {
    mockUseReturn.mockReturnValue({
      returnItem: {
        ...buildReturn(),
        calculatedPrice: {
          finalPrice: { netValue: 100, grossValue: 100, taxValue: 0, taxRate: 0, currency: 'EUR' },
        },
      },
      loading: false,
      error: null,
      refreshReturn: jest.fn(),
    });

    render(<ReturnDetail returnId="return-123" />);

    const overview = screen.getByText('returnOverview').closest('.bg-surface-primary') as HTMLElement;
    expect(within(overview).queryByText(/tax/)).not.toBeInTheDocument();
    expect(within(overview).getAllByText('€100.00').length).toBe(2);
  });

  it('shows Total return value as "-" when finalPrice.grossValue is missing', () => {
    mockUseReturn.mockReturnValue({
      returnItem: {
        ...buildReturn(),
        calculatedPrice: {
          finalPrice: { netValue: 100, taxValue: 19, currency: 'EUR' },
        },
      },
      loading: false,
      error: null,
      refreshReturn: jest.fn(),
    });

    render(<ReturnDetail returnId="return-123" />);

    const overview = screen.getByText('returnOverview').closest('.bg-surface-primary') as HTMLElement;
    expect(within(overview).getByText('€100.00')).toBeInTheDocument();
    expect(within(overview).queryByText('€119.00')).not.toBeInTheDocument();
    expect(within(overview).queryByText('gross')).not.toBeInTheDocument();

    const totalLabel = within(overview).getByText('totalReturnValue');
    const totalRow = totalLabel.closest('div') as HTMLElement;
    expect(within(totalRow).getByText('-')).toBeInTheDocument();
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

  it('renders return reason and description under item number in the product column, not under unit price', () => {
    render(<ReturnDetail returnId="return-123" />);

    const desktopRow = screen.getByTestId('product-item-desktop-item-123');
    const productMeta = within(desktopRow).getByTestId('product-column-meta-reason-badge-item-123');
    const trailingCell = within(desktopRow).getByTestId('product-trailing-amount-cell-item-123');

    expect(within(productMeta).getByText('claimReasons.CHANGED_MIND')).toBeInTheDocument();
    expect(within(productMeta).getByText('Item reason details.')).toBeInTheDocument();
    expect(within(trailingCell).queryByText('claimReasons.CHANGED_MIND')).not.toBeInTheDocument();
    expect(within(trailingCell).queryByText('Item reason details.')).not.toBeInTheDocument();

    const itemNumber = within(desktopRow).getByText(/blue-solar-55w/);
    expect(itemNumber.compareDocumentPosition(productMeta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('omits unit price on mobile and shows refund net/gross instead (desktop still shows unit price)', () => {
    mockUseReturn.mockReturnValue({
      returnItem: {
        ...buildReturn(),
        orders: [
          {
            id: 'order-123',
            items: [
              {
                id: 'distinct-price-item',
                name: 'Distinct Price Item',
                quantity: 2,
                vendorName: 'Nature Home',
                itemNumber: 'sku-distinct',
                productId: 'distinct-product',
                images: ['https://example.com/distinct.jpg'],
                reason: { code: 'CHANGED_MIND', details: 'Item reason details.' },
                // Unit price column must stay numerically distinct from refund so the
                // mobile omission assertion cannot pass by coincidence.
                calculatedUnitPrice: { netValue: 50, grossValue: 59.5, taxValue: 9.5, currency: 'EUR' },
                calculatedPrice: {
                  finalPrice: { netValue: 100, grossValue: 119, taxValue: 19, currency: 'EUR' },
                },
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

    const mobileRow = screen.getByTestId('product-item-mobile-distinct-price-item');
    const desktopRow = screen.getByTestId('product-item-desktop-distinct-price-item');

    expect(within(mobileRow).queryByText('€50.00')).not.toBeInTheDocument();
    expect(within(mobileRow).getByText('€100.00')).toBeInTheDocument();
    expect(within(mobileRow).getByText('gross €119.00')).toBeInTheDocument();

    expect(within(desktopRow).getByText('€50.00')).toBeInTheDocument();
    expect(within(desktopRow).getAllByText('€100.00').length).toBeGreaterThanOrEqual(1);
  });

  it('does not render a separate Returned products heading but keeps H6 column headers', () => {
    render(<ReturnDetail returnId="return-123" />);

    expect(screen.queryByText('returnedProducts')).not.toBeInTheDocument();

    const productHeader = screen.getByRole('heading', { level: 6, name: 'product', hidden: true });
    const header = productHeader.closest('.pb-4') as HTMLElement;
    expect(productHeader.tagName).toBe('H6');
    expect(within(header).getByRole('heading', { level: 6, name: 'price', hidden: true }).tagName).toBe('H6');
    expect(within(header).getByRole('heading', { level: 6, name: 'quantity', hidden: true }).tagName).toBe('H6');
    expect(within(header).getByRole('heading', { level: 6, name: 'refundAmount', hidden: true }).tagName).toBe('H6');
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
    // Refund amount remains; core unit-price block is omitted via omitMobileUnitPrice.
    expect(within(mobileRow).getByText('€100.00')).toBeInTheDocument();
    expect(within(mobileRow).getByText('gross €119.00')).toBeInTheDocument();
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

  it('keeps Refund Amount contained in the product-list card at sm+ (incl. narrow sidebar main) without horizontal scroll', () => {
    render(<ReturnDetail returnId="return-123" />);

    const card = screen.getByTestId('product-list-card');
    const content = screen.getByTestId('product-list-content');
    const desktopRow = screen.getByTestId('product-item-desktop-item-123');
    const trailingCell = screen.getByTestId('product-trailing-amount-cell-item-123');

    expect(card).toHaveClass('min-w-0', 'max-w-full', 'overflow-hidden', 'shadow-sm');
    expect(content).toHaveClass('min-w-0');
    expect(content).not.toHaveClass('overflow-x-auto');
    expect(desktopRow.className).toMatch(/minmax\(0,1\.6fr\)_3\.5rem_minmax\(0,1fr\)_minmax\(0,1fr\)/);
    expect(desktopRow.className).toContain('sm:grid');
    expect(trailingCell).toHaveClass('min-w-0', 'text-right');
    expect(within(trailingCell).getByText('€100.00')).toBeInTheDocument();
  });
});
