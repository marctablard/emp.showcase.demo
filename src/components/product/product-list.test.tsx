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

const quoteStyleItem: ProductListItem = {
  id: 'product-1',
  name: 'GREE GMV-224-WMH-X',
  brand: 'Serie GMV 6',
  itemNumber: '12345678',
  quantity: 2,
  unitPrice: 335,
  currency: 'EUR',
  netUnitPrice: 330,
  grossUnitPrice: 334.99,
  imageUrl: 'https://example.com/product-1.png',
  href: '/product/product-1',
};

const approvalStyleItemMissingGross: ProductListItem = {
  id: 'product-2',
  name: 'Stainless Steel Bolt',
  brand: 'Allen Key Type',
  itemNumber: '87654321',
  quantity: 3,
  unitPrice: 10,
  currency: 'EUR',
  netUnitPrice: 10,
  grossUnitPrice: undefined,
  imageUrl: null,
};

function normalizeText(value: string): string {
  return value
    .replaceAll(/[\u00A0\u202F]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function byNormalizedText(expected: string) {
  return (_content: string, node: Element | null) => normalizeText(node?.textContent ?? '') === normalizeText(expected);
}

describe('ProductList', () => {
  it('renders column headers as Mobile H5 below desktop and Desktop H6 on desktop, with left Quantity and right price alignment', () => {
    render(<ProductList items={[quoteStyleItem]} />);

    const quantityHeadingTablet = screen.getByRole('heading', { level: 5, name: 'quantity' });
    const quantityHeadingDesktop = screen.getByRole('heading', { level: 6, name: 'quantity', hidden: true });
    const priceHeadingTablet = screen.getByRole('heading', { level: 5, name: 'unitPrice' });
    const priceHeadingDesktop = screen.getByRole('heading', { level: 6, name: 'unitPrice', hidden: true });

    expect(quantityHeadingTablet.tagName).toBe('H5');
    expect(quantityHeadingTablet).toHaveClass('md:hidden');
    expect(quantityHeadingDesktop.tagName).toBe('H6');
    expect(quantityHeadingDesktop).toHaveClass('hidden', 'md:block');
    expect(quantityHeadingTablet.parentElement).toHaveClass('text-left');
    expect(quantityHeadingTablet.parentElement).not.toHaveClass('text-right');
    expect(priceHeadingTablet.parentElement).toHaveClass('text-right');
    expect(priceHeadingDesktop.parentElement).toHaveClass('text-right');
  });

  it('renders Quote-style items net-first with gross as the secondary value on desktop and mobile', () => {
    render(<ProductList items={[quoteStyleItem]} showGrossUnderNet />);

    const netPriceLabel = formatCurrency(
      quoteStyleItem.netUnitPrice ?? quoteStyleItem.unitPrice,
      quoteStyleItem.currency,
    );
    const grossPriceLabel =
      quoteStyleItem.grossUnitPrice === undefined
        ? '-'
        : formatCurrency(quoteStyleItem.grossUnitPrice, quoteStyleItem.currency);

    const desktopRow = screen.getByTestId(`product-item-desktop-${quoteStyleItem.id}`);
    expect(within(desktopRow).getByText(byNormalizedText(netPriceLabel))).toBeInTheDocument();
    expect(within(desktopRow).getByText(byNormalizedText(`gross: ${grossPriceLabel}`))).toBeInTheDocument();

    const mobileRow = screen.getByTestId(`product-item-mobile-${quoteStyleItem.id}`);
    expect(within(mobileRow).getByText(byNormalizedText(netPriceLabel))).toBeInTheDocument();
    expect(within(mobileRow).getByText(byNormalizedText(`gross: ${grossPriceLabel}`))).toBeInTheDocument();
  });

  it('renders a literal "-" secondary value for Approval-style items with no gross price, never deriving one', () => {
    render(<ProductList items={[approvalStyleItemMissingGross]} showGrossUnderNet />);

    const netPriceLabel = formatCurrency(
      approvalStyleItemMissingGross.netUnitPrice ?? approvalStyleItemMissingGross.unitPrice,
      approvalStyleItemMissingGross.currency,
    );

    const desktopRow = screen.getByTestId(`product-item-desktop-${approvalStyleItemMissingGross.id}`);
    expect(within(desktopRow).getByText(byNormalizedText(netPriceLabel))).toBeInTheDocument();
    expect(within(desktopRow).getByText(byNormalizedText('gross: -'))).toBeInTheDocument();

    const mobileRow = screen.getByTestId(`product-item-mobile-${approvalStyleItemMissingGross.id}`);
    expect(within(mobileRow).getByText(byNormalizedText('gross: -'))).toBeInTheDocument();
  });

  it('does not render a secondary price line when showGrossUnderNet is false', () => {
    render(<ProductList items={[quoteStyleItem]} />);

    expect(screen.queryByText(/gross:/i)).not.toBeInTheDocument();
  });

  it('places brand/name above the thumbnail on smallest-mobile, hides the Quantity label, and keeps item number and quantity in the value stack', () => {
    render(<ProductList items={[quoteStyleItem]} showGrossUnderNet />);

    const mobileRow = screen.getByTestId(`product-item-mobile-${quoteStyleItem.id}`);
    const mobileScope = within(mobileRow);

    expect(mobileScope.getByText(quoteStyleItem.brand as string)).toBeInTheDocument();
    expect(mobileScope.getByText(quoteStyleItem.name)).toBeInTheDocument();
    expect(mobileScope.getByText(`itemNumber: ${quoteStyleItem.itemNumber}`)).toBeInTheDocument();
    expect(mobileScope.getByText(String(quoteStyleItem.quantity))).toBeInTheDocument();
    expect(mobileScope.queryByText(/^quantity$/i)).not.toBeInTheDocument();

    // Brand/name precede the thumbnail image in DOM order (rendered above it on smallest-mobile).
    const brandNode = mobileScope.getByText(quoteStyleItem.brand as string);
    const image = mobileRow.querySelector('img');
    expect(image).not.toBeNull();
    // eslint-disable-next-line no-bitwise
    expect(brandNode.compareDocumentPosition(image as Element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the desktop layout with quantity and item number retained alongside the product details', () => {
    render(<ProductList items={[quoteStyleItem]} showGrossUnderNet />);

    const desktopRow = screen.getByTestId(`product-item-desktop-${quoteStyleItem.id}`);
    const desktopScope = within(desktopRow);

    expect(desktopScope.getByText(quoteStyleItem.brand as string)).toBeInTheDocument();
    expect(desktopScope.getByText(quoteStyleItem.name)).toBeInTheDocument();
    expect(desktopScope.getByText(`itemNumber: ${quoteStyleItem.itemNumber}`)).toBeInTheDocument();
    expect(desktopScope.getByText(String(quoteStyleItem.quantity))).toBeInTheDocument();
  });

  it('uses explicit headers, locale formatting, and ordered extension slots for desktop/mobile metadata', () => {
    const presentationConfig: ProductListPresentationConfig = {
      labels: { product: 'Product', quantity: 'Quantity', unitPrice: 'Unit Price', amount: 'Amount' },
      showGrossSecondary: true,
      showTrailingDesktopAmount: true,
      trailingDesktopAmount: (item) => (
        <div data-testid={`desktop-amount-${item.id}`}>{formatCurrency(item.unitPrice, item.currency, 'de-DE')}</div>
      ),
      mobileMetadataSlots: [
        { key: 'mobile-meta-1', render: (item) => <div key="mobile-meta-1">Mobile meta {item.itemNumber}</div> },
      ],
      inlineMetadataSlots: [
        { key: 'inline-meta-1', render: (item) => <div key="inline-meta-1">Inline meta {item.itemNumber}</div> },
        { key: 'inline-meta-2', render: (item) => <div key="inline-meta-2">Inline meta 2 {item.quantity}</div> },
      ],
    };

    render(<ProductList items={[quoteStyleItem]} locale="de-DE" presentationConfig={presentationConfig} />);

    expect(screen.getByRole('heading', { level: 5, name: 'Product' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 5, name: 'Quantity' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 5, name: 'Unit Price' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 5, name: 'Amount' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 6, name: 'Product', hidden: true })).toHaveClass('hidden', 'md:block');
    expect(screen.getByRole('heading', { level: 6, name: 'Quantity', hidden: true })).toHaveClass('hidden', 'md:block');
    expect(screen.getByRole('heading', { level: 6, name: 'Unit Price', hidden: true })).toHaveClass(
      'hidden',
      'md:block',
    );
    expect(screen.getByRole('heading', { level: 6, name: 'Amount', hidden: true })).toHaveClass('hidden', 'md:block');

    const desktopRow = screen.getByTestId(`product-item-desktop-${quoteStyleItem.id}`);
    const desktopScope = within(desktopRow);
    expect(desktopScope.getByTestId(`desktop-amount-${quoteStyleItem.id}`)).toBeInTheDocument();
    expect(desktopScope.getByText(`Inline meta ${quoteStyleItem.itemNumber}`)).toBeInTheDocument();
    expect(desktopScope.getByText(`Inline meta 2 ${quoteStyleItem.quantity}`)).toBeInTheDocument();

    const mobileRow = screen.getByTestId(`product-item-mobile-${quoteStyleItem.id}`);
    const mobileScope = within(mobileRow);
    expect(mobileScope.getByText(`Mobile meta ${quoteStyleItem.itemNumber}`)).toBeInTheDocument();

    const inlineMeta = desktopScope.getByText(`Inline meta ${quoteStyleItem.itemNumber}`);
    const secondInlineMeta = desktopScope.getByText(`Inline meta 2 ${quoteStyleItem.quantity}`);
    expect(
      inlineMeta.compareDocumentPosition(secondInlineMeta as Element) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('inserts Base Net Unit Price and Discount columns between Quantity and Unit Price when enabled', () => {
    const discountedItem: ProductListItem = {
      ...quoteStyleItem,
      baseNetUnitPrice: 500,
      discountPercent: 35,
      netUnitPrice: 325,
    };

    render(
      <ProductList
        items={[discountedItem]}
        locale="de-DE"
        presentationConfig={{
          labels: {
            product: 'Product',
            quantity: 'Quantity',
            unitPrice: 'Unit Price',
            baseNetUnitPrice: 'Base Net Unit Price',
            discount: 'Discount',
          },
          showDiscountColumns: true,
          showGrossSecondary: true,
        }}
      />,
    );

    expect(screen.getByRole('heading', { level: 5, name: 'Base Net Unit Price' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 5, name: 'Discount' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 6, name: 'Base Net Unit Price', hidden: true })).toHaveClass(
      'hidden',
      'md:block',
    );
    expect(screen.getByRole('heading', { level: 6, name: 'Discount', hidden: true })).toHaveClass('hidden', 'md:block');
    expect(screen.getByTestId(`product-base-net-cell-${discountedItem.id}`)).toHaveTextContent(/500,00/);
    expect(screen.getByTestId(`product-discount-cell-${discountedItem.id}`)).toHaveTextContent('35%');
  });
});
