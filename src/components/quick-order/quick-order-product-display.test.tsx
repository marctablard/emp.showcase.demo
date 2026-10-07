/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { QuickOrderProductCard } from './quick-order-product-card';
import { QuickOrderProductRow } from './quick-order-product-row';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/hooks/useL10n', () => ({
  useL10n: () => ({
    l10n: (value: string) => value,
  }),
}));

jest.mock('@/hooks/product/useAvailability', () => ({
  useAvailability: () => ({ availability: { availableQuantity: 5 } }),
}));

jest.mock('@/components/ui/molecules/quantity-stepper', () => ({
  QuantityStepper: () => <div data-testid="mock-stepper" />,
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt?: string; src: string }) => <img alt={props.alt} src={props.src} />,
}));

describe('QuickOrder product display', () => {
  const product = {
    id: '<mark>product-1</mark>',
    sku: '<mark>sku-1</mark>',
    name: '<mark>Solar</mark> Panel',
    brand: { name: '<mark>Brand</mark>' },
    images: [],
    price: undefined,
  } as never;

  it('uses sanitized fallback alt and route values in the product card', () => {
    render(<QuickOrderProductCard product={product} quantity={1} onRemove={jest.fn()} onUpdateQuantity={jest.fn()} />);

    expect(screen.getByTestId('product-card-product-1')).toBeInTheDocument();
    expect(screen.getByAltText('Solar Panel')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /solar panel/i })).toHaveAttribute('href', '/product/product-1');
  });

  it('uses sanitized fallback alt and route values in the product row', () => {
    render(
      <table>
        <tbody>
          <QuickOrderProductRow product={product} quantity={1} onRemove={jest.fn()} onUpdateQuantity={jest.fn()} />
        </tbody>
      </table>,
    );

    expect(screen.getByTestId('product-row-product-1')).toBeInTheDocument();
    expect(screen.getByAltText('Solar Panel')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /solar panel/i })).toHaveAttribute('href', '/product/product-1');
  });
});
