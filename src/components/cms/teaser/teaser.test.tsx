/**
 * Failing-test contract for the `teaser` CMS component.
 *
 * Teaser is the simplest mid-render atom — a single optional headline. The
 * schema must accept the minimal id/type-only payload and reject wrong
 * discriminators. The component spreads `...rest` and merges `className`.
 *
 * The component, schema, and barrel file do not exist yet — these tests are
 * red until the co-located implementation lands.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import Teaser, { type TeaserData, TeaserSchema } from './index';

const MINIMAL: TeaserData = {
  id: 'tsr-1',
  type: 'teaser',
};

const WITH_HEADLINE: TeaserData = {
  id: 'tsr-2',
  type: 'teaser',
  headline: 'Big news',
};

describe('Teaser — schema', () => {
  it('parses a minimal payload with only `id` and `type`', () => {
    const parsed = TeaserSchema.parse(MINIMAL);

    expect(parsed.type).toBe('teaser');
    expect(parsed.headline).toBeUndefined();
  });

  it('accepts an optional headline when present', () => {
    const parsed = TeaserSchema.parse(WITH_HEADLINE);

    expect(parsed.headline).toBe('Big news');
  });

  it('rejects a wrong discriminator value', () => {
    expect(() =>
      TeaserSchema.parse({
        id: 'tsr-3',
        type: 'hero',
      }),
    ).toThrow();
  });
});

describe('Teaser — component', () => {
  it('spreads `data-testid` onto its root DOM element', () => {
    const { container } = render(<Teaser {...MINIMAL} data-testid="cms-teaser-root" />);

    expect(container.firstChild).toHaveAttribute('data-testid', 'cms-teaser-root');
  });

  it('merges incoming className with its own root classes (does not clobber)', () => {
    const { container } = render(<Teaser {...MINIMAL} className="extra-class" />);

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('extra-class');
  });
});
