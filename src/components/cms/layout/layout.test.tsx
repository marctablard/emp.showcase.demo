/**
 * Acceptance contract for the `layout` CMS container.
 *
 * Layout is the per-page frame fetched via `CmsAdapter.getLayout`. Three
 * concerns are exercised:
 *
 * 1. Recursive schema (`LayoutSchema`) — `body[]` references the global
 *    discriminated union via `z.lazy(...)`, so a layout can hold any known
 *    component, including the `content-slot` placeholder and nested
 *    containers. Validation runs transitively.
 *
 * 2. Single-slot invariant (`LayoutContentSchema`) — a valid layout contains
 *    EXACTLY ONE `content-slot`, counted transitively through nested
 *    containers. Zero or two slots are rejected.
 *
 * 3. Component render — like `page`, `Layout` does not iterate `body[]`; it
 *    frames the React `children` the renderer supplies.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import Layout, { LayoutContentSchema, LayoutSchema } from './index';

describe('Layout — schema (recursive)', () => {
  it('parses a minimal layout with an empty body', () => {
    const parsed = LayoutSchema.parse({ id: 'lay-1', type: 'layout', body: [] });
    expect(parsed.type).toBe('layout');
    expect(parsed.body).toEqual([]);
  });

  it('parses the canonical 3-component frame (top-banner-announcement + content-slot + navigation)', () => {
    const parsed = LayoutSchema.parse({
      id: 'lay-frame',
      type: 'layout',
      body: [
        {
          id: 'banner-1',
          type: 'top-banner-announcement',
          title: 'Free shipping',
          link: { id: 'l1', url: '/offers', target: '_self' },
          is_active: true,
        },
        { id: 'slot-1', type: 'content-slot' },
        { id: 'nav-1', type: 'navigation' },
      ],
    });

    expect(parsed.body.map((c) => c.type)).toEqual(['top-banner-announcement', 'content-slot', 'navigation']);
  });

  it('rejects a body entry with an unknown discriminator type', () => {
    expect(() => LayoutSchema.parse({ id: 'lay-x', type: 'layout', body: [{ id: 'x', type: 'not-real' }] })).toThrow();
  });
});

describe('LayoutContentSchema — exactly one content-slot (transitive)', () => {
  const slot = { id: 's', type: 'content-slot' };
  const banner = {
    id: 'b',
    type: 'top-banner-announcement',
    title: 'x',
    link: { id: 'l', url: '/', target: '_self' },
    is_active: true,
  };

  it('accepts a layout with exactly one direct content-slot', () => {
    expect(() => LayoutContentSchema.parse({ id: 'l', type: 'layout', body: [banner, slot] })).not.toThrow();
  });

  it('accepts a layout whose single content-slot is nested transitively inside a container', () => {
    const parsed = LayoutContentSchema.parse({
      id: 'l',
      type: 'layout',
      body: [{ id: 'cols', type: 'columns', columns: [slot] }],
    });
    expect(parsed.type).toBe('layout');
  });

  it('REFUSES a layout with no content-slot', () => {
    expect(() => LayoutContentSchema.parse({ id: 'l', type: 'layout', body: [banner] })).toThrow();
  });

  it('REFUSES a layout with two content-slots', () => {
    expect(() =>
      LayoutContentSchema.parse({ id: 'l', type: 'layout', body: [slot, { id: 's2', type: 'content-slot' }] }),
    ).toThrow();
  });

  it('REFUSES a layout with two content-slots spread across nested containers (transitive)', () => {
    expect(() =>
      LayoutContentSchema.parse({
        id: 'l',
        type: 'layout',
        body: [slot, { id: 'cols', type: 'columns', columns: [{ id: 's2', type: 'content-slot' }] }],
      }),
    ).toThrow();
  });
});

describe('Layout — component (children-prop render)', () => {
  it('renders React children passed via the children prop', () => {
    const { getByText } = render(
      <Layout id="l1" type="layout" body={[]}>
        <span>framed content</span>
      </Layout>,
    );
    expect(getByText('framed content')).toBeInTheDocument();
  });

  it('spreads data-testid onto its root element', () => {
    const { container } = render(<Layout id="l1" type="layout" body={[]} data-testid="cms-layout-root" />);
    expect(container.firstChild).toHaveAttribute('data-testid', 'cms-layout-root');
  });

  it('merges incoming className with its own root classes', () => {
    const { container } = render(<Layout id="l1" type="layout" body={[]} className="extra-class" />);
    expect(container.firstChild).toHaveClass('extra-class');
  });
});
