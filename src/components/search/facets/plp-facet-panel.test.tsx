/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { BatteryIncludedFacet } from '@/platform/services/model/common';
import { PlpFacetPanel } from './plp-facet-panel';

const FORBIDDEN_BI_KEY = '_product_i18n.de.categoryBreadcrumbs.displayPath';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    if (key.includes(FORBIDDEN_BI_KEY)) {
      throw new Error(`Unexpected translation lookup: ${key}`);
    }

    if ((key === 'expand' || key === 'collapse') && values?.name) {
      return `${key}:${values.name}`;
    }

    return values?.defaultValue ?? key;
  },
}));

jest.mock('@/components/ui/slider', () => ({
  Slider: ({ 'data-testid': dataTestId }: { 'data-testid'?: string }) => <div data-testid={dataTestId} />,
}));

describe('PlpFacetPanel', () => {
  const applyFacet = jest.fn();
  const applyRangeFacet = jest.fn();
  const resetFacet = jest.fn();
  const resetAllFacets = jest.fn();

  const facets: BatteryIncludedFacet[] = [
    {
      id: 'color',
      label: 'Color',
      kind: 'select',
      options: [
        { id: 'red', label: 'Red', count: 4, active: false },
        { id: 'blue', label: 'Blue', count: 2, active: false },
      ],
    },
    {
      id: 'categoryTree',
      label: 'Category tree',
      kind: 'tree',
      options: [
        {
          id: 'phones',
          label: 'Phones',
          count: 3,
          active: false,
          idPath: ['electronics', 'phones'],
          labelPath: ['Electronics', 'Phones'],
        },
      ],
    },
    {
      id: 'price',
      label: 'Price',
      kind: 'range',
      min: '0',
      max: '100',
    },
    {
      id: 'rating',
      label: 'Rating',
      kind: 'rating',
      options: [{ id: '4', label: '4 stars & up', count: 8, active: false }],
    },
  ];

  beforeEach(() => {
    applyFacet.mockReset();
    applyRangeFacet.mockReset();
    resetFacet.mockReset();
    resetAllFacets.mockReset();
    delete process.env.NEXT_PUBLIC_FACETS_DEFAULT_COLLAPSE_SIZE;
  });

  it('renders the shared active-filter summary, accordion headings, and facet controls', () => {
    render(
      <PlpFacetPanel
        facets={facets}
        activeFilters={{ color: 'red' }}
        applyFacet={applyFacet}
        applyRangeFacet={applyRangeFacet}
        resetFacet={resetFacet}
        resetAllFacets={resetAllFacets}
      />,
    );

    expect(screen.getByTestId('plp-facet-panel')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Filter' })).toBeInTheDocument();
    expect(screen.getByTestId('plp-facet-panel-active-filters')).not.toHaveTextContent('Active filters');
    expect(screen.getByRole('button', { name: /^Color$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Category tree$/ })).toBeInTheDocument();
    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(screen.getByText('Electronics')).toBeInTheDocument();
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('min')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('max')).toBeInTheDocument();
    expect(screen.getByText('Price', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('4 stars & up')).toBeInTheDocument();
  });

  it('applies checkbox-based select and tree filters through existing mutation handlers', () => {
    render(
      <PlpFacetPanel
        facets={facets}
        activeFilters={{ color: 'red' }}
        applyFacet={applyFacet}
        applyRangeFacet={applyRangeFacet}
        resetFacet={resetFacet}
      />,
    );

    fireEvent.click(screen.getByLabelText('Blue'));
    expect(applyFacet).toHaveBeenCalledWith('color', ['red', 'blue']);

    fireEvent.click(screen.getByLabelText('Phones'));
    expect(applyFacet).toHaveBeenCalledWith('categoryTree', 'phones');
  });

  it('submits the nested range contract without local CTA buttons and reuses rating rows as checkbox filters', () => {
    render(
      <PlpFacetPanel
        facets={facets}
        activeFilters={{}}
        applyFacet={applyFacet}
        applyRangeFacet={applyRangeFacet}
        resetFacet={resetFacet}
      />,
    );

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Till'), { target: { value: '50' } });
    fireEvent.submit(screen.getByLabelText('From').closest('form') as HTMLFormElement);

    expect(applyRangeFacet).toHaveBeenCalledWith('price', '10', '50');
    expect(screen.queryByRole('button', { name: 'Apply Filters' })).not.toBeInTheDocument();
    expect(screen.getByTestId('plp-range-slider-price')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('4 stars & up'));
    expect(applyFacet).toHaveBeenCalledWith('rating', '4');
  });

  it('renders identifier-like BatteryIncluded facet labels without translation lookup', () => {
    render(
      <PlpFacetPanel
        facets={[
          {
            id: FORBIDDEN_BI_KEY,
            label: FORBIDDEN_BI_KEY,
            kind: 'select',
            options: [{ id: 'industrial-drills', label: 'Industrial Drills', count: 2, active: false }],
          },
        ]}
        activeFilters={{}}
        applyFacet={applyFacet}
        applyRangeFacet={applyRangeFacet}
        resetFacet={resetFacet}
      />,
    );

    expect(screen.getByRole('button', { name: FORBIDDEN_BI_KEY })).toBeInTheDocument();
    expect(screen.getByText('Industrial Drills')).toBeInTheDocument();
  });

  it('defaults to showing only the first 5 select options, then expands and compacts back to 5', () => {
    render(
      <PlpFacetPanel
        facets={[
          {
            id: 'highlight',
            label: 'Highlight',
            kind: 'select',
            options: Array.from({ length: 6 }, (_, index) => ({
              id: `option-${index + 1}`,
              label: `Option ${index + 1}`,
              count: index + 1,
              active: false,
            })),
          },
        ]}
        activeFilters={{}}
        applyFacet={applyFacet}
        applyRangeFacet={applyRangeFacet}
        resetFacet={resetFacet}
      />,
    );

    expect(screen.getByText('Option 5')).toBeInTheDocument();
    expect(screen.queryByText('Option 6')).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'expand:Highlight' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    expect(screen.getByText('Option 6')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'collapse:Highlight' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'collapse:Highlight' }));

    expect(screen.queryByText('Option 6')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'expand:Highlight' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('uses the fallback collapse size of 5 when the env variable is invalid', () => {
    process.env.NEXT_PUBLIC_FACETS_DEFAULT_COLLAPSE_SIZE = 'invalid';

    render(
      <PlpFacetPanel
        facets={[
          {
            id: 'rating',
            label: 'Rating',
            kind: 'rating',
            options: Array.from({ length: 6 }, (_, index) => ({
              id: String(index + 1),
              label: `${index + 1} stars & up`,
              count: index + 1,
              active: false,
            })),
          },
        ]}
        activeFilters={{}}
        applyFacet={applyFacet}
        applyRangeFacet={applyRangeFacet}
        resetFacet={resetFacet}
      />,
    );

    expect(screen.getByText('5 stars & up')).toBeInTheDocument();
    expect(screen.queryByText('6 stars & up')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'expand:Rating' })).toBeInTheDocument();
  });

  it('does not render the control when a facet has at most the configured number of options', () => {
    process.env.NEXT_PUBLIC_FACETS_DEFAULT_COLLAPSE_SIZE = '3';

    render(
      <PlpFacetPanel
        facets={[
          {
            id: 'rating',
            label: 'Rating',
            kind: 'rating',
            options: [
              { id: '1', label: '1 star & up', count: 1, active: false },
              { id: '2', label: '2 stars & up', count: 2, active: false },
              { id: '3', label: '3 stars & up', count: 3, active: false },
            ],
          },
        ]}
        activeFilters={{}}
        applyFacet={applyFacet}
        applyRangeFacet={applyRangeFacet}
        resetFacet={resetFacet}
      />,
    );

    expect(screen.getByText('3 stars & up')).toBeInTheDocument();
    expect(screen.queryByTestId('facet-options-toggle-rating')).not.toBeInTheDocument();
  });

  it('applies the same collapse rule to tree facets using the first N available leaf options', () => {
    process.env.NEXT_PUBLIC_FACETS_DEFAULT_COLLAPSE_SIZE = '2';

    render(
      <PlpFacetPanel
        facets={[
          {
            id: 'categoryTree',
            label: 'Category tree',
            kind: 'tree',
            options: [
              {
                id: 'phones',
                label: 'Phones',
                count: 3,
                active: false,
                idPath: ['electronics', 'phones'],
                labelPath: ['Electronics', 'Phones'],
              },
              {
                id: 'tablets',
                label: 'Tablets',
                count: 2,
                active: false,
                idPath: ['electronics', 'tablets'],
                labelPath: ['Electronics', 'Tablets'],
              },
              {
                id: 'drills',
                label: 'Drills',
                count: 1,
                active: false,
                idPath: ['tools', 'drills'],
                labelPath: ['Tools', 'Drills'],
              },
            ],
          },
        ]}
        activeFilters={{}}
        applyFacet={applyFacet}
        applyRangeFacet={applyRangeFacet}
        resetFacet={resetFacet}
      />,
    );

    expect(screen.getByText('Electronics')).toBeInTheDocument();
    expect(screen.getByText('Phones')).toBeInTheDocument();
    expect(screen.getByText('Tablets')).toBeInTheDocument();
    expect(screen.queryByText('Tools')).not.toBeInTheDocument();
    expect(screen.queryByText('Drills')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'expand:Category tree' }));

    expect(screen.getByText('Tools')).toBeInTheDocument();
    expect(screen.getByText('Drills')).toBeInTheDocument();
  });
});
