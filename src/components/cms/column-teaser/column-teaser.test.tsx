/**
 * Failing-test contract for the `column-teaser` CMS component.
 *
 * Column-teaser is the multi-image case: one `main_image` plus up to three
 * `side_images`. Each image carries an optional `link` and an optional
 * `title` overlay. All fields are optional so the schema accepts the
 * minimal id/type-only payload, but rejects an image without `filename` and
 * wrong discriminators. The component spreads `...rest` onto its root and
 * merges `className`.
 *
 * The component, schema, and barrel file do not exist yet — these tests are
 * red until the co-located implementation lands.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import ColumnTeaser, { type ColumnTeaserData, ColumnTeaserSchema } from './index';

const MINIMAL: ColumnTeaserData = {
  id: 'ct-1',
  type: 'column-teaser',
};

const POPULATED: ColumnTeaserData = {
  id: 'ct-2',
  type: 'column-teaser',
  main_image: { filename: '/main.png', alt: 'Main', link: '/main', title: 'Main' },
  side_images: [{ filename: '/s1.png' }, { filename: '/s2.png', link: '/s2' }, { filename: '/s3.png', title: 'Third' }],
};

describe('ColumnTeaser — schema', () => {
  it('parses a minimal payload with only `id` and `type`', () => {
    const parsed = ColumnTeaserSchema.parse(MINIMAL);

    expect(parsed.type).toBe('column-teaser');
    expect(parsed.main_image).toBeUndefined();
  });

  it('parses a fully populated payload', () => {
    const parsed = ColumnTeaserSchema.parse(POPULATED);

    expect(parsed.main_image?.filename).toBe('/main.png');
    expect(parsed.side_images).toHaveLength(3);
    expect(parsed.side_images?.[1]?.link).toBe('/s2');
  });

  it('rejects a side image without filename', () => {
    expect(() =>
      ColumnTeaserSchema.parse({
        ...MINIMAL,
        side_images: [{ alt: 'no-file' }],
      }),
    ).toThrow();
  });

  it('rejects a wrong discriminator value', () => {
    expect(() =>
      ColumnTeaserSchema.parse({
        id: 'ct-3',
        type: 'hero',
      }),
    ).toThrow();
  });
});

describe('ColumnTeaser — component', () => {
  it('spreads `data-testid` onto its root DOM element', () => {
    const { container } = render(<ColumnTeaser {...POPULATED} data-testid="cms-column-teaser-root" />);

    expect(container.firstChild).toHaveAttribute('data-testid', 'cms-column-teaser-root');
  });

  it('merges incoming className with its own root classes (does not clobber)', () => {
    const { container } = render(<ColumnTeaser {...POPULATED} className="extra-class" />);

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('extra-class');
  });
});

describe('ColumnTeaser — CMS editable attributes', () => {
  it('spreads data-blok-* attributes onto its root when the CMS wires them', () => {
    const { container } = render(
      <ColumnTeaser {...POPULATED} data-blok-c="column_teaser" data-blok-uid="editable-uid-ct" />,
    );

    const root = container.firstChild as HTMLElement;
    expect(root.dataset.blokC).toBe('column_teaser');
    expect(root.dataset.blokUid).toBe('editable-uid-ct');
  });
});

describe('ColumnTeaser — XSS sanitisation', () => {
  it('sanitises a javascript: image link — rendered anchor href must not contain the scheme', () => {
    const xssData: ColumnTeaserData = {
      id: 'ct-xss',
      type: 'column-teaser',
      main_image: { filename: '/main.png', link: 'javascript:alert(1)' },
    };
    const { container } = render(<ColumnTeaser {...xssData} />);
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).not.toMatch(/javascript:/i);
  });
});
