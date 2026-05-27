/**
 * Failing-test contract for the `logo` CMS component.
 *
 * Logo is one of the simplest atoms — a single optional image with optional
 * alt-text override. The schema must accept the minimal id/type-only payload
 * (logo can render nothing when image is absent) and reject wrong
 * discriminators. The component spreads `...rest` onto its root and merges
 * `className`.
 *
 * The component, schema, and barrel file do not exist yet — these tests are
 * red until the co-located implementation lands.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import Logo, { type LogoData, LogoSchema } from './index';

const MINIMAL: LogoData = {
  id: 'logo-1',
  type: 'logo',
};

const VALID_WITH_IMAGE: LogoData = {
  id: 'logo-2',
  type: 'logo',
  image: { filename: '/logo.svg', alt: 'Brand logo' },
  alt_text: 'Brand',
};

describe('Logo — schema', () => {
  it('parses a minimal payload with only `id` and `type`', () => {
    const parsed = LogoSchema.parse(MINIMAL);

    expect(parsed.type).toBe('logo');
    expect(parsed.image).toBeUndefined();
  });

  it('accepts an image and alt_text when present', () => {
    const parsed = LogoSchema.parse(VALID_WITH_IMAGE);

    expect(parsed.image?.filename).toBe('/logo.svg');
    expect(parsed.alt_text).toBe('Brand');
  });

  it('rejects a wrong discriminator value', () => {
    expect(() =>
      LogoSchema.parse({
        id: 'logo-3',
        type: 'hero',
      }),
    ).toThrow();
  });

  it('rejects an image without a filename', () => {
    expect(() =>
      LogoSchema.parse({
        id: 'logo-4',
        type: 'logo',
        image: { alt: 'no-file' },
      }),
    ).toThrow();
  });
});

describe('Logo — component', () => {
  it('spreads `data-testid` onto its root DOM element', () => {
    const { container } = render(<Logo {...VALID_WITH_IMAGE} data-testid="cms-logo-root" />);

    expect(container.firstChild).toHaveAttribute('data-testid', 'cms-logo-root');
  });

  it('merges incoming className with its own root classes (does not clobber)', () => {
    const { container } = render(<Logo {...VALID_WITH_IMAGE} className="extra-class" />);

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('extra-class');
  });
});

describe('Logo — CMS editable attributes', () => {
  it('spreads data-blok-* attributes onto its root when the CMS wires them', () => {
    const { container } = render(<Logo {...VALID_WITH_IMAGE} data-blok-c="logo" data-blok-uid="editable-uid-123" />);

    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('data-blok-c')).toBe('logo');
    expect(root.getAttribute('data-blok-uid')).toBe('editable-uid-123');
  });
});
