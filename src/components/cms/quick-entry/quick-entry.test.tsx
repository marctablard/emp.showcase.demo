/**
 * Failing-test contract for the `quick-entry` CMS component.
 *
 * Quick-entry renders a horizontal strip of "icon + title + link" tiles by
 * iterating its `elements[]`. Each element carries a `title`, `link`,
 * `link_name` and an `icon` name; the schema requires every element field
 * and rejects malformed entries. The component renders each element's title
 * as visible text, spreads `...rest` onto its root, and merges `className`.
 *
 * The component, schema, and barrel file do not exist yet — these tests are
 * red until the co-located implementation lands.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import QuickEntry, { type QuickEntryData, QuickEntrySchema } from './index';

const VALID: QuickEntryData = {
  id: 'qe-1',
  type: 'quick-entry',
  elements: [
    { title: 'Reorder', link: '/reorder', link_name: 'Go', icon: 'ShoppingCart' },
    { title: 'Lookup', link: '/lookup', link_name: 'Find', icon: 'ScanSearch' },
  ],
};

describe('QuickEntry — schema', () => {
  it('parses a valid payload with multiple elements', () => {
    const parsed = QuickEntrySchema.parse(VALID);

    expect(parsed.type).toBe('quick-entry');
    expect(parsed.elements).toHaveLength(2);
    expect(parsed.elements[0]?.icon).toBe('ShoppingCart');
  });

  it('parses an empty `elements` array', () => {
    const parsed = QuickEntrySchema.parse({
      id: 'qe-2',
      type: 'quick-entry',
      elements: [],
    });

    expect(parsed.elements).toEqual([]);
  });

  it('rejects an element with a missing required field', () => {
    expect(() =>
      QuickEntrySchema.parse({
        id: 'qe-3',
        type: 'quick-entry',
        elements: [{ title: 'No link', link_name: 'Go', icon: 'Gauge' }],
      }),
    ).toThrow();
  });

  it('rejects a wrong discriminator value', () => {
    expect(() =>
      QuickEntrySchema.parse({
        id: 'qe-4',
        type: 'hero',
        elements: [],
      }),
    ).toThrow();
  });
});

describe('QuickEntry — component', () => {
  it('renders each element title as visible text', () => {
    const { getByText } = render(<QuickEntry {...VALID} />);

    expect(getByText('Reorder')).toBeInTheDocument();
    expect(getByText('Lookup')).toBeInTheDocument();
  });

  it('spreads `data-testid` onto its root DOM element', () => {
    const { container } = render(<QuickEntry {...VALID} data-testid="cms-quick-entry-root" />);

    expect(container.firstChild).toHaveAttribute('data-testid', 'cms-quick-entry-root');
  });

  it('merges incoming className with its own root classes (does not clobber)', () => {
    const { container } = render(<QuickEntry {...VALID} className="extra-class" />);

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('extra-class');
  });
});

describe('QuickEntry — CMS editable attributes', () => {
  it('spreads data-blok-* attributes onto its root when the CMS wires them', () => {
    const { container } = render(<QuickEntry {...VALID} data-blok-c="quick_entry" data-blok-uid="editable-uid-456" />);

    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('data-blok-c')).toBe('quick_entry');
    expect(root.getAttribute('data-blok-uid')).toBe('editable-uid-456');
  });
});

describe('QuickEntry — XSS sanitisation', () => {
  it('sanitises a javascript: element link — rendered anchor href must not contain the scheme', () => {
    const xssData = {
      ...VALID,
      elements: [{ title: 'XSS', link: 'javascript:alert(1)', link_name: 'Go', icon: 'ShoppingCart' as const }],
    };
    const { container } = render(<QuickEntry {...xssData} />);
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).not.toMatch(/javascript:/i);
  });
});
