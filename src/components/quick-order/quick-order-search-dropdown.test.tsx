/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { QuickOrderSearchDropdown } from './quick-order-search-dropdown';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/hooks/useL10n', () => ({
  useL10n: () => ({
    l10n: (value: string) => value,
  }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt?: string; src: string }) => <img alt={props.alt} src={props.src} />,
}));

describe('QuickOrderSearchDropdown', () => {
  it('passes a sanitized product payload to onSelect', () => {
    const onSelect = jest.fn();

    render(
      <QuickOrderSearchDropdown
        products={[
          {
            id: '<mark>product-1</mark>',
            sku: '<mark>sku-1</mark>',
            name: '<mark>Solar</mark> Panel',
            brand: { name: '<mark>Brand</mark>' },
            images: [{ url: '/image.png', altText: '<mark>Highlighted</mark> image' }],
          } as never,
        ]}
        loading={false}
        hasSearched
        highlightedIndex={-1}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole('option'));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'product-1',
        sku: 'sku-1',
      }),
    );
    expect(screen.getByTestId('search-result-product-1')).toBeInTheDocument();
    expect(screen.getByAltText('Highlighted image')).toBeInTheDocument();
  });
});
