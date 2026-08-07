/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProductVariantAttributeGroups } from './product-variant-attribute-groups';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/hooks/useL10n', () => ({
  useL10n: () => ({
    l10n: (value: string) => value,
    l10nOrEmpty: (value: string) => value ?? '',
  }),
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

  it('highlights the current product value and grays out incompatible values', () => {
    render(
      <ProductVariantAttributeGroups
        groups={[
          { key: 'capacity', name: 'Capacity', values: ['12 Ah', '60 Ah'] },
          { key: 'voltage', name: 'Voltage', values: ['12 V', '24 V'] },
        ]}
        selectedValues={{ capacity: '12 Ah', voltage: '12 V' }}
        compatibleValuesByAttribute={{
          capacity: new Set(['12 Ah', '60 Ah']),
          voltage: new Set(['12 V']),
        }}
      />,
    );

    expect(screen.getByText('12 Ah')).toHaveAttribute('data-chip-state', 'selected');
    expect(screen.getByText('60 Ah')).toHaveAttribute('data-chip-state', 'available');
    expect(screen.getByText('12 V')).toHaveAttribute('data-chip-state', 'selected');
    expect(screen.getByText('24 V')).toHaveAttribute('data-chip-state', 'unavailable');
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
});
