/**
 * Failing-test contract for the `page` CMS container.
 *
 * Page is the recursive-container pilot. Two concerns are exercised:
 *
 * 1. Recursive schema — `body[]` references the global discriminated union
 *    of all known CMS components via `z.lazy(...)`, so pages can nest other
 *    pages and the runtime accepts only registered discriminators.
 *    Validation runs transitively into nested children.
 *
 * 2. Component rendering — `Page` does NOT iterate `body[]` itself. It is a
 *    thin frame that renders React-native `children`; the renderer (or the
 *    active CMS adapter) iterates `body[]` and passes the resulting React
 *    elements via the `children` prop. The schema therefore carries the
 *    data; the component only frames it.
 *
 * The schema, component, and barrel file do not exist yet — these tests
 * are red until the co-located implementation lands.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import Page, { PageSchema } from './index';

describe('Page — schema (recursive)', () => {
  it('parses a minimal page with an empty `body`', () => {
    const parsed = PageSchema.parse({
      id: 'page-1',
      type: 'page',
      title: 'Home',
      body: [],
    });

    expect(parsed.type).toBe('page');
    expect(parsed.body).toEqual([]);
  });

  it('parses a page whose body contains heterogeneous registered components', () => {
    const parsed = PageSchema.parse({
      id: 'page-2',
      type: 'page',
      body: [
        { id: 'btn-1', type: 'button', title: 'Buy', link: '/buy' },
        { id: 'cb-1', type: 'content-block' },
      ],
    });

    expect(parsed.body).toHaveLength(2);
    expect(parsed.body[0]?.type).toBe('button');
  });

  it('parses a page nested inside another page (recursion through z.lazy)', () => {
    const parsed = PageSchema.parse({
      id: 'page-outer',
      type: 'page',
      body: [
        {
          id: 'page-inner',
          type: 'page',
          body: [{ id: 'btn-deep', type: 'button', title: 'Deep', link: '/deep' }],
        },
      ],
    });

    expect(parsed.body[0]?.type).toBe('page');
  });

  it('rejects a body entry with an unknown discriminator type', () => {
    expect(() =>
      PageSchema.parse({
        id: 'page-3',
        type: 'page',
        body: [{ id: 'x', type: 'totally-not-a-real-component' }],
      }),
    ).toThrow();
  });

  it('rejects a body entry whose required field is missing (transitive validation)', () => {
    expect(() =>
      PageSchema.parse({
        id: 'page-4',
        type: 'page',
        body: [
          // valid discriminator, but `title` is required for a button payload
          { id: 'btn-missing', type: 'button', link: '/no-title' },
        ],
      }),
    ).toThrow();
  });

  it('rejects payloads with a wrong discriminator value', () => {
    expect(() =>
      PageSchema.parse({
        id: 'page-5',
        type: 'button',
        body: [],
      }),
    ).toThrow();
  });
});

describe('Page — component (root contract)', () => {
  it('renders React children passed via the `children` prop inside the page wrapper', () => {
    const { getByText } = render(
      <Page id="p1" type="page" body={[]}>
        <span>nested content</span>
      </Page>,
    );

    expect(getByText('nested content')).toBeInTheDocument();
  });

  it('spreads `data-testid` onto its root DOM element', () => {
    const { container } = render(<Page id="p1" type="page" body={[]} data-testid="cms-page-root" />);

    expect(container.firstChild).toHaveAttribute('data-testid', 'cms-page-root');
  });

  it('merges incoming className with its own root classes (does not clobber)', () => {
    const { container } = render(<Page id="p1" type="page" body={[]} className="extra-class" />);

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('extra-class');
  });

  it('spreads `data-blok-*` editor attributes onto its root', () => {
    const { container } = render(
      <Page id="p1" type="page" body={[]} data-blok-c="page" data-blok-uid="editable-uid-pg" />,
    );

    const root = container.firstChild as HTMLElement;
    expect(root.dataset.blokC).toBe('page');
    expect(root.dataset.blokUid).toBe('editable-uid-pg');
  });
});
