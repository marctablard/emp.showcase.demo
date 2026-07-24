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

  it('renders the Return Details strip before the full-width overview and returned products', () => {
    const { container } = render(<ReturnDetail returnId="return-123" />);

    const returnDetails = screen.getByText('returnDetails');
    const overview = screen.getByText('returnOverview');
    const products = screen.getByText('returnedProducts');
    expect(returnDetails.compareDocumentPosition(overview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(overview.compareDocumentPosition(products) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

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
