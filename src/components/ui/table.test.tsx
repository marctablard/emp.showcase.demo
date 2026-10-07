/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { Table, TableBody, TableCard, TableCell, TableHead, TableHeader, TableRow } from './table';

describe('Table', () => {
  it('renders semantic table structure with an overflow-safe container', () => {
    render(
      <Table containerClassName="custom-container" data-testid="account-table">
        <TableHeader>
          <TableRow>
            <TableHead aria-sort="ascending">Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Example</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const table = screen.getByRole('table');
    const container = table.closest('[data-slot="table-container"]');

    expect(table).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'ascending');
    expect(container).toHaveClass('relative', 'w-full', 'max-w-full', 'overflow-x-auto', 'custom-container');
  });

  it('supports an optional card shell without changing the underlying table semantics', () => {
    render(
      <Table card data-testid="account-table-card">
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Ready</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const card = screen.getByTestId('account-table-card').closest('[data-slot="table-card"]');
    const table = screen.getByRole('table');

    expect(card).toBeInTheDocument();
    expect(table).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
  });
});

describe('TableCard', () => {
  it('applies the centralized Figma-aligned shadow token instead of the generic shadow-sm utility', () => {
    const { container } = render(<TableCard>content</TableCard>);

    const card = container.querySelector('[data-slot="table-card"]');
    expect(card).not.toBeNull();
    expect(card).toHaveClass(
      'bg-surface-primary',
      'border',
      'border-border-primary',
      'rounded-md',
      'shadow-[var(--theme-shadow-sm)]',
    );
    expect(card).not.toHaveClass('shadow-sm');
  });

  it('keeps border, radius, and responsive padding unchanged alongside the shadow token', () => {
    const { container } = render(<TableCard>content</TableCard>);

    const card = container.querySelector('[data-slot="table-card"]');
    expect(card).toHaveClass('p-4', 'min-[768px]:p-6');
  });

  it('does not add a domain-specific shadow override when a caller passes an additional className', () => {
    const { container } = render(<TableCard className="extra-class">content</TableCard>);

    const card = container.querySelector('[data-slot="table-card"]');
    expect(card).toHaveClass('shadow-[var(--theme-shadow-sm)]', 'extra-class');
    expect(card).not.toHaveClass('shadow-sm');
  });
});
