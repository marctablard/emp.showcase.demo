/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { TablePagination } from './table-pagination';

describe('TablePagination', () => {
  it('hides itself for a single page and keeps pagination affordances absent', () => {
    const { container } = render(
      <TablePagination
        currentPage={1}
        totalPages={1}
        pageIndicator="Page 1 of 1"
        previousLabel="Previous"
        nextLabel="Next"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the current page indicator and only the enabled navigation controls', () => {
    render(
      <TablePagination
        currentPage={2}
        totalPages={4}
        pageIndicator="Page 2 of 4"
        previousLabel="Previous"
        nextLabel="Next"
        onPreviousPage={jest.fn()}
        onNextPage={jest.fn()}
      />,
    );

    expect(screen.getByText('Page 2 of 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('omits previous or next navigation when the corresponding affordance is unavailable', () => {
    const { rerender } = render(
      <TablePagination
        currentPage={1}
        totalPages={3}
        pageIndicator="Page 1 of 3"
        previousLabel="Previous"
        nextLabel="Next"
        onNextPage={jest.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();

    rerender(
      <TablePagination
        currentPage={3}
        totalPages={3}
        pageIndicator="Page 3 of 3"
        previousLabel="Previous"
        nextLabel="Next"
        onPreviousPage={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });

  it('does not render navigation buttons when handlers are absent even for multi-page state', () => {
    render(
      <TablePagination
        currentPage={2}
        totalPages={4}
        pageIndicator="Page 2 of 4"
        previousLabel="Previous"
        nextLabel="Next"
      />,
    );

    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });
});
