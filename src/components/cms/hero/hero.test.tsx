/**
 * Failing-test contract for the `hero` CMS component.
 *
 * Hero is the medium-complexity pilot: nested image/video objects, an
 * embedded text editor payload, and an optional nested `main_button` array
 * of button-shaped payloads. The schema therefore catches both shallow
 * and deeply nested validation regressions.
 *
 * Co-located with the implementation they pin.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import Hero, { type HeroData, HeroSchema } from './index';

const VALID_HERO: HeroData = {
  id: 'hero-1',
  type: 'hero',
  headline: 'Welcome',
  text: {
    content: [
      {
        type: 'paragraph',
        content: [{ text: 'Sub-headline copy.' }],
      },
    ],
  },
  image: { filename: '/hero.png', alt: 'Hero image' },
};

describe('Hero — schema', () => {
  it('parses a valid hero payload with only required fields', () => {
    const parsed = HeroSchema.parse(VALID_HERO);

    expect(parsed.type).toBe('hero');
    expect(parsed.headline).toBe('Welcome');
    expect(parsed.image.filename).toBe('/hero.png');
  });

  it('accepts optional main_button and video arrays when present', () => {
    const parsed = HeroSchema.parse({
      ...VALID_HERO,
      main_button: [{ id: 'b1', type: 'button', title: 'Shop', link: '/shop' }],
      video: [{ id: 'v1', type: 'video', video_file: { filename: '/hero.mp4' }, autoplay: true }],
    });

    expect(parsed.main_button?.[0]?.title).toBe('Shop');
    expect(parsed.video?.[0]?.autoplay).toBe(true);
    expect(parsed.video?.[0]?.video_file.filename).toBe('/hero.mp4');
  });

  it('rejects payloads missing the required `image` field', () => {
    const { image: _unused, ...withoutImage } = VALID_HERO;

    expect(() => HeroSchema.parse(withoutImage)).toThrow();
  });

  it('rejects payloads where `text` is not the expected nested editor shape', () => {
    expect(() =>
      HeroSchema.parse({
        ...VALID_HERO,
        text: 'Sub-headline copy.',
      }),
    ).toThrow();
  });

  it('rejects payloads with a wrong discriminator value', () => {
    expect(() =>
      HeroSchema.parse({
        ...VALID_HERO,
        type: 'button',
      }),
    ).toThrow();
  });
});

const VALID_HERO_WITH_VIDEO: HeroData = {
  ...VALID_HERO,
  video: [{ id: 'v1', type: 'video', video_file: { filename: '/hero.mp4' }, autoplay: false }],
};

describe('Hero — useEffect: video "ended" listener lifecycle', () => {
  it('registers at most one "ended" listener per mount (no accumulation on re-renders)', () => {
    const addSpy = jest.fn();
    const removeSpy = jest.fn();

    const mockVideo = { addEventListener: addSpy, removeEventListener: removeSpy };
    jest.spyOn(HTMLDivElement.prototype, 'querySelector').mockReturnValue(mockVideo as unknown as Element);

    const { rerender } = render(<Hero {...VALID_HERO_WITH_VIDEO} />);
    rerender(<Hero {...VALID_HERO_WITH_VIDEO} headline="Re-render 1" />);
    rerender(<Hero {...VALID_HERO_WITH_VIDEO} headline="Re-render 2" />);

    // addEventListener('ended', ...) must be called exactly once (empty dep array)
    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(addSpy).toHaveBeenCalledWith('ended', expect.any(Function));

    jest.restoreAllMocks();
  });

  it('calls removeEventListener on unmount (no listener leak)', () => {
    const addSpy = jest.fn();
    const removeSpy = jest.fn();

    const mockVideo = { addEventListener: addSpy, removeEventListener: removeSpy };
    jest.spyOn(HTMLDivElement.prototype, 'querySelector').mockReturnValue(mockVideo as unknown as Element);

    const { unmount } = render(<Hero {...VALID_HERO_WITH_VIDEO} />);
    unmount();

    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledWith('ended', expect.any(Function));

    jest.restoreAllMocks();
  });
});

describe('Hero — component', () => {
  it('renders the hero headline as visible text', () => {
    const { getByText } = render(<Hero {...VALID_HERO} />);

    expect(getByText('Welcome')).toBeInTheDocument();
  });

  it('spreads `data-testid` onto its root DOM element', () => {
    const { container } = render(<Hero {...VALID_HERO} data-testid="cms-hero-root" />);

    expect(container.firstChild).toHaveAttribute('data-testid', 'cms-hero-root');
  });

  it('merges incoming className with its own root classes (does not clobber)', () => {
    const { container } = render(<Hero {...VALID_HERO} className="extra-class" />);

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('extra-class');
  });

  it('spreads `data-blok-*` editor attributes onto its root', () => {
    const { container } = render(<Hero {...VALID_HERO} data-blok-c="hero" data-blok-uid="editable-uid-hero" />);

    const root = container.firstChild as HTMLElement;
    expect(root.dataset.blokC).toBe('hero');
    expect(root.dataset.blokUid).toBe('editable-uid-hero');
  });
});
