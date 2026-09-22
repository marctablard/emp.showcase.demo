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

describe('ProductVariantAttributeGroups', () => {
  it('renders attribute labels and chips as buttons', () => {
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
    const chips = screen.getAllByTestId('product-variant-attribute-chip');
    expect(chips).toHaveLength(3);
    chips.forEach((chip) => {
      expect(chip.tagName).toBe('BUTTON');
      expect(chip).toHaveAttribute('type', 'button');
    });
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

  it('keeps every chip clickable and marks the opened variant with a thin blue border', () => {
    render(
      <ProductVariantAttributeGroups
        groups={[
          { key: 'capacity', name: 'Capacity', values: ['12 Ah', '60 Ah', '100 Ah'] },
          { key: 'color', name: 'Color', values: ['Red', 'Blue'] },
        ]}
        selectedValues={{ color: ['Red', 'Blue'] }}
        productValues={{ capacity: '60 Ah' }}
      />,
    );

    const selectedRed = screen.getByText('Red');
    const selectedBlue = screen.getByText('Blue');
    const current = screen.getByText('60 Ah');
    const inactive = screen.getByText('100 Ah');

    expect(selectedRed).toHaveAttribute('data-chip-state', 'selected');
    expect(selectedRed).toHaveClass('border-2', 'border-border-black');
    expect(selectedRed).not.toBeDisabled();
    expect(selectedBlue).toHaveAttribute('data-chip-state', 'selected');
    expect(selectedBlue).not.toBeDisabled();

    expect(current).toHaveAttribute('data-chip-state', 'soft');
    expect(current).toHaveAttribute('aria-current', 'true');
    expect(current).toHaveClass('border', 'border-border-secondary');
    expect(current).not.toHaveClass('border-2');

    expect(inactive).toHaveAttribute('data-chip-state', 'inactive');
    expect(inactive).not.toBeDisabled();
  });

  it('lets the black filter border win when the opened value is also selected', () => {
    render(
      <ProductVariantAttributeGroups
        groups={[{ key: 'capacity', name: 'Capacity', values: ['12 Ah', '60 Ah'] }]}
        selectedValues={{ capacity: ['12 Ah'] }}
        productValues={{ capacity: '12 Ah' }}
      />,
    );

    expect(screen.getByText('12 Ah')).toHaveAttribute('data-chip-state', 'selected');
    expect(screen.getByText('60 Ah')).toHaveAttribute('data-chip-state', 'inactive');
    expect(screen.queryByTestId('product-variant-attribute-chip-tooltip')).not.toBeInTheDocument();
  });

  it('calls onSelect for every chip', () => {
    const onSelect = jest.fn();
    render(
      <ProductVariantAttributeGroups
        groups={[{ key: 'capacity', name: 'Capacity', values: ['12 Ah', '60 Ah'] }]}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByText('12 Ah'));
    fireEvent.click(screen.getByText('60 Ah'));

    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenNthCalledWith(1, 'capacity', '12 Ah');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'capacity', '60 Ah');
    expect(screen.getByText('60 Ah')).not.toBeDisabled();
  });

  it('exposes clear-all and per-row show more/less test ids', () => {
    const onClearAll = jest.fn();
    const values = Array.from({ length: 8 }, (_, index) => `${index + 1} Ah`);

    render(
      <ProductVariantAttributeGroups
        groups={[{ key: 'capacity', name: 'Capacity', values }]}
        onClearAll={onClearAll}
      />,
    );

    expect(screen.getByTestId('product-variant-clearAllFilters')).toBeInTheDocument();
    expect(screen.getByTestId('product-variant-showMore-capacity')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('product-variant-clearAllFilters'));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('collapses long value lists behind show more', () => {
    const values = Array.from({ length: 8 }, (_, index) => `${index + 1} Ah`);

    render(<ProductVariantAttributeGroups groups={[{ key: 'capacity', name: 'Capacity', values }]} />);

    expect(screen.getAllByTestId('product-variant-attribute-chip')).toHaveLength(6);
    fireEvent.click(screen.getByTestId('product-variant-showMore-capacity'));
    expect(screen.getAllByTestId('product-variant-attribute-chip')).toHaveLength(8);
    fireEvent.click(screen.getByTestId('product-variant-showLess-capacity'));
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
