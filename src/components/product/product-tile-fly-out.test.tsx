/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { L10N_MISSING_LABEL } from '@/lib/l10n';
import type { Product } from '@/platform/services/model/product';
import { ProductTileFlyOut } from './product-tile-fly-out';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
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

jest.mock('@/hooks/useL10n', () => ({
  useL10n: () => ({
    l10n: (value: unknown) => {
      if (typeof value === 'string') {
        return value;
      }
      if (value && typeof value === 'object' && 'en' in value) {
        return (value as Record<string, string>).en;
      }
      return '-';
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

function makeProduct(overrides?: Partial<Product>): Product {
  return {
    id: 'fly-out-1',
    name: { en: 'Variant Product' },
    description: { en: 'Description' },
    purchasable: true,
    ...overrides,
  };
}

describe('ProductTileFlyOut', () => {
  it('renders Color from variantAttributes name instead of beautifying colorFinish', () => {
    render(
      <ProductTileFlyOut
        product={makeProduct({
          variantAttributeValues: { colorFinish: 'matte' },
          variantAttributes: [
            {
              key: 'colorFinish',
              name: { en: 'Color' },
              values: [{ key: 'matte', selected: true }],
            },
          ],
        })}
      />,
    );

    expect(screen.getByText('Color: matte')).toBeInTheDocument();
    expect(screen.queryByText(/Color Finish/)).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp(`^${L10N_MISSING_LABEL}:`))).not.toBeInTheDocument();
  });

  it('renders the missing-label sentinel when variantAttributes name is absent', () => {
    render(
      <ProductTileFlyOut
        product={makeProduct({
          variantAttributeValues: { colorFinish: 'matte' },
          variantAttributes: [{ key: 'colorFinish', values: [{ key: 'matte', selected: true }] }],
        })}
      />,
    );

    expect(screen.getByText(`${L10N_MISSING_LABEL}: matte`)).toBeInTheDocument();
    expect(screen.queryByText(/Color Finish/)).not.toBeInTheDocument();
    expect(screen.queryByText(/filters\.mixins\.productVariantAttributes/)).not.toBeInTheDocument();
  });
});
