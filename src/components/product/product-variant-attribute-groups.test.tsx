/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { formatDate } from '@/lib/date-utils';
import { ProductVariantAttributeGroups } from './product-variant-attribute-groups';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en-US',
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
    l10nOrEmpty: (value: string) => value ?? '',
  }),
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="product-variant-attribute-chip-tooltip">{children}</div>
  ),
}));

describe('ProductVariantAttributeGroups', () => {
  it('renders attribute labels and chips', () => {
    render(
      <ProductVariantAttributeGroups
        groups={[
          { key: 'capacity', name: 'Capacity', values: ['12 Ah', '60 Ah'] },
          { key: 'voltage', name: 'Voltage', values: ['12 V'] },
        ]}
      />,
    );

    expect(screen.getByText('Capacity')).toBeInTheDocument();
    expect(screen.getByText('Voltage')).toBeInTheDocument();
    expect(screen.getAllByTestId('product-variant-attribute-chip')).toHaveLength(3);
  });

  it('renders numeric-looking value keys as visible chip text', () => {
    render(
      <ProductVariantAttributeGroups
        groups={[{ key: 'width', name: 'width', values: ['15', '20', '100'] }]}
        selectedValues={{ width: '15' }}
      />,
    );

    expect(screen.getByText('15')).toHaveAttribute('data-chip-state', 'selected');
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('keeps the selected chip emphasized and grays out all other values', () => {
    render(
      <ProductVariantAttributeGroups
        groups={[
          { key: 'capacity', name: 'Capacity', values: ['12 Ah', '60 Ah'] },
          { key: 'voltage', name: 'Voltage', values: ['12 V', '24 V'] },
        ]}
        selectedValues={{ capacity: '12 Ah', voltage: '12 V' }}
      />,
    );

    const selected = screen.getByText('12 Ah');
    const inactive = screen.getByText('60 Ah');

    expect(selected).toHaveAttribute('data-chip-state', 'selected');
    expect(selected).toHaveClass('cursor-not-allowed');
    expect(inactive).toHaveAttribute('data-chip-state', 'inactive');
    expect(inactive).toHaveClass('cursor-not-allowed', 'bg-surface-disabled', 'text-text-disabled');
    expect(screen.getByText('12 V')).toHaveAttribute('data-chip-state', 'selected');
    expect(screen.getByText('24 V')).toHaveAttribute('data-chip-state', 'inactive');
    expect(screen.getAllByTestId('product-variant-attribute-chip-tooltip')[0]).toHaveTextContent(
      'variantAttributeSelectViaListTooltip',
    );
  });

  it('collapses long value lists behind show more', () => {
    const values = Array.from({ length: 8 }, (_, index) => `${index + 1} Ah`);

    render(<ProductVariantAttributeGroups groups={[{ key: 'capacity', name: 'Capacity', values }]} />);

    expect(screen.getAllByTestId('product-variant-attribute-chip')).toHaveLength(6);
    fireEvent.click(screen.getByText('showMore'));
    expect(screen.getAllByTestId('product-variant-attribute-chip')).toHaveLength(8);
    fireEvent.click(screen.getByText('showLess'));
    expect(screen.getAllByTestId('product-variant-attribute-chip')).toHaveLength(6);
  });

  it('uses product-template labels instead of key-echo names', () => {
    render(
      <ProductVariantAttributeGroups
        groups={[
          {
            key: 'a-very-long-attribute-name-to-test-wrapping',
            name: { en: 'a-very-long-attribute-name-to-test-wrapping' },
            values: ['First option'],
          },
        ]}
        attributeLabels={{
          'a-very-long-attribute-name-to-test-wrapping': { en: 'A Very Long Attribute Name To Test Wrapping' },
        }}
      />,
    );

    expect(screen.getByText('A Very Long Attribute Name To Test Wrapping')).toBeInTheDocument();
    expect(screen.queryByText('a-very-long-attribute-name-to-test-wrapping')).not.toBeInTheDocument();
    expect(screen.queryByText(/filters.mixins.productVariantAttributes/)).not.toBeInTheDocument();
  });

  it('formats DATETIME chip values with the shared date formatter', () => {
    render(
      <ProductVariantAttributeGroups
        groups={[
          {
            key: 'date-attribute',
            name: { en: 'Date attribute' },
            values: ['2026-08-27T12:00:00.000Z'],
          },
        ]}
        attributeTypes={{ 'date-attribute': 'DATETIME' }}
        selectedValues={{ 'date-attribute': '2026-08-27T12:00:00.000Z' }}
      />,
    );

    expect(screen.queryByText('2026-08-27T12:00:00.000Z')).not.toBeInTheDocument();
    expect(screen.getByTestId('product-variant-attribute-chip')).toHaveTextContent(
      formatDate('2026-08-27T12:00:00.000Z', 'en-US'),
    );
    expect(screen.getByTestId('product-variant-attribute-chip')).toHaveAttribute('data-chip-state', 'selected');
  });
});
