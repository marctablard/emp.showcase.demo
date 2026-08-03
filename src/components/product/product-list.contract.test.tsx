/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { formatCurrency } from '@/lib/utils';
import { ProductList } from './product-list';
import type { ProductListItem, ProductListPresentationConfig } from './product-list';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} {...props} />,
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const contractItem: ProductListItem = {
  id: 'contract-item',
  name: 'Contract Product',
  brand: 'Contract Brand',
  itemNumber: 'C-001',
  quantity: 4,
  unitPrice: 123.45,
  currency: 'EUR',
  netUnitPrice: 120,
  grossUnitPrice: 129.95,
  imageUrl: 'https://example.com/contract-product.png',
  href: '/product/contract-item',
};

function byNormalizedText(expected: string) {
  return (_content: string, node: Element | null) => {
    const normalized = (node?.textContent ?? '').replaceAll(/\s+/g, ' ').trim();
    return normalized === expected;
  };
}

describe('ProductList contract', () => {
  it('uses the canonical core order of Product, Quantity, and Unit Price on desktop', () => {
    render(<ProductList items={[contractItem]} />);

    const headings = screen.getAllByRole('heading', { level: 6 }).map((heading) => heading.textContent);

    expect(headings).toEqual(['product', 'quantity', 'unitPrice']);
  });

  it('renders a gross secondary line when configured and uses a literal "-" when gross is absent', () => {
    const missingGrossItem: ProductListItem = {
      ...contractItem,
      id: 'missing-gross-item',
      grossUnitPrice: undefined,
    };

    const { rerender } = render(
      <ProductList items={[contractItem]} presentationConfig={{ showGrossSecondary: true }} />,
    );
    const desktopRow = screen.getByTestId(`product-item-desktop-${contractItem.id}`);
    const mobileRow = screen.getByTestId(`product-item-mobile-${contractItem.id}`);

    expect(
      within(desktopRow).getByText(
        byNormalizedText(`gross: ${formatCurrency(contractItem.grossUnitPrice!, contractItem.currency)}`),
      ),
    ).toBeInTheDocument();
    expect(
      within(mobileRow).getByText(
        byNormalizedText(`gross: ${formatCurrency(contractItem.grossUnitPrice!, contractItem.currency)}`),
      ),
    ).toBeInTheDocument();

    rerender(<ProductList items={[missingGrossItem]} presentationConfig={{ showGrossSecondary: true }} />);

    const missingGrossDesktopRow = screen.getByTestId(`product-item-desktop-${missingGrossItem.id}`);
    const missingGrossMobileRow = screen.getByTestId(`product-item-mobile-${missingGrossItem.id}`);

    expect(within(missingGrossDesktopRow).getByText(byNormalizedText('gross: -'))).toBeInTheDocument();
    expect(within(missingGrossMobileRow).getByText(byNormalizedText('gross: -'))).toBeInTheDocument();
  });

  it('renders the empty-image state without an image element while keeping the product content', () => {
    const emptyImageItem: ProductListItem = {
      ...contractItem,
      id: 'empty-image-item',
      imageUrl: null,
    };

    render(<ProductList items={[emptyImageItem]} />);

    const desktopRow = screen.getByTestId(`product-item-desktop-${emptyImageItem.id}`);

    expect(within(desktopRow).queryByRole('img')).not.toBeInTheDocument();
    expect(within(desktopRow).getByText(emptyImageItem.name)).toBeInTheDocument();
  });

  it('renders a trailing desktop amount slot with its explicitly configured, localized label when configured', () => {
    const presentationConfig: ProductListPresentationConfig = {
      labels: { amount: 'Erstattungsbetrag' },
      showTrailingDesktopAmount: true,
      trailingDesktopAmount: (item) => (
        <div data-testid={`desktop-amount-${item.id}`}>{formatCurrency(item.unitPrice, item.currency, 'de-DE')}</div>
      ),
    };

    render(<ProductList items={[contractItem]} locale="de-DE" presentationConfig={presentationConfig} />);

    const desktopAmountSlot = screen.getByTestId(`desktop-amount-${contractItem.id}`);
    expect(desktopAmountSlot).toBeInTheDocument();
    expect(
      within(desktopAmountSlot).getByText(
        (_, node) => node?.textContent === formatCurrency(contractItem.unitPrice, contractItem.currency, 'de-DE'),
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 6, name: 'Erstattungsbetrag' })).toBeInTheDocument();
  });

  it('renders no trailing amount column or heading when the trailing amount is not configured', () => {
    render(<ProductList items={[contractItem]} />);

    const headings = screen.getAllByRole('heading', { level: 6 }).map((heading) => heading.textContent);

    expect(headings).toEqual(['product', 'quantity', 'unitPrice']);
    expect(screen.queryByTestId(`desktop-amount-${contractItem.id}`)).not.toBeInTheDocument();
  });

  it('keeps mobile and inline metadata slots in the configured order', () => {
    const presentationConfig: ProductListPresentationConfig = {
      mobileMetadataSlots: [
        { key: 'mobile-meta-1', render: (item) => <div key="mobile-meta-1">Mobile meta 1 {item.itemNumber}</div> },
        { key: 'mobile-meta-2', render: (item) => <div key="mobile-meta-2">Mobile meta 2 {item.quantity}</div> },
      ],
      inlineMetadataSlots: [
        { key: 'inline-meta-1', render: (item) => <div key="inline-meta-1">Inline meta 1 {item.itemNumber}</div> },
        { key: 'inline-meta-2', render: (item) => <div key="inline-meta-2">Inline meta 2 {item.quantity}</div> },
      ],
    };

    render(<ProductList items={[contractItem]} presentationConfig={presentationConfig} />);

    const mobileRow = screen.getByTestId(`product-item-mobile-${contractItem.id}`);
    const desktopRow = screen.getByTestId(`product-item-desktop-${contractItem.id}`);

    const firstMobileMeta = within(mobileRow).getByText(`Mobile meta 1 ${contractItem.itemNumber}`);
    const secondMobileMeta = within(mobileRow).getByText(`Mobile meta 2 ${contractItem.quantity}`);
    expect(
      firstMobileMeta.compareDocumentPosition(secondMobileMeta as Element) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const firstInlineMeta = within(desktopRow).getByText(`Inline meta 1 ${contractItem.itemNumber}`);
    const secondInlineMeta = within(desktopRow).getByText(`Inline meta 2 ${contractItem.quantity}`);
    expect(
      firstInlineMeta.compareDocumentPosition(secondInlineMeta as Element) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('does not derive additional monetary values when only the base unit price is supplied', () => {
    const derivedMoneyItem: ProductListItem = {
      ...contractItem,
      id: 'derived-money-item',
      netUnitPrice: undefined,
      grossUnitPrice: undefined,
    };

    render(<ProductList items={[derivedMoneyItem]} presentationConfig={{ showGrossSecondary: true }} />);

    const desktopRow = screen.getByTestId(`product-item-desktop-${derivedMoneyItem.id}`);
    const mobileRow = screen.getByTestId(`product-item-mobile-${derivedMoneyItem.id}`);

    expect(within(desktopRow).getByText(byNormalizedText('gross: -'))).toBeInTheDocument();
    expect(within(mobileRow).getByText(byNormalizedText('gross: -'))).toBeInTheDocument();
    expect(within(desktopRow).queryByText(/gross: €|gross: EUR/i)).not.toBeInTheDocument();
  });
});
