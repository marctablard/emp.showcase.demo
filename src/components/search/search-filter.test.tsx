/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { Filter } from '@/platform/services/model/common';
import { SearchFilter, getSearchFilterLabel } from './search-filter';

const FORBIDDEN_BI_KEY = '_product_i18n.de.categoryBreadcrumbs.displayPath';

describe('getSearchFilterLabel', () => {
  it('returns plain BatteryIncluded labels without calling the translator', () => {
    const translator = jest.fn((key: string) => {
      if (key.includes(FORBIDDEN_BI_KEY)) {
        throw new Error(`Unexpected translation lookup: ${key}`);
      }

      return key;
    });

    const filter: Pick<Filter, 'id' | 'name' | 'labelIsPlainText'> = {
      id: FORBIDDEN_BI_KEY,
      name: FORBIDDEN_BI_KEY,
      labelIsPlainText: true,
    };

    expect(getSearchFilterLabel(filter, translator)).toBe(FORBIDDEN_BI_KEY);
    expect(translator).not.toHaveBeenCalled();
  });
});

describe('SearchFilter', () => {
  it('shows the applied-filter badge on the trigger when a count is provided', () => {
    render(
      <SearchFilter
        availableFilters={[]}
        activeFilters={{}}
        applyFacet={jest.fn()}
        applyRangeFacet={jest.fn()}
        applyAllFacets={jest.fn()}
        resetFacet={jest.fn()}
        resetAllFacets={jest.fn()}
        appliedFilterCount={3}
      />,
    );

    expect(screen.getByTestId('filter-toggleButton')).toHaveTextContent('3');
  });
});
