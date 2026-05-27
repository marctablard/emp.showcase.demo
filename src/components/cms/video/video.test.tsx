/**
 * Failing-test contract for the `video` CMS component.
 *
 * `VideoSchema` is the wire-format source of truth: `video_file` is a
 * nested object carrying `{ filename, alt }`, while the playback flags
 * (`autoplay`, `loop`, `mute`, `controls`) and `alt_text` are top-level
 * optionals. The `hero` and `media-text` components reference this schema
 * directly so the shape needs to stay stable and validate end-to-end.
 *
 * The component, schema, and barrel file do not exist yet — these tests are
 * red until the co-located implementation lands.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import Video, { type VideoData, VideoSchema } from './index';

const MINIMAL: VideoData = {
  id: 'vid-1',
  type: 'video',
  video_file: { filename: '/clip.mp4' },
};

const FULLY_POPULATED: VideoData = {
  id: 'vid-2',
  type: 'video',
  video_file: { filename: '/clip.mp4', alt: 'A short clip' },
  autoplay: true,
  loop: false,
  mute: true,
  controls: true,
  alt_text: 'A short clip',
};

describe('Video — schema', () => {
  it('parses a minimal payload with only the required nested `video_file`', () => {
    const parsed = VideoSchema.parse(MINIMAL);

    expect(parsed.type).toBe('video');
    expect(parsed.video_file.filename).toBe('/clip.mp4');
    expect(parsed.autoplay).toBeUndefined();
  });

  it('accepts every playback flag and alt-text field when populated', () => {
    const parsed = VideoSchema.parse(FULLY_POPULATED);

    expect(parsed.autoplay).toBe(true);
    expect(parsed.loop).toBe(false);
    expect(parsed.mute).toBe(true);
    expect(parsed.controls).toBe(true);
    expect(parsed.alt_text).toBe('A short clip');
    expect(parsed.video_file.alt).toBe('A short clip');
  });

  it('rejects payloads missing the nested `video_file`', () => {
    expect(() =>
      VideoSchema.parse({
        id: 'vid-3',
        type: 'video',
      }),
    ).toThrow();
  });

  it('rejects payloads where `video_file.filename` is missing', () => {
    expect(() =>
      VideoSchema.parse({
        id: 'vid-4',
        type: 'video',
        video_file: { alt: 'no-file' },
      }),
    ).toThrow();
  });

  it('rejects a wrong discriminator value', () => {
    expect(() =>
      VideoSchema.parse({
        id: 'vid-5',
        type: 'hero',
        video_file: { filename: '/x.mp4' },
      }),
    ).toThrow();
  });
});

describe('Video — component', () => {
  it('spreads `data-testid` onto its root DOM element', () => {
    const { container } = render(<Video {...MINIMAL} data-testid="cms-video-root" />);

    expect(container.firstChild).toHaveAttribute('data-testid', 'cms-video-root');
  });

  it('merges incoming className with its own root classes (does not clobber)', () => {
    const { container } = render(<Video {...MINIMAL} className="extra-class" />);

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('extra-class');
  });
});
