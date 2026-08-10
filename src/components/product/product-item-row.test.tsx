/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { formatCurrency } from '@/lib/utils';
import { ProductItemRow } from './product-item-row';
import type { ProductListItem } from './product-list';

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
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

const item: ProductListItem = {
  id: 'product-1',
  name: 'Sample product',
  brand: 'Serie GMV 6',
  itemNumber: '12345678',
  quantity: 2,
  unitPrice: 100,
  currency: 'EUR',
  netUnitPrice: 100,
  grossUnitPrice: 119,
};

function byNormalizedText(expected: string) {
  const normalize = (value: string) => value.replaceAll(/\s+/g, ' ').trim();
  const normalizedExpected = normalize(expected);
  return (_content: string, node: Element | null) => normalize(node?.textContent ?? '') === normalizedExpected;
}

describe('ProductItemRow translation namespaces', () => {
  it('reads itemNumber from the orders namespace and gross from the cart namespace', () => {
    render(<ProductItemRow item={item} showGrossUnderNet />);

    expect(screen.getAllByText(`orders.itemNumber: ${item.itemNumber}`).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/cart\.gross:/).length).toBeGreaterThan(0);
  });

  it('formats money with the supplied active locale', () => {
    render(<ProductItemRow item={item} locale="de-DE" />);

    expect(
      screen.getAllByText((_, node) => node?.textContent === formatCurrency(item.unitPrice, item.currency, 'de-DE'))
        .length,
    ).toBeGreaterThan(0);
  });
});

describe('ProductItemRow brand typography', () => {
  it('uses text-sm (body/sm) for brand on mobile and desktop table rows', () => {
    render(<ProductItemRow item={item} />);

    const mobileBrand = screen.getByTestId(`product-item-mobile-${item.id}`).querySelector('p');
    const desktopBrand = screen.getByTestId(`product-item-desktop-${item.id}`).querySelector('p');

    expect(mobileBrand).toHaveTextContent(item.brand as string);
    expect(mobileBrand).toHaveClass('text-sm', 'font-body', 'text-text-body');
    expect(mobileBrand).not.toHaveClass('text-base');

    expect(desktopBrand).toHaveTextContent(item.brand as string);
    expect(desktopBrand).toHaveClass('text-sm', 'font-body', 'text-text-body');
    expect(desktopBrand).not.toHaveClass('text-base');
  });
});

describe('ProductItemRow product name typography', () => {
  it('uses semantic H5 (text-3xl) on mobile and H6 (text-2xl) on desktop', () => {
    render(<ProductItemRow item={item} />);

    const mobileName = screen.getByTestId(`product-name-mobile-${item.id}`);
    const desktopName = screen.getByTestId(`product-name-desktop-${item.id}`);

    expect(mobileName.tagName).toBe('H5');
    expect(mobileName).toHaveTextContent(item.name);
    expect(mobileName).toHaveClass('text-3xl', 'font-bold', 'font-headlines', 'text-text-headings');
    expect(mobileName).not.toHaveClass('text-2xl');

    expect(desktopName.tagName).toBe('H6');
    expect(desktopName).toHaveTextContent(item.name);
    expect(desktopName).toHaveClass('text-2xl', 'font-bold', 'font-headlines', 'text-text-headings');
    expect(desktopName).not.toHaveClass('text-3xl');
  });

  it('keeps H5 mobile / H6 desktop headings when the name is a product link', () => {
    render(<ProductItemRow item={{ ...item, href: '/p/sample-product' }} />);

    const mobileName = screen.getByTestId(`product-name-mobile-${item.id}`);
    const desktopName = screen.getByTestId(`product-name-desktop-${item.id}`);

    expect(mobileName.tagName).toBe('H5');
    expect(desktopName.tagName).toBe('H6');
    expect(within(mobileName).getByRole('link', { name: item.name })).toHaveAttribute('href', '/p/sample-product');
    expect(within(desktopName).getByRole('link', { name: item.name })).toHaveAttribute('href', '/p/sample-product');
    expect(mobileName).toHaveClass('text-3xl');
    expect(desktopName).toHaveClass('text-2xl');
  });
});

describe('ProductItemRow first-card spacing', () => {
  it('removes mobile first-row top padding and keeps desktop first:pt-4 under the header', () => {
    render(<ProductItemRow item={item} />);

    const row = screen.getByTestId(`product-item-row-${item.id}`);
    expect(row).toHaveClass('py-4', 'first:pt-0', 'sm:py-6', 'sm:first:pt-4');
    expect(row).not.toHaveClass('py-6');
    expect(row.className.split(/\s+/)).not.toContain('first:pt-4');
  });
});

describe('ProductItemRow omitMobileUnitPrice', () => {
  const unitPriceLabel = formatCurrency(item.netUnitPrice!, item.currency, 'de-DE');
  const trailingRefundLabel = formatCurrency(250, item.currency, 'de-DE');

  it('keeps unit price visible on mobile by default (Quote/Approval parity)', () => {
    render(<ProductItemRow item={item} showGrossUnderNet locale="de-DE" />);

    const mobileRow = screen.getByTestId(`product-item-mobile-${item.id}`);
    expect(within(mobileRow).getByText(byNormalizedText(unitPriceLabel))).toBeInTheDocument();
  });

  it('omits unit price on mobile and renders the trailing amount slot instead when configured', () => {
    render(
      <ProductItemRow
        item={item}
        showGrossUnderNet
        locale="de-DE"
        presentationConfig={{
          omitMobileUnitPrice: true,
          showTrailingDesktopAmount: true,
          trailingDesktopAmount: () => <div data-testid="mobile-trailing-refund">{trailingRefundLabel}</div>,
        }}
      />,
    );

    const mobileRow = screen.getByTestId(`product-item-mobile-${item.id}`);
    const desktopRow = screen.getByTestId(`product-item-desktop-${item.id}`);

    expect(within(mobileRow).queryByText(byNormalizedText(unitPriceLabel))).not.toBeInTheDocument();
    const trailing = within(mobileRow).getByTestId('mobile-trailing-refund');
    expect(trailing.textContent?.replaceAll(/\s+/g, ' ').trim()).toBe(
      trailingRefundLabel.replaceAll(/\s+/g, ' ').trim(),
    );
    expect(within(desktopRow).getByText(byNormalizedText(unitPriceLabel))).toBeInTheDocument();
  });
});
