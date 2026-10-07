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
  it('keeps the parent variant count badge hidden until Battery Included investigation', () => {
    render(
      <ProductTile
        product={makeProduct({ isParentVariant: true, variantCount: 3 })}
        locale="en"
        skipVariantFetch
        showParentVariantBadge
      />,
    );

    expect(screen.queryByTestId('parent-variant-count-badge')).not.toBeInTheDocument();
  });

  it('shows the parent variant count badge when the Battery Included flag is enabled', () => {
    const previous = process.env.NEXT_PUBLIC_SHOW_PARENT_VARIANT_COUNT_BADGE;
    process.env.NEXT_PUBLIC_SHOW_PARENT_VARIANT_COUNT_BADGE = 'true';

    try {
      render(
        <ProductTile
          product={makeProduct({ isParentVariant: true, variantCount: 3 })}
          locale="en"
          skipVariantFetch
          showParentVariantBadge
        />,
      );

      expect(screen.getByTestId('parent-variant-count-badge')).toHaveTextContent('3');
    } finally {
      if (previous === undefined) {
        delete process.env.NEXT_PUBLIC_SHOW_PARENT_VARIANT_COUNT_BADGE;
      } else {
        process.env.NEXT_PUBLIC_SHOW_PARENT_VARIANT_COUNT_BADGE = previous;
      }
    }
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

  it('renders up to 6 parent label-only chips in templateAttributeOrder and overflows the rest', () => {
    render(
      <ProductTile
        product={makeProduct({
          isParentVariant: true,
          variantCount: 11,
          variantAttributes: [],
          templateAttributeOrder: [
            'width',
            'yes',
            'date-attribute',
            'a-number-attribute-9',
            'a-very-long-attribute-name-to-test-wrapping',
            'height',
            'extra-one',
            'extra-two',
          ],
          templateAttributeLabels: {
            width: { en: 'Width' },
            yes: { en: 'Yes✅❌✔️✖️👍👎' },
            'date-attribute': { en: 'Date attribute📅' },
            'a-number-attribute-9': { en: 'A number attribute 9️⃣' },
            'a-very-long-attribute-name-to-test-wrapping': { en: 'A very long attribute name to test wrapping' },
            height: { en: 'Height' },
            'extra-one': { en: 'Extra one' },
            'extra-two': { en: 'Extra two' },
          },
          variants: [
            {
              id: 'child-1',
              name: { en: 'Child' },
              description: { en: 'Child' },
              purchasable: true,
              parentVariantId: 'parent-1',
              variantAttributeValues: {
                width: '15',
                'date-attribute': '2026-08-27T09:05:45.279Z',
                'a-number-attribute-9': '2342423',
                'a-very-long-attribute-name-to-test-wrapping': 'First option',
                height: 'Short',
                'extra-one': 'a',
                'extra-two': 'b',
              },
            },
          ],
        })}
        locale="en"
        skipVariantFetch
        showParentVariantBadge
      />,
    );

    const labels = screen.getAllByTestId('product-tile-variant-label-chip').map((chip) => chip.textContent);
    expect(labels).toEqual([
      'Width',
      'Date attribute📅',
      'A number attribute 9️⃣',
      'A very long attribute name to test wrapping',
      'Height',
      'Extra one',
    ]);
    expect(screen.queryByText('Yes✅❌✔️✖️👍👎')).not.toBeInTheDocument();
    expect(screen.queryByText('15')).not.toBeInTheDocument();
    expect(screen.queryByText('2342423')).not.toBeInTheDocument();
    expect(screen.queryByText('Extra two')).not.toBeInTheDocument();
    expect(screen.queryByTestId('parent-variant-count-badge')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('product-tile-variant-label-chip')[0]).toHaveClass('max-w-3/4');
    expect(screen.getByTestId('product-tile-variant-chips')).toHaveClass('flex-col', 'items-end');
    expect(screen.getByTestId('product-tile-variant-chips-last-row')).toHaveClass(
      'w-full',
      'self-stretch',
      'items-end',
    );
    expect(screen.getByTestId('product-tile-variant-overflow')).toHaveTextContent('+1');
    expect(screen.getByTestId('product-tile-variant-chips-last-row').firstChild).toHaveTextContent('+1');
  });

  it('renders a single parent label when children only expose one variant attribute', () => {
    render(
      <ProductTile
        product={makeProduct({
          id: 'SLP654321',
          name: { en: 'Victron Solar panel' },
          isParentVariant: true,
          purchasable: false,
          variantCount: 2,
          variantAttributes: [],
          templateAttributeLabels: { 'nominal-power': { en: 'Nominal power' } },
          variants: [
            {
              id: 'SLP654321--1200',
              name: { en: 'Victron Solar panel' },
              description: { en: 'Victron Solar panel' },
              purchasable: true,
              parentVariantId: 'SLP654321',
              variantAttributeValues: { 'nominal-power': '1200W' },
            },
            {
              id: 'SLP654321--600',
              name: { en: 'Victron Solar panel' },
              description: { en: 'Victron Solar panel' },
              purchasable: true,
              parentVariantId: 'SLP654321',
              variantAttributeValues: { 'nominal-power': '600W' },
            },
          ],
        })}
        locale="en"
        skipVariantFetch
        showParentVariantBadge
      />,
    );

    expect(screen.getAllByTestId('product-tile-variant-label-chip')).toHaveLength(1);
    expect(screen.getByText('Nominal power')).toBeInTheDocument();
    expect(screen.queryByText('1200W')).not.toBeInTheDocument();
    expect(screen.queryByText('600W')).not.toBeInTheDocument();
    expect(screen.queryByText('nominal-power')).not.toBeInTheDocument();
    expect(screen.queryByTestId('parent-variant-count-badge')).not.toBeInTheDocument();
  });

  it('does not render variant-attribute i18n keys when only the raw key is available', () => {
    render(
      <ProductTile
        product={makeProduct({
          id: 'qa-parent',
          isParentVariant: true,
          variantCount: 1,
          variantAttributes: [
            {
              key: 'a-very-long-attribute-name-to-test-wrapping',
              name: { en: 'a-very-long-attribute-name-to-test-wrapping' },
              values: [{ key: 'First option', selected: true }],
            },
          ],
        })}
        locale="en"
        skipVariantFetch
        showParentVariantBadge
      />,
    );

    expect(screen.getByTestId('product-tile-variant-label-chip')).toHaveTextContent(
      'a-very-long-attribute-name-to-test-wrapping',
    );
    expect(screen.queryByText('First option')).not.toBeInTheDocument();
    expect(screen.queryByText(/filters.mixins.productVariantAttributes/)).not.toBeInTheDocument();
  });

  it('renders up to 3 child variant pairs in template order and overflows the rest', () => {
    render(
      <ProductTile
        product={makeProduct({
          id: 'child-1',
          isParentVariant: false,
          parentVariantId: 'parent-1',
          templateAttributeOrder: [
            'width',
            'yes',
            'date-attribute',
            'a-number-attribute-9',
            'a-very-long-attribute-name-to-test-wrapping',
            'height',
          ],
          templateAttributeLabels: {
            width: { en: 'Width' },
            'date-attribute': { en: 'Date attribute📅' },
            'a-number-attribute-9': { en: 'A number attribute 9️⃣' },
            'a-very-long-attribute-name-to-test-wrapping': { en: 'A very long attribute name to test wrapping' },
            height: { en: 'Height' },
          },
          templateAttributeTypes: {
            width: 'NUMBER',
            'date-attribute': 'DATETIME',
            'a-number-attribute-9': 'NUMBER',
            'a-very-long-attribute-name-to-test-wrapping': 'TEXT',
            height: 'TEXT',
          },
          variantAttributeValues: {
            width: '15',
            'date-attribute': '2026-08-27T09:05:45.279Z',
            'a-number-attribute-9': '2342423',
            'a-very-long-attribute-name-to-test-wrapping': 'First option',
            height: 'Short',
          },
          variantAttributes: [
            {
              key: 'a-number-attribute-9',
              name: { en: 'A number attribute 9️⃣' },
              values: [
                { key: '0', selected: true },
                { key: '2342423', selected: false },
              ],
            },
          ],
        })}
        locale="en-US"
        skipVariantFetch
      />,
    );

    expect(screen.getByText('Width')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Width: 15' })).toHaveClass('max-w-3/4');
    expect(screen.getByText('Date attribute📅')).toBeInTheDocument();
    expect(screen.getByText('A number attribute 9️⃣')).toBeInTheDocument();
    expect(screen.getByText('2,342,423')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText('Height')).not.toBeInTheDocument();
    expect(screen.queryByText('A very long attribute name to test wrapping')).not.toBeInTheDocument();
    expect(screen.getByTestId('product-tile-variant-overflow')).toHaveTextContent('+2');
  });
});
