/**
 * Failing-test contract for the `navigation` CMS component.
 *
 * This is the page-level `navigation` block rendered inline with the other
 * CMS components — distinct from the adapter-level `CMSNavigation` domain
 * shape (`src/platform/services/model/cms/navigation.d.ts`), which carries
 * the global navigation tree returned by `CMSService.getNavigation()`.
 *
 * The block renders a horizontal `<nav>` with mixed internal and external
 * entries. Each item carries an agnostic `id` (the wire mapper has already
 * renamed the CMS-leaked `_uid` to `id`), a required `title`, and either a
 * relative `slug` or an absolute `link`; `is_external` may be set
 * explicitly. The component spreads `...rest` onto its root and merges
 * `className`.
 *
 * Co-located with the implementation they pin.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import Navigation, { type NavigationData, NavigationSchema } from './index';

const VALID: NavigationData = {
  id: 'nav-1',
  type: 'navigation',
  items: [
    { id: 'i1', title: 'Home', slug: '' },
    { id: 'i2', title: 'Shop', slug: 'shop' },
    { id: 'i3', title: 'Docs', link: 'https://docs.example.com', is_external: true },
  ],
};

describe('Navigation — schema', () => {
  it('parses a minimal payload with no items', () => {
    const parsed = NavigationSchema.parse({
      id: 'nav-2',
      type: 'navigation',
    });

    expect(parsed.type).toBe('navigation');
    expect(parsed.items).toBeUndefined();
  });

  it('parses a payload with mixed internal and external items', () => {
    const parsed = NavigationSchema.parse(VALID);

    expect(parsed.items).toHaveLength(3);
    expect(parsed.items?.[2]?.is_external).toBe(true);
  });

  it('exposes each item under the agnostic `id` field, not `_uid`', () => {
    const parsed = NavigationSchema.parse(VALID);

    expect(parsed.items?.map((i) => i.id)).toEqual(['i1', 'i2', 'i3']);
    // The CMS-leaked `_uid` must not be part of the item shape.
    expect((parsed.items?.[0] as Record<string, unknown>)?._uid).toBeUndefined();
  });

  it('rejects an item without `id`', () => {
    expect(() =>
      NavigationSchema.parse({
        id: 'nav-3',
        type: 'navigation',
        items: [{ title: 'No id' }],
      }),
    ).toThrow();
  });

  it('rejects an item without `title`', () => {
    expect(() =>
      NavigationSchema.parse({
        id: 'nav-4',
        type: 'navigation',
        items: [{ id: 'i1' }],
      }),
    ).toThrow();
  });

  it('rejects a wrong discriminator value', () => {
    expect(() =>
      NavigationSchema.parse({
        id: 'nav-5',
        type: 'hero',
      }),
    ).toThrow();
  });
});

describe('Navigation — component', () => {
  it('renders a `<nav>` root element', () => {
    const { container } = render(<Navigation {...VALID} />);

    expect(container.querySelector('nav')).toBeInTheDocument();
  });

  it('renders one entry per item', () => {
    const { getAllByRole } = render(<Navigation {...VALID} />);

    const links = getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(VALID.items?.length ?? 0);
  });

  it('renders all items keyed by `id` without React duplicate-key warnings', () => {
    // Distinct `id`s must each produce an entry; a console.error from React
    // (duplicate / missing key) fails the contract.
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { getAllByRole } = render(<Navigation {...VALID} />);

    expect(getAllByRole('listitem')).toHaveLength(VALID.items?.length ?? 0);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('spreads `data-testid` onto its root DOM element', () => {
    const { container } = render(<Navigation {...VALID} data-testid="cms-navigation-root" />);

    expect(container.firstChild).toHaveAttribute('data-testid', 'cms-navigation-root');
  });

  it('merges incoming className with its own root classes (does not clobber)', () => {
    const { container } = render(<Navigation {...VALID} className="extra-class" />);

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('extra-class');
  });
});
