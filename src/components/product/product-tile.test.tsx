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

jest.mock('@/hooks/wishlist/useWishlistAddWithAuth', () => ({
  useWishlistAddWithAuth: () => ({
    addToWishlist: jest.fn(),
    isAdding: false,
    loginDialog: null,
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

  it('renders template attribute labels and formats DATETIME values', () => {
    render(
      <ProductTile
        product={makeProduct({
          templateAttributes: {
            'date-attribute': '2026-08-18T12:00:00.000Z',
            'pick-a-list-optional': 'Value 4',
          },
          templateAttributeLabels: {
            'date-attribute': { en: 'Date attribute' },
            'pick-a-list-optional': { en: 'Pick a list (optional)' },
          },
          templateAttributeTypes: {
            'date-attribute': 'DATETIME',
            'pick-a-list-optional': 'TEXT',
          },
        })}
        locale="en-US"
        skipVariantFetch
      />,
    );

    expect(screen.getByText('Date attribute')).toBeInTheDocument();
    expect(screen.getByText('Pick a list (optional)')).toBeInTheDocument();
    expect(screen.queryByText('pick-a-list-optional')).not.toBeInTheDocument();
    expect(screen.queryByText(/product\.filters\.mixins\.productTemplateAttributes/)).not.toBeInTheDocument();
    expect(screen.queryByText('2026-08-18T12:00:00.000Z')).not.toBeInTheDocument();
    expect(screen.getByText('Value 4')).toBeInTheDocument();
  });

  it('renders template attributes in templateAttributeOrder, not A–Z', () => {
    const { container } = render(
      <ProductTile
        product={makeProduct({
          templateAttributes: {
            zebra: 'z',
            alpha: 'a',
            middle: 'm',
          },
          templateAttributeOrder: ['middle', 'zebra', 'alpha'],
          templateAttributeLabels: {
            zebra: { en: 'Zebra' },
            alpha: { en: 'Alpha' },
            middle: { en: 'Middle' },
          },
        })}
        locale="en"
        skipVariantFetch
      />,
    );

    const labels = Array.from(container.querySelectorAll('.flex.justify-between > p:first-child')).map(
      (el) => el.textContent,
    );
    expect(labels).toEqual(['Middle', 'Zebra', 'Alpha']);
  });

  it('renders BOOLEAN template attribute values as Lucide icons', () => {
    render(
      <ProductTile
        product={makeProduct({
          templateAttributes: {
            'to-be-or-not-to-be': 'True',
            'another-flag': 'false',
          },
          templateAttributeLabels: {
            'to-be-or-not-to-be': { en: 'To be or not to be' },
            'another-flag': { en: 'Another flag' },
          },
          templateAttributeTypes: {
            'to-be-or-not-to-be': 'BOOLEAN',
            'another-flag': 'BOOLEAN',
          },
        })}
        locale="en"
        skipVariantFetch
      />,
    );

    expect(screen.getByTestId('template-attribute-boolean-true')).toBeInTheDocument();
    expect(screen.getByTestId('template-attribute-boolean-false')).toBeInTheDocument();
    expect(screen.queryByText('True')).not.toBeInTheDocument();
    expect(screen.queryByText('False')).not.toBeInTheDocument();
  });

  it('does not emit duplicate React key warnings when USP translations are missing for the active locale', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ProductTile
        product={makeProduct({
          usps: [
            { icon: 'worldwide', description: { de: 'Weltweit' } },
            { icon: 'waterproof', description: { de: 'Wasserfest' } },
          ],
        })}
        locale="en"
        skipVariantFetch
      />,
    );

    const hasDuplicateKeyWarning = consoleErrorSpy.mock.calls.some((call) =>
      call.some((arg) => typeof arg === 'string' && arg.includes('Encountered two children with the same key')),
    );

    expect(hasDuplicateKeyWarning).toBe(false);

    consoleErrorSpy.mockRestore();
  });

  it('renders compact parent option chips from first-attribute values when skipVariantFetch is set', () => {
    render(
      <ProductTile
        product={makeProduct({
          isParentVariant: true,
          variantCount: 4,
          variantAttributes: [
            {
              key: 'nominal-power',
              name: { en: 'Nominal power' },
              values: [
                { key: 'alpha', name: { en: 'ExtraLongNominalPowerValueAlpha' }, selected: false },
                { key: 'beta', name: { en: 'ExtraLongNominalPowerValueBeta' }, selected: false },
                { key: 'gamma', name: { en: 'ExtraLongNominalPowerValueGamma' }, selected: false },
                { key: 'delta', name: { en: 'ExtraLongNominalPowerValueDelta' }, selected: true },
              ],
            },
          ],
        })}
        locale="en"
        skipVariantFetch
        showParentVariantBadge
      />,
    );

    const alphaChip = screen
      .getAllByText('ExtraLongNominalPowerValueAlpha')
      .find((el) => el.classList.contains('truncate'));
    const betaChip = screen
      .getAllByText('ExtraLongNominalPowerValueBeta')
      .find((el) => el.classList.contains('truncate'));

    expect(alphaChip).toBeDefined();
    expect(betaChip).toBeDefined();
    expect(alphaChip?.parentElement).toHaveClass('max-w-30');
    expect(alphaChip?.parentElement).not.toHaveClass('w-full');
    expect(alphaChip?.parentElement).not.toHaveClass('max-w-full');
    expect(betaChip?.parentElement).toHaveClass('max-w-30');
    expect(betaChip?.parentElement).not.toHaveClass('w-full');
    expect(betaChip?.parentElement).not.toHaveClass('max-w-full');
    expect(screen.getByTestId('parent-variant-count-badge')).toHaveTextContent('4');
    expect(screen.getByTestId('product-tile-variant-chips')).toHaveClass('flex-col', 'items-end');
    expect(screen.getByTestId('product-tile-variant-chips-last-row')).toHaveClass('items-end');
    expect(screen.getByTestId('product-tile-variant-overflow')).toHaveTextContent('+1');
    expect(screen.getByTestId('product-tile-variant-chips-last-row').firstChild).toHaveTextContent('+1');
    expect(screen.getByText('ExtraLongNominalPowerValueGamma')).toBeInTheDocument();
    expect(screen.queryByText('ExtraLongNominalPowerValueDelta')).not.toBeInTheDocument();
  });

  it('renders unique child variant values when the parent has empty variantAttributes', () => {
    render(
      <ProductTile
        product={makeProduct({
          id: 'SLP654321',
          name: { en: 'Victron Solar panel' },
          isParentVariant: true,
          purchasable: false,
          variantCount: 2,
          variantAttributes: [],
          variants: [
            {
              id: 'SLP654321--1200',
              name: { en: 'Victron Solar panel' },
              description: { en: 'Victron Solar panel' },
              purchasable: true,
              parentVariantId: 'SLP654321',
              variantAttributeValues: { 'nominal-power': '1200W' },
              variantAttributes: [
                {
                  key: 'nominal-power',
                  name: { en: 'nominal-power' },
                  values: [{ key: '1200W', selected: true }],
                },
              ],
            },
            {
              id: 'SLP654321--600',
              name: { en: 'Victron Solar panel' },
              description: { en: 'Victron Solar panel' },
              purchasable: true,
              parentVariantId: 'SLP654321',
              variantAttributeValues: { 'nominal-power': '600W' },
              variantAttributes: [
                {
                  key: 'nominal-power',
                  name: { en: 'nominal-power' },
                  values: [{ key: '600W', selected: true }],
                },
              ],
            },
          ],
        })}
        locale="en"
        skipVariantFetch
        showParentVariantBadge
      />,
    );

    expect(screen.getByText('1200W')).toBeInTheDocument();
    expect(screen.getByText('600W')).toBeInTheDocument();
    expect(screen.getAllByText('nominal-power')).toHaveLength(2);
    expect(screen.getByTestId('parent-variant-count-badge')).toHaveTextContent('2');
  });
});
