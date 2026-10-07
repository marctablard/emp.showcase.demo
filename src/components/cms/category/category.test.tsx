/**
 * Failing-test contract for the `category` CMS component.
 *
 * Category renders a product-category card: an optional banner, title and
 * description plus a link to the browse page for `emporix_category_id`. All
 * card fields are optional so the schema accepts the minimal id/type-only
 * payload, but rejects a malformed banner (missing `filename`) and wrong
 * discriminators. The component renders the title when present, spreads
 * `...rest` onto its root, and merges `className`.
 *
 * Co-located with the component, schema and barrel file they pin.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import Category, { type CategoryData, CategorySchema } from './index';

const MINIMAL: CategoryData = {
  id: 'cat-1',
  type: 'category',
};

const FULLY_POPULATED: CategoryData = {
  id: 'cat-2',
  type: 'category',
  title: 'Power tools',
  description: 'Drills, saws, sanders.',
  emporix_category_id: 'cat-001',
  banner: { filename: '/cat.png', alt: 'Tools' },
  highlight: true,
  site: 'main',
};

describe('Category — schema', () => {
  it('parses a minimal payload with only `id` and `type`', () => {
    const parsed = CategorySchema.parse(MINIMAL);

    expect(parsed.type).toBe('category');
    expect(parsed.title).toBeUndefined();
  });

  it('parses a fully populated payload', () => {
    const parsed = CategorySchema.parse(FULLY_POPULATED);

    expect(parsed.title).toBe('Power tools');
    expect(parsed.emporix_category_id).toBe('cat-001');
    expect(parsed.banner?.filename).toBe('/cat.png');
    expect(parsed.highlight).toBe(true);
  });

  it('rejects a banner without filename', () => {
    expect(() =>
      CategorySchema.parse({
        ...MINIMAL,
        banner: { alt: 'no-file' },
      }),
    ).toThrow();
  });

  it('rejects a wrong discriminator value', () => {
    expect(() =>
      CategorySchema.parse({
        id: 'cat-3',
        type: 'hero',
      }),
    ).toThrow();
  });
});

describe('Category — component', () => {
  it('renders the title as visible text when provided', () => {
    const { getByText } = render(<Category {...FULLY_POPULATED} />);

    expect(getByText('Power tools')).toBeInTheDocument();
  });

  it('spreads `data-testid` onto its root DOM element', () => {
    const { container } = render(<Category {...FULLY_POPULATED} data-testid="cms-category-root" />);

    expect(container.firstChild).toHaveAttribute('data-testid', 'cms-category-root');
  });

  it('merges incoming className with its own root classes (does not clobber)', () => {
    const { container } = render(<Category {...FULLY_POPULATED} className="extra-class" />);

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('extra-class');
  });
});
