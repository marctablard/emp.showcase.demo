/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { Product } from '@/platform/services/model/product';
import { ProductTile } from './product-tile';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, fill: _fill, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => (
    <img alt={alt} {...props} />
  ),
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@/hooks/cart/useCart', () => ({
  useCart: () => ({ addItem: jest.fn(), loading: false }),
}));

jest.mock('@/hooks/cart/useValidateAddToCart', () => ({
  useValidateAddToCart: () => ({ disabled: false, tooltip: undefined }),
}));

jest.mock('@/hooks/comparison/useComparison', () => ({
  useComparison: () => ({
    isInComparison: () => false,
    toggleProduct: jest.fn(),
    isFull: false,
  }),
}));

jest.mock('@/hooks/comparison/useValidateAddToComparison', () => ({
  useValidateAddToComparison: () => ({ disabled: false, tooltip: undefined }),
}));

jest.mock('@/hooks/useAvailableVariantValues', () => ({
  useAvailableVariantValues: () => ({ values: [], loading: false }),
}));

jest.mock('@/hooks/useHorizontalScroll', () => ({
  useHorizontalScroll: () => ({ current: null }),
}));

jest.mock('@/hooks/useL10n', () => ({
  useL10n: () => ({
    l10n: (value: unknown) => {
      if (typeof value === 'string') {
        return value;
      }
      if (value && typeof value === 'object' && 'en' in value) {
        return (value as Record<string, string>).en;
      }
      return '';
    },
    l10nOrEmpty: (value: unknown) => {
      if (typeof value === 'string') {
        return value;
      }
      if (value && typeof value === 'object' && 'en' in value) {
        return (value as Record<string, string>).en;
      }
      return '';
    },
  }),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({ error: jest.fn() }),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
  formatCurrency: (amount: number, currency: string) => `${currency} ${amount}`,
  imageSizes: '100vw',
}));

jest.mock('../ui/toast-notification', () => ({
  ToastType: {
    Success: 'success',
    Error: 'error',
    Info: 'info',
    Warning: 'warning',
  },
  notify: jest.fn(),
}));

function makeProduct(overrides?: Partial<Product>): Product {
  return {
    id: 'parent-1',
    name: { en: 'Parent Product' },
    description: { en: 'Description' },
    purchasable: true,
    primaryImage: {
      url: 'https://cdn.example.com/product.png',
      altText: { en: 'Parent Product' },
    },
    ...overrides,
  };
}

describe('ProductTile', () => {
  it('renders the parent variant count badge only when explicitly enabled', () => {
    render(
      <ProductTile
        product={makeProduct({ isParentVariant: true, variantCount: 3 })}
        locale="en"
        skipVariantFetch
        showParentVariantBadge
      />,
    );

    expect(screen.getByTestId('parent-variant-count-badge')).toHaveTextContent('3');
  });

  it('keeps the badge hidden by default for shared tile usage', () => {
    render(
      <ProductTile product={makeProduct({ isParentVariant: true, variantCount: 3 })} locale="en" skipVariantFetch />,
    );

    expect(screen.queryByTestId('parent-variant-count-badge')).not.toBeInTheDocument();
  });

  it('keeps the badge hidden for non-parent products even when the opt-in is enabled', () => {
    render(
      <ProductTile
        product={makeProduct({ isParentVariant: false, variantCount: 3 })}
        locale="en"
        skipVariantFetch
        showParentVariantBadge
      />,
    );

    expect(screen.queryByTestId('parent-variant-count-badge')).not.toBeInTheDocument();
  });
});
