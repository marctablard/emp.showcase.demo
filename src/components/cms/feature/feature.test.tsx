/**
 * Failing-test contract for the `feature` CMS component.
 *
 * Feature is one of the simplest two-string atoms (`name` + `description`).
 * The schema enforces both fields as required; the component renders both
 * as visible text on a single root DOM element that accepts spread
 * attributes and merges `className`.
 *
 * The component, schema, and barrel file do not exist yet — these tests are
 * red until the co-located implementation lands.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import Feature, { type FeatureData, FeatureSchema } from './index';

const VALID: FeatureData = {
  id: 'feat-1',
  type: 'feature',
  name: 'Lightning fast',
  description: 'Sub-second response times across the catalogue.',
};

describe('Feature — schema', () => {
  it('parses a valid payload', () => {
    const parsed = FeatureSchema.parse(VALID);

    expect(parsed.type).toBe('feature');
    expect(parsed.name).toBe('Lightning fast');
  });

  it('rejects payloads missing the required `name`', () => {
    expect(() =>
      FeatureSchema.parse({
        id: 'feat-2',
        type: 'feature',
        description: 'No name supplied',
      }),
    ).toThrow();
  });

  it('rejects payloads missing the required `description`', () => {
    expect(() =>
      FeatureSchema.parse({
        id: 'feat-3',
        type: 'feature',
        name: 'No description',
      }),
    ).toThrow();
  });

  it('rejects a wrong discriminator value', () => {
    expect(() =>
      FeatureSchema.parse({
        id: 'feat-4',
        type: 'hero',
        name: 'wrong',
        description: 'wrong',
      }),
    ).toThrow();
  });
});

describe('Feature — component', () => {
  it('renders the feature name as visible text', () => {
    const { getByText } = render(<Feature {...VALID} />);

    expect(getByText('Lightning fast')).toBeInTheDocument();
  });

  it('renders the feature description as visible text', () => {
    const { getByText } = render(<Feature {...VALID} />);

    expect(getByText('Sub-second response times across the catalogue.')).toBeInTheDocument();
  });

  it('spreads `data-testid` onto its root DOM element', () => {
    const { container } = render(<Feature {...VALID} data-testid="cms-feature-root" />);

    expect(container.firstChild).toHaveAttribute('data-testid', 'cms-feature-root');
  });

  it('merges incoming className with its own root classes (does not clobber)', () => {
    const { container } = render(<Feature {...VALID} className="extra-class" />);

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('extra-class');
  });
});
