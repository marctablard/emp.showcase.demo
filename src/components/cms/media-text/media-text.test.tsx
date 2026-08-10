/**
 * Failing-test contract for the `media-text` CMS component.
 *
 * Media-text references the shared rich-text editor schema
 * (`TextEditorDataSchema` from `../_shared/text-editor.schema`), the
 * `ButtonSchema`, and the `VideoSchema`. Required fields are `headline`,
 * `text`, `image` and `image_position` (`'Left' | 'Right'`); `overline`,
 * `main_button`, `video` and `has_background` are optional. The component
 * renders the headline as visible text, spreads `...rest` onto its root,
 * and merges `className`.
 *
 * Co-located with the implementation they pin.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import MediaText, { type MediaTextData, MediaTextSchema } from './index';

const VALID: MediaTextData = {
  id: 'mt-1',
  type: 'media-text',
  headline: 'Discover the new line',
  text: { content: [{ type: 'paragraph', content: [{ text: 'Now in stock.' }] }] },
  image: { filename: '/mt.png', alt: 'Promo' },
  image_position: 'Right',
};

describe('MediaText — schema', () => {
  it('parses a valid payload with only the required fields', () => {
    const parsed = MediaTextSchema.parse(VALID);

    expect(parsed.type).toBe('media-text');
    expect(parsed.headline).toBe('Discover the new line');
    expect(parsed.image_position).toBe('Right');
  });

  it('accepts optional overline, main_button, video, has_background when present', () => {
    const parsed = MediaTextSchema.parse({
      ...VALID,
      overline: 'New season',
      main_button: [{ id: 'b1', type: 'button', title: 'Shop', link: '/shop' }],
      video: [{ id: 'v1', type: 'video', video_file: { filename: '/mt.mp4' }, autoplay: false, controls: true }],
      has_background: true,
      image_position: 'Left',
    });

    expect(parsed.overline).toBe('New season');
    expect(parsed.main_button?.[0]?.title).toBe('Shop');
    expect(parsed.video?.[0]?.video_file.filename).toBe('/mt.mp4');
    expect(parsed.has_background).toBe(true);
    expect(parsed.image_position).toBe('Left');
  });

  it('rejects an unknown `image_position` literal', () => {
    expect(() =>
      MediaTextSchema.parse({
        ...VALID,
        image_position: 'Top',
      }),
    ).toThrow();
  });

  it('rejects payloads missing required `headline`', () => {
    const { headline: _unused, ...withoutHeadline } = VALID;

    expect(() => MediaTextSchema.parse(withoutHeadline)).toThrow();
  });

  it('rejects payloads missing required `image`', () => {
    const { image: _unused, ...withoutImage } = VALID;

    expect(() => MediaTextSchema.parse(withoutImage)).toThrow();
  });

  it('rejects a wrong discriminator value', () => {
    expect(() =>
      MediaTextSchema.parse({
        ...VALID,
        type: 'hero',
      }),
    ).toThrow();
  });
});

describe('MediaText — component', () => {
  it('renders the headline as visible text', () => {
    const { getByText } = render(<MediaText {...VALID} />);

    expect(getByText('Discover the new line')).toBeInTheDocument();
  });

  it('spreads `data-testid` onto its root DOM element', () => {
    const { container } = render(<MediaText {...VALID} data-testid="cms-media-text-root" />);

    expect(container.firstChild).toHaveAttribute('data-testid', 'cms-media-text-root');
  });

  it('merges incoming className with its own root classes (does not clobber)', () => {
    const { container } = render(<MediaText {...VALID} className="extra-class" />);

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('extra-class');
  });
});
