/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { ProductList } from './product-list';
import type { ProductListItem } from './product-list';

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

describe('ProductList', () => {
  it('renders desktop headers as H6 with a left-aligned Quantity column and a right-aligned price column', () => {
    render(<ProductList items={[quoteStyleItem]} />);

    const quantityHeading = screen.getByRole('heading', { level: 6, name: 'quantity' });
    const priceHeading = screen.getByRole('heading', { level: 6, name: 'unitPrice' });

    expect(quantityHeading.tagName).toBe('H6');
    expect(quantityHeading.className).toContain('text-left');
    expect(quantityHeading.className).not.toContain('text-right');
    expect(priceHeading.className).toContain('text-right');
  });

  it('renders Quote-style items net-first with gross as the secondary value on desktop and mobile', () => {
    render(<ProductList items={[quoteStyleItem]} showGrossUnderNet />);

    const desktopRow = screen.getByTestId(`product-item-desktop-${quoteStyleItem.id}`);
    expect(within(desktopRow).getByText('€330.00')).toBeInTheDocument();
    expect(within(desktopRow).getByText('gross: €334.99')).toBeInTheDocument();

    const mobileRow = screen.getByTestId(`product-item-mobile-${quoteStyleItem.id}`);
    expect(within(mobileRow).getByText('€330.00')).toBeInTheDocument();
    expect(within(mobileRow).getByText('gross: €334.99')).toBeInTheDocument();
  });

  it('renders a literal "-" secondary value for Approval-style items with no gross price, never deriving one', () => {
    render(<ProductList items={[approvalStyleItemMissingGross]} showGrossUnderNet />);

    const desktopRow = screen.getByTestId(`product-item-desktop-${approvalStyleItemMissingGross.id}`);
    expect(within(desktopRow).getByText('€10.00')).toBeInTheDocument();
    expect(within(desktopRow).getByText('gross: -')).toBeInTheDocument();

    const mobileRow = screen.getByTestId(`product-item-mobile-${approvalStyleItemMissingGross.id}`);
    expect(within(mobileRow).getByText('gross: -')).toBeInTheDocument();
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
});
