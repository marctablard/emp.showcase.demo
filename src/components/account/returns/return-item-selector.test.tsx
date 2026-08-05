/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import type { OrderItem } from '@/platform/services/model/order/order';
import { ReturnItemSelector } from './return-item-selector';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

jest.mock('@/lib/utils', () => {
  const actual = jest.requireActual('@/lib/utils');
  return {
    ...actual,
    formatCurrency: (value: number, currency: string) => `${currency} ${value.toFixed(2)}`,
  };
});

const baseItem: OrderItem = {
  id: 'item-1',
  productId: 'prod-1',
  quantity: 3,
  name: 'Solar Panel',
  sku: 'SKU-SOLAR-55',
  vendorName: 'Nature Home',
  price: {
    value: 40,
    netValue: 40,
    grossValue: 47.6,
    currency: 'EUR',
  },
};

const defaultProps = {
  items: [baseItem],
  quantities: { 'item-1': 0 },
  onUpdateQuantity: jest.fn(),
  loading: false,
  reasonMode: 'single' as const,
  itemReasons: {},
  onItemReasonChange: jest.fn(),
  itemReasonDetails: {},
  onItemReasonDetailsChange: jest.fn(),
  reasonOptions: [],
};

describe('ReturnItemSelector', () => {
  it('renders desktop column headers as H6 like ProductList (Order Details)', () => {
    render(<ReturnItemSelector {...defaultProps} />);

    expect(screen.getByRole('heading', { level: 6, name: 'productDetails' })).toHaveClass(
      'text-sm',
      'font-bold',
      'text-text-headings',
    );
    expect(screen.getByRole('heading', { level: 6, name: 'quantity' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 6, name: 'unitPrice' })).toHaveClass('text-right');
  });

  it('shows vendorName (Brand) above the product name on desktop and mobile, not bare SKU', () => {
    render(<ReturnItemSelector {...defaultProps} />);

    const desktop = screen.getByTestId('return-item-product-desktop-item-1');
    const mobile = screen.getByTestId('return-item-product-mobile-item-1');

    const desktopBrand = within(desktop).getByText('Nature Home');
    const mobileBrand = within(mobile).getByText('Nature Home');
    expect(desktopBrand).toHaveClass('text-base', 'font-body', 'text-text-body');
    expect(mobileBrand).toHaveClass('text-sm', 'font-body', 'text-text-body');

    const desktopName = within(desktop).getByText('Solar Panel');
    const mobileName = within(mobile).getByText('Solar Panel');
    expect(desktopBrand.compareDocumentPosition(desktopName) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mobileBrand.compareDocumentPosition(mobileName) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Bare SKU must not appear as a standalone line above the name (only in prefixed item-number lines).
    expect(within(desktop).queryByText('SKU-SOLAR-55')).not.toBeInTheDocument();
    expect(within(mobile).queryByText('SKU-SOLAR-55')).not.toBeInTheDocument();
  });

  it('keeps the prefixed item-number line with SKU below the product name', () => {
    render(<ReturnItemSelector {...defaultProps} />);

    const itemNumberLines = screen.getAllByText('itemNumber: SKU-SOLAR-55');
    expect(itemNumberLines.length).toBeGreaterThanOrEqual(2);

    const desktop = screen.getByTestId('return-item-product-desktop-item-1');
    const desktopName = within(desktop).getByText('Solar Panel');
    const desktopItemNumber = within(desktop).getByText('itemNumber: SKU-SOLAR-55');
    expect(desktopName.compareDocumentPosition(desktopItemNumber) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('omits Brand when vendorName is absent and still does not show bare SKU above the name', () => {
    const itemWithoutBrand: OrderItem = { ...baseItem, vendorName: undefined };

    render(<ReturnItemSelector {...defaultProps} items={[itemWithoutBrand]} />);

    const desktop = screen.getByTestId('return-item-product-desktop-item-1');
    const mobile = screen.getByTestId('return-item-product-mobile-item-1');

    expect(within(desktop).queryByText('Nature Home')).not.toBeInTheDocument();
    expect(within(mobile).queryByText('Nature Home')).not.toBeInTheDocument();
    expect(within(desktop).queryByText('SKU-SOLAR-55')).not.toBeInTheDocument();
    expect(within(mobile).queryByText('SKU-SOLAR-55')).not.toBeInTheDocument();

    expect(screen.getAllByText('itemNumber: SKU-SOLAR-55').length).toBeGreaterThanOrEqual(2);
  });
});
