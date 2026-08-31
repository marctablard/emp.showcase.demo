/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { PRODUCT_NO_IMAGE_SRC } from '@/lib/common/product-image';
import { formatCurrency } from '@/lib/utils';
import { ProductList } from './product-list';
import type { ProductListItem, ProductListPresentationConfig } from './product-list';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'de-DE',
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
  const normalize = (value: string) => value.replaceAll(/\s+/g, ' ').trim();
  const normalizedExpected = normalize(expected);
  return (_content: string, node: Element | null) => normalize(node?.textContent ?? '') === normalizedExpected;
}

describe('ProductList contract', () => {
  it('uses the canonical core order of Product, Quantity, and Unit Price on desktop', () => {
    render(<ProductList items={[contractItem]} />);

    const header = screen.getByTestId('product-list-content').querySelector('.border-b');
    expect(header).toBeTruthy();
    const headings = within(header as HTMLElement)
      .getAllByRole('heading', { level: 6 })
      .map((heading) => heading.textContent);

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
        byNormalizedText(`gross ${formatCurrency(contractItem.grossUnitPrice!, contractItem.currency)}`),
      ),
    ).toBeInTheDocument();
    expect(
      within(mobileRow).getByText(
        byNormalizedText(`gross ${formatCurrency(contractItem.grossUnitPrice!, contractItem.currency)}`),
      ),
    ).toBeInTheDocument();

    rerender(<ProductList items={[missingGrossItem]} presentationConfig={{ showGrossSecondary: true }} />);

    const missingGrossDesktopRow = screen.getByTestId(`product-item-desktop-${missingGrossItem.id}`);
    const missingGrossMobileRow = screen.getByTestId(`product-item-mobile-${missingGrossItem.id}`);

    expect(within(missingGrossDesktopRow).getByText(byNormalizedText('gross -'))).toBeInTheDocument();
    expect(within(missingGrossMobileRow).getByText(byNormalizedText('gross -'))).toBeInTheDocument();
  });

  it('renders the empty-image state with no_image_alt while keeping the product content', () => {
    const emptyImageItem: ProductListItem = {
      ...contractItem,
      id: 'empty-image-item',
      imageUrl: null,
    };

    render(<ProductList items={[emptyImageItem]} />);

    const desktopRow = screen.getByTestId(`product-item-desktop-${emptyImageItem.id}`);
    const image = within(desktopRow).getByRole('img');

    expect(image).toHaveAttribute('src', PRODUCT_NO_IMAGE_SRC);
    expect(image).toHaveAttribute('src', '/images/no_image_alt.png');
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

    const header = screen.getByTestId('product-list-content').querySelector('.border-b');
    expect(header).toBeTruthy();
    const headings = within(header as HTMLElement)
      .getAllByRole('heading', { level: 6 })
      .map((heading) => heading.textContent);

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

    expect(within(desktopRow).getByText(byNormalizedText('gross -'))).toBeInTheDocument();
    expect(within(mobileRow).getByText(byNormalizedText('gross -'))).toBeInTheDocument();
    expect(within(desktopRow).queryByText(/gross €|gross EUR/i)).not.toBeInTheDocument();
  });

  it('omits mobile unit price only when omitMobileUnitPrice is set, keeping Quote/Approval mobile unit price by default', () => {
    const unitPriceLabel = formatCurrency(contractItem.netUnitPrice!, contractItem.currency, 'de-DE');
    const refundLabel = formatCurrency(999, contractItem.currency, 'de-DE');

    const { rerender } = render(
      <ProductList items={[contractItem]} locale="de-DE" presentationConfig={{ showGrossSecondary: true }} />,
    );

    expect(
      within(screen.getByTestId(`product-item-mobile-${contractItem.id}`)).getByText(byNormalizedText(unitPriceLabel)),
    ).toBeInTheDocument();

    const presentationConfig: ProductListPresentationConfig = {
      showGrossSecondary: true,
      omitMobileUnitPrice: true,
      showTrailingDesktopAmount: true,
      trailingDesktopAmount: (item) => <div data-testid={`refund-${item.id}`}>{refundLabel}</div>,
    };

    rerender(<ProductList items={[contractItem]} locale="de-DE" presentationConfig={presentationConfig} />);

    const mobileRow = screen.getByTestId(`product-item-mobile-${contractItem.id}`);
    const desktopRow = screen.getByTestId(`product-item-desktop-${contractItem.id}`);

    expect(within(mobileRow).queryByText(byNormalizedText(unitPriceLabel))).not.toBeInTheDocument();
    const refundNode = within(mobileRow).getByTestId(`refund-${contractItem.id}`);
    expect(refundNode.textContent?.replaceAll(/\s+/g, ' ').trim()).toBe(refundLabel.replaceAll(/\s+/g, ' ').trim());
    expect(within(desktopRow).getByText(byNormalizedText(unitPriceLabel))).toBeInTheDocument();
  });

  it('contains the four-column trailing-amount grid inside an overflow-safe card for ~1024–1150px layouts without horizontal scroll', () => {
    const presentationConfig: ProductListPresentationConfig = {
      labels: { amount: 'Refund Amount' },
      showTrailingDesktopAmount: true,
      trailingDesktopAmount: (item) => (
        <div data-testid={`desktop-amount-${item.id}`}>{formatCurrency(item.unitPrice, item.currency)}</div>
      ),
    };

    render(<ProductList items={[contractItem]} presentationConfig={presentationConfig} />);

    const card = screen.getByTestId('product-list-card');
    const content = screen.getByTestId('product-list-content');
    const desktopRow = screen.getByTestId(`product-item-desktop-${contractItem.id}`);
    const mobileRow = screen.getByTestId(`product-item-mobile-${contractItem.id}`);
    const trailingCell = screen.getByTestId(`product-trailing-amount-cell-${contractItem.id}`);

    expect(card).toHaveClass('min-w-0', 'max-w-full', 'overflow-hidden', 'shadow-sm', 'py-0', 'gap-0');
    expect(content).toHaveClass('min-w-0', 'p-4', 'sm:p-6');
    expect(content).not.toHaveClass('overflow-x-auto');
    expect(desktopRow.className).toContain('hidden');
    expect(desktopRow.className).toContain('sm:grid');
    expect(desktopRow.className).toContain('minmax(0,4fr)');
    expect(desktopRow.className).toContain('3rem');
    expect(desktopRow.className).toContain('minmax(0,1fr)_minmax(0,1.1fr)');
    expect(desktopRow.className).not.toContain('minmax(280px');
    expect(desktopRow.className).not.toContain('minmax(140px');
    expect(mobileRow).toHaveClass('sm:hidden');
    expect(trailingCell).toHaveClass('min-w-0');
    expect(screen.getByRole('heading', { level: 6, name: 'Refund Amount' }).parentElement).toHaveClass('min-w-0');
  });

  it('uses shrink-fit three-column Quote/Approval tracks at sm+ without large min widths', () => {
    render(<ProductList items={[contractItem]} />);

    const desktopRow = screen.getByTestId(`product-item-desktop-${contractItem.id}`);
    const card = screen.getByTestId('product-list-card');
    const content = screen.getByTestId('product-list-content');
    const itemRow = screen.getByTestId(`product-item-row-${contractItem.id}`);

    expect(desktopRow.className).toContain('sm:grid');
    expect(desktopRow.className).toContain('minmax(0,4fr)');
    expect(desktopRow.className).toContain('3rem');
    expect(desktopRow.className).toContain('minmax(0,1.2fr)');
    expect(desktopRow.className).not.toContain('minmax(280px');
    expect(desktopRow.className).not.toContain('minmax(140px');
    expect(card).toHaveClass('overflow-hidden');
    expect(content).toHaveClass('p-4', 'sm:p-6');
    expect(content).not.toHaveClass('overflow-x-auto');
    expect(itemRow).toHaveClass('py-4', 'first:pt-0', 'sm:py-6', 'sm:first:pt-4');
    expect(screen.queryByTestId(`product-trailing-amount-cell-${contractItem.id}`)).not.toBeInTheDocument();
  });
});
