/**
 * Behaviour coverage for the `media-text-media` client island.
 *
 * The island renders the cover image and, when a video with controls is
 * present (and not autoplaying), an overlaid play button. Clicking that
 * button drives a `useRef`-based reveal: it starts the underlying
 * `<video>`, hides the cover image, unhides the hidden video container and
 * removes the play control.
 *
 * jsdom does not implement `HTMLMediaElement.play`, so it is stubbed to a
 * resolved no-op spy. Only that browser API is faked — the island, the
 * `<Video>` child and `next/image` render for real.
 */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import MediaTextMedia from './media-text-media';
import type { MediaTextData } from './schema';

const IMAGE: MediaTextData['image'] = { filename: '/cover.png', alt: 'Cover' };

const VIDEO_WITH_CONTROLS: NonNullable<MediaTextData['video']> = [
  {
    id: 'v1',
    type: 'video',
    video_file: { filename: '/clip.mp4' },
    autoplay: false,
    controls: true,
  },
];

let playSpy: jest.SpyInstance;

beforeAll(() => {
  // jsdom has no media playback; stub so the play path does not throw.
  playSpy = jest.spyOn(globalThis.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
});

afterEach(() => {
  playSpy.mockClear();
});

afterAll(() => {
  playSpy.mockRestore();
});

describe('MediaTextMedia — image-only', () => {
  it('renders nothing when no image is supplied', () => {
    // image is required by the schema, but the island guards against a
    // missing value at runtime — pin that graceful no-op.
    const { container } = render(<MediaTextMedia image={undefined as unknown as MediaTextData['image']} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders the cover image and no play control when no video is supplied', () => {
    const { container } = render(<MediaTextMedia image={IMAGE} />);

    expect(container.querySelector('img')).toBeInTheDocument();
    expect(container.querySelector('video')).not.toBeInTheDocument();
    expect(container.querySelector('.cursor-pointer')).not.toBeInTheDocument();
  });
});

describe('MediaTextMedia — video play path', () => {
  it('renders the video element and an overlaid play control when a controllable video is present', () => {
    const { container } = render(<MediaTextMedia image={IMAGE} video={VIDEO_WITH_CONTROLS} />);

    expect(container.querySelector('video')).toBeInTheDocument();
    expect(container.querySelector('.cursor-pointer')).toBeInTheDocument();
  });

  it('starts the video and reveals it on play-control click', () => {
    const { container } = render(<MediaTextMedia image={IMAGE} video={VIDEO_WITH_CONTROLS} />);

    const playControl = container.querySelector('.cursor-pointer') as HTMLElement;
    const videoContainer = playControl.closest('div.relative') as HTMLElement;
    // The video player wrapper starts hidden.
    const playerWrapper = container.querySelector('video')?.closest('div.hidden') as HTMLElement;
    expect(playerWrapper).toBeInTheDocument();

    fireEvent.click(playControl);

    expect(playSpy).toHaveBeenCalledTimes(1);
    // Cover image gets hidden, player wrapper unhidden, control hidden.
    expect(videoContainer.querySelector('img')).toHaveClass('hidden');
    expect(playerWrapper).not.toHaveClass('hidden');
    expect(playControl).toHaveClass('hidden');
  });

  it('does not render a play control for an autoplaying video', () => {
    const autoplayVideo: NonNullable<MediaTextData['video']> = [{ ...VIDEO_WITH_CONTROLS[0]!, autoplay: true }];

    const { container } = render(<MediaTextMedia image={IMAGE} video={autoplayVideo} />);

    // Autoplay suppresses both the cover image and the manual play control.
    expect(container.querySelector('video')).toBeInTheDocument();
    expect(container.querySelector('.cursor-pointer')).not.toBeInTheDocument();
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });
});
