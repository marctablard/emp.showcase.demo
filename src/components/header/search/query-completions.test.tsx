/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { NoResults } from './no-results';
import { QueryCompletions } from './query-completions';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/hooks/history/useHistory', () => ({
  __esModule: true,
  default: () => ({
    searchHistory: [],
    clearSearchHistory: jest.fn(),
  }),
}));

describe('header search selection sanitization', () => {
  it('strips mark tags before updating the query completion selection', () => {
    const setQuery = jest.fn();
    const onQuerySelect = jest.fn();

    render(
      <QueryCompletions
        isProductsShown
        queryCompletions={['<mark>solar</mark> panel']}
        setQuery={setQuery}
        onQuerySelect={onQuerySelect}
        query="solar"
      />,
    );

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(setQuery).toHaveBeenCalledWith('solar panel');
    expect(onQuerySelect).toHaveBeenCalledWith('solar panel');
  });

  it('strips mark tags before storing a no-results completion', () => {
    const setQuery = jest.fn();
    const onQuerySelect = jest.fn();

    render(
      <NoResults queryCompletions={['<mark>solar</mark> panel']} setQuery={setQuery} onQuerySelect={onQuerySelect} />,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(setQuery).toHaveBeenCalledWith('solar panel');
    expect(onQuerySelect).toHaveBeenCalledWith('solar panel');
  });
});
