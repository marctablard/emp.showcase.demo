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

  it('distinguishes selected, soft, inactive, and disabled chip states', () => {
    render(
      <ProductVariantAttributeGroups
        groups={[
          { key: 'capacity', name: 'Capacity', values: ['12 Ah', '60 Ah', '100 Ah'] },
          { key: 'voltage', name: 'Voltage', values: ['12 V', '24 V'] },
        ]}
        selectedValues={{ capacity: '12 Ah' }}
        productValues={{ capacity: '60 Ah', voltage: '12 V' }}
        compatibleValuesByAttribute={{
          capacity: new Set(['12 Ah', '60 Ah']),
          voltage: new Set(['12 V']),
        }}
      />,
    );

    const selected = screen.getByText('12 Ah');
    const soft = screen.getByText('60 Ah');
    const disabled = screen.getByText('100 Ah');
    const productSoft = screen.getByText('12 V');
    const inactiveDisabled = screen.getByText('24 V');

    expect(selected).toHaveAttribute('data-chip-state', 'selected');
    expect(selected).toHaveClass('border-2', 'border-border-black');
    expect(selected).not.toBeDisabled();

    expect(soft).toHaveAttribute('data-chip-state', 'soft');
    expect(soft).toHaveClass('border-2', 'border-border-secondary');

    expect(disabled).toHaveAttribute('data-chip-state', 'disabled');
    expect(disabled).toBeDisabled();
    expect(disabled).toHaveClass('bg-surface-disabled', 'text-text-disabled');

    expect(productSoft).toHaveAttribute('data-chip-state', 'soft');
    expect(inactiveDisabled).toHaveAttribute('data-chip-state', 'disabled');
    expect(inactiveDisabled).toBeInTheDocument();
  });

  it('shows the list tooltip only on disabled chips', () => {
    render(
      <ProductVariantAttributeGroups
        groups={[{ key: 'capacity', name: 'Capacity', values: ['12 Ah', '60 Ah'] }]}
        selectedValues={{ capacity: '12 Ah' }}
        compatibleValuesByAttribute={{ capacity: new Set(['12 Ah']) }}
      />,
    );

    const tooltips = screen.getAllByTestId('product-variant-attribute-chip-tooltip');
    expect(tooltips).toHaveLength(1);
    expect(tooltips[0]).toHaveTextContent('variantAttributeSelectViaListTooltip');
    expect(screen.getByText('12 Ah')).toHaveAttribute('data-chip-state', 'selected');
    expect(screen.getByText('60 Ah')).toHaveAttribute('data-chip-state', 'disabled');
  });

  it('does not show the list tooltip on inactive chips', () => {
    render(
      <ProductVariantAttributeGroups groups={[{ key: 'capacity', name: 'Capacity', values: ['12 Ah', '60 Ah'] }]} />,
    );

    expect(screen.queryByTestId('product-variant-attribute-chip-tooltip')).not.toBeInTheDocument();
    expect(screen.getByText('12 Ah')).toHaveAttribute('data-chip-state', 'inactive');
    expect(screen.getByText('60 Ah')).toHaveAttribute('data-chip-state', 'inactive');
  });

  it('calls onSelect for an enabled chip and keeps disabled chips in the DOM', () => {
    const onSelect = jest.fn();
    render(
      <ProductVariantAttributeGroups
        groups={[{ key: 'capacity', name: 'Capacity', values: ['12 Ah', '60 Ah'] }]}
        compatibleValuesByAttribute={{ capacity: new Set(['12 Ah']) }}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByText('12 Ah'));
    fireEvent.click(screen.getByText('60 Ah'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('capacity', '12 Ah');
    expect(screen.getByText('60 Ah')).toBeDisabled();
    expect(screen.getByText('60 Ah')).toBeInTheDocument();
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
