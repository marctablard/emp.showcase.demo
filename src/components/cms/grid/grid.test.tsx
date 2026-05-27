/**
 * Failing-test contract for the `grid` CMS container.
 *
 * Grid is a recursive container: `columns[]` references the global
 * discriminated union via `z.lazy(...)`, so a grid entry can be any known
 * CMS component — including another `grid` (or `page`, `columns`, etc.).
 * Validation runs transitively into the nested children. The CMS wire
 * format names the field `columns` (not `grid` or `cells`); the schema
 * preserves that name.
 *
 * The component is a thin wrapper around `props.children` — the caller
 * iterates the `columns[]` data and supplies the resolved React elements
 * via the `children` prop (same children-prop pattern as `page`, `segment`
 * and `columns`).
 *
 * The schema, component, and barrel file do not exist yet — these tests are
 * red until the co-located implementation lands.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import Grid, { GridSchema } from './index';

describe('Grid — schema (recursive)', () => {
  it('parses a minimal payload with an empty / missing `columns`', () => {
    const parsed = GridSchema.parse({
      id: 'grd-1',
      type: 'grid',
    });

    expect(parsed.type).toBe('grid');
    expect(parsed.columns).toBeUndefined();
  });

  it('parses heterogeneous nested known components inside `columns[]`', () => {
    const parsed = GridSchema.parse({
      id: 'grd-2',
      type: 'grid',
      columns: [
        { id: 'btn-1', type: 'button', title: 'Buy', link: '/buy' },
        { id: 'feat-1', type: 'feature', name: 'F', description: 'D' },
      ],
    });

    expect(parsed.columns).toHaveLength(2);
    expect(parsed.columns?.[1]?.type).toBe('feature');
  });

  it('parses a grid-in-grid recursion via z.lazy', () => {
    const parsed = GridSchema.parse({
      id: 'grd-outer',
      type: 'grid',
      columns: [
        {
          id: 'grd-inner',
          type: 'grid',
          columns: [{ id: 'btn-deep', type: 'button', title: 'Deep', link: '/deep' }],
        },
      ],
    });

    expect(parsed.columns?.[0]?.type).toBe('grid');
  });

  it('rejects a `columns[]` entry with an unknown discriminator type', () => {
    expect(() =>
      GridSchema.parse({
        id: 'grd-3',
        type: 'grid',
        columns: [{ id: 'x', type: 'totally-not-a-real-component' }],
      }),
    ).toThrow();
  });

  it('rejects a `columns[]` entry whose required field is missing (transitive)', () => {
    expect(() =>
      GridSchema.parse({
        id: 'grd-4',
        type: 'grid',
        columns: [{ id: 'btn-missing', type: 'button', link: '/no-title' }],
      }),
    ).toThrow();
  });
});

describe('Grid — component (children-prop render)', () => {
  it('renders React children passed via the `children` prop inside the grid wrapper', () => {
    const { getByText } = render(
      <Grid id="g1" type="grid">
        <span>nested content</span>
      </Grid>,
    );

    expect(getByText('nested content')).toBeInTheDocument();
  });

  it('spreads `data-testid` onto its root DOM element', () => {
    const { container } = render(<Grid id="g1" type="grid" data-testid="cms-grid-root" />);

    expect(container.firstChild).toHaveAttribute('data-testid', 'cms-grid-root');
  });

  it('merges incoming className with its own root classes (does not clobber)', () => {
    const { container } = render(<Grid id="g1" type="grid" className="extra-class" />);

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('extra-class');
  });
});
