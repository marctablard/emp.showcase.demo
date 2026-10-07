/**
 * Failing-test contract for the `columns` CMS container.
 *
 * Columns is a recursive container: `columns[]` references the global
 * discriminated union via `z.lazy(...)`, so a column entry can be any known
 * CMS component — including another `columns` (or `page`, `grid`, etc.).
 * Validation runs transitively into the nested children.
 *
 * The component is a thin wrapper around `props.children` — the caller
 * iterates the `columns[]` data and supplies the resolved React elements
 * via the `children` prop (same children-prop pattern as `page` and
 * `segment`). Each direct child is wrapped in a `flex-1` cell.
 *
 * Co-located with the implementation they pin.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import Columns, { ColumnsSchema } from './index';

describe('Columns — schema (recursive)', () => {
  it('parses a minimal payload with an empty / missing `columns`', () => {
    const parsed = ColumnsSchema.parse({
      id: 'col-1',
      type: 'columns',
    });

    expect(parsed.type).toBe('columns');
    expect(parsed.columns).toBeUndefined();
  });

  it('parses heterogeneous nested known components inside `columns[]`', () => {
    const parsed = ColumnsSchema.parse({
      id: 'col-2',
      type: 'columns',
      columns: [
        { id: 'btn-1', type: 'button', title: 'Buy', link: '/buy' },
        { id: 'cb-1', type: 'content-block' },
      ],
    });

    expect(parsed.columns).toHaveLength(2);
    expect(parsed.columns?.[0]?.type).toBe('button');
  });

  it('parses a columns-in-columns recursion via z.lazy', () => {
    const parsed = ColumnsSchema.parse({
      id: 'col-outer',
      type: 'columns',
      columns: [
        {
          id: 'col-inner',
          type: 'columns',
          columns: [{ id: 'btn-deep', type: 'button', title: 'Deep', link: '/deep' }],
        },
      ],
    });

    expect(parsed.columns?.[0]?.type).toBe('columns');
  });

  it('rejects a `columns[]` entry with an unknown discriminator type', () => {
    expect(() =>
      ColumnsSchema.parse({
        id: 'col-3',
        type: 'columns',
        columns: [{ id: 'x', type: 'totally-not-a-real-component' }],
      }),
    ).toThrow();
  });

  it('rejects a `columns[]` entry whose required field is missing (transitive)', () => {
    expect(() =>
      ColumnsSchema.parse({
        id: 'col-4',
        type: 'columns',
        columns: [{ id: 'btn-missing', type: 'button', link: '/no-title' }],
      }),
    ).toThrow();
  });
});

describe('Columns — component (children-prop render)', () => {
  it('renders React children passed via the `children` prop inside the columns wrapper', () => {
    const { getByText } = render(
      <Columns id="c1" type="columns">
        <span>nested content</span>
      </Columns>,
    );

    expect(getByText('nested content')).toBeInTheDocument();
  });

  it('wraps every direct child in a `flex-1` cell', () => {
    const { container } = render(
      <Columns id="c1" type="columns">
        <span data-testid="child-a">A</span>
        <span data-testid="child-b">B</span>
      </Columns>,
    );

    const root = container.firstChild as HTMLElement;
    // Two children -> two `flex-1` cells, each containing exactly one of
    // the supplied span children.
    const cells = root.querySelectorAll(':scope > .flex-1');
    expect(cells).toHaveLength(2);
    expect(cells[0]?.querySelector('[data-testid="child-a"]')).not.toBeNull();
    expect(cells[1]?.querySelector('[data-testid="child-b"]')).not.toBeNull();
  });

  it('spreads `data-testid` onto its root DOM element', () => {
    const { container } = render(<Columns id="c1" type="columns" data-testid="cms-columns-root" />);

    expect(container.firstChild).toHaveAttribute('data-testid', 'cms-columns-root');
  });

  it('merges incoming className with its own root classes (does not clobber)', () => {
    const { container } = render(<Columns id="c1" type="columns" className="extra-class" />);

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('extra-class');
  });
});
