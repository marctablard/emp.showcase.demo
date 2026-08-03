/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { formatCurrency } from '@/lib/utils';
import { ProductItemRow } from './product-item-row';
import type { ProductListItem } from './product-list';

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
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
  itemNumber: '12345678',
  quantity: 2,
  unitPrice: 100,
  currency: 'EUR',
  netUnitPrice: 100,
  grossUnitPrice: 119,
};

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
