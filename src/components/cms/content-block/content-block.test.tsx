/**
 * Failing-test contract for the `content-block` CMS component.
 *
 * Content-block is the typical mid-complexity pilot with no special cases —
 * string-only required identity, several optional structured fields, plus
 * a bounded `style` literal-union. Exercises both shape and enum
 * validation, and verifies the root-element spread contract.
 *
 * The schema, component, and barrel file do not exist yet — these tests
 * are red until the co-located implementation lands.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import ContentBlock, { type ContentBlockData, ContentBlockSchema } from './index';

const MINIMAL: ContentBlockData = {
  id: 'cb-1',
  type: 'content-block',
};

describe('ContentBlock — schema', () => {
  it('parses a minimal payload with only `id` and `type`', () => {
    const parsed = ContentBlockSchema.parse(MINIMAL);

    expect(parsed.type).toBe('content-block');
    expect(parsed.title).toBeUndefined();
  });

  it('accepts all optional fields when fully populated', () => {
    const parsed = ContentBlockSchema.parse({
      id: 'cb-2',
      type: 'content-block',
      title: 'Featured',
      description: 'A featured block.',
      images: [{ filename: '/img.png', alt: 'pic' }],
      background_image: { filename: '/bg.png' },
      button: { name: 'More', link: '/more', is_external: false },
      style: 'vignette',
    });

    expect(parsed.style).toBe('vignette');
    expect(parsed.images).toHaveLength(1);
    expect(parsed.button?.name).toBe('More');
  });

  it('rejects an unknown `style` literal value', () => {
    expect(() =>
      ContentBlockSchema.parse({
        ...MINIMAL,
        style: 'splashy',
      }),
    ).toThrow();
  });

  it('rejects payloads with a wrong discriminator value', () => {
    expect(() =>
      ContentBlockSchema.parse({
        id: 'cb-3',
        type: 'hero',
      }),
    ).toThrow();
  });
});

describe('ContentBlock — component', () => {
  it('renders the title as visible text when provided', () => {
    const { getByText } = render(<ContentBlock {...MINIMAL} title="Featured" />);

    expect(getByText('Featured')).toBeInTheDocument();
  });

  it('spreads `data-testid` onto its root DOM element', () => {
    const { container } = render(<ContentBlock {...MINIMAL} data-testid="cms-content-block-root" />);

    expect(container.firstChild).toHaveAttribute('data-testid', 'cms-content-block-root');
  });

  it('merges incoming className with its own root classes (does not clobber)', () => {
    const { container } = render(<ContentBlock {...MINIMAL} className="extra-class" />);

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('extra-class');
  });

  it('spreads `data-blok-*` editor attributes onto its root', () => {
    const { container } = render(
      <ContentBlock {...MINIMAL} data-blok-c="content-block" data-blok-uid="editable-uid-cb" />,
    );

    const root = container.firstChild as HTMLElement;
    expect(root.dataset.blokC).toBe('content-block');
    expect(root.dataset.blokUid).toBe('editable-uid-cb');
  });

  it('sanitises a javascript: button link — rendered anchor href must not contain the scheme', () => {
    const { container } = render(
      <ContentBlock {...MINIMAL} button={{ name: 'XSS', link: 'javascript:alert(1)', is_external: false }} />,
    );
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).not.toMatch(/javascript:/i);
  });
});
