/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { SearchActiveFilters } from './search-active-filters';

const FORBIDDEN_BI_KEY = '_product_i18n.de.categoryBreadcrumbs.displayPath';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { defaultValue?: string }) => {
    if (key.includes(FORBIDDEN_BI_KEY)) {
      throw new Error(`Unexpected translation lookup: ${key}`);
    }

    return values?.defaultValue ?? key;
  },
}));

jest.mock('@/components/ui/pill', () => ({
  Pill: ({ label, value }: { label: string; value: string }) => (
    <div>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}));

describe('SearchActiveFilters', () => {
  it('uses the typed BatteryIncluded facet label for the chip title when available', () => {
    render(
      <SearchActiveFilters
        activeFilters={{
          price: { from: '10', till: '20' },
        }}
        resetFacet={jest.fn()}
        resetAllFacets={jest.fn()}
        batteryIncludedFacets={[
          {
            id: 'price',
            label: 'Netto Price DE',
            kind: 'range',
            min: '0',
            max: '100',
          },
        ]}
      />,
    );

    expect(screen.getByText('Netto Price DE')).toBeInTheDocument();
    expect(screen.getByText('10 - 20')).toBeInTheDocument();
  });

  it('renders readable labels for select, tree, range, and rating BatteryIncluded facets', () => {
    render(
      <SearchActiveFilters
        activeFilters={{
          color: ['red', 'blue'],
          brandTree: 'Power Tools > Drills',
          price: { from: '10', till: '20' },
          rating: '4',
        }}
        resetFacet={jest.fn()}
        resetAllFacets={jest.fn()}
        batteryIncludedFacets={[
          {
            id: 'color',
            label: 'color',
            kind: 'select',
            options: [
              { id: 'red', label: 'Red', active: true, count: 1 },
              { id: 'blue', label: 'Blue', active: true, count: 2 },
            ],
          },
          {
            id: 'brandTree',
            label: 'brandTree',
            kind: 'tree',
            options: [
              {
                id: 'Power Tools > Drills',
                label: 'Power Tools > Drills',
                active: true,
                count: 3,
                idPath: ['power-tools', 'drills'],
                labelPath: ['Power Tools', 'Drills'],
              },
            ],
          },
          {
            id: 'price',
            label: 'price',
            kind: 'range',
            min: '0',
            max: '100',
          },
          {
            id: 'rating',
            label: 'rating',
            kind: 'rating',
            options: [{ id: '4', label: '4 stars & up', active: true, count: 4 }],
          },
        ]}
      />,
    );

    expect(screen.getByText('Red, Blue')).toBeInTheDocument();
    expect(screen.getByText('Power Tools > Drills')).toBeInTheDocument();
    expect(screen.getByText('10 - 20')).toBeInTheDocument();
    expect(screen.getByText('4 stars & up')).toBeInTheDocument();
  });

  it('renders identifier-like BatteryIncluded chip titles without translation lookup', () => {
    render(
      <SearchActiveFilters
        activeFilters={{
          [FORBIDDEN_BI_KEY]: 'industrial-drills',
        }}
        resetFacet={jest.fn()}
        resetAllFacets={jest.fn()}
        batteryIncludedFacets={[
          {
            id: FORBIDDEN_BI_KEY,
            label: FORBIDDEN_BI_KEY,
            kind: 'select',
            options: [{ id: 'industrial-drills', label: 'Industrial Drills', active: true, count: 2 }],
          },
        ]}
      />,
    );

    expect(screen.getByText(FORBIDDEN_BI_KEY)).toBeInTheDocument();
    expect(screen.getByText('Industrial Drills')).toBeInTheDocument();
  });
});
