import { breakpoints } from '@/lib/breakpoints';
import { type ScrollPinMeasurement, resolveScrollPin } from './useElementScroll';

const cleared = { isFixed: false, isFixedToTop: false, isContainerBottom: false };
const pinned = { isFixed: true, isFixedToTop: true, isContainerBottom: false };

function measurement(overrides: Partial<ScrollPinMeasurement> = {}): ScrollPinMeasurement {
  return {
    width: breakpoints.lg,
    windowHeight: 900,
    containerHeight: 200,
    containerTop: 80,
    containerBottom: 300,
    contentTop: 40,
    contentBottom: 800,
    contentHeight: 700,
    ...overrides,
  };
}

describe('resolveScrollPin', () => {
  it('clears a fixed summary below the lg breakpoint', () => {
    expect(resolveScrollPin(pinned, measurement({ width: breakpoints.lg - 1 }), 112)).toEqual(cleared);
  });

  it('clears a fixed summary when the summary is taller than the list', () => {
    expect(resolveScrollPin(pinned, measurement({ containerHeight: 800, contentHeight: 400 }), 112)).toEqual(cleared);
  });

  it('clears a fixed summary when the viewport is shorter than the summary', () => {
    expect(resolveScrollPin(pinned, measurement({ windowHeight: 180, containerHeight: 200 }), 112)).toEqual(cleared);
  });

  it('clears a fixed summary that would extend past the viewport below the top offset', () => {
    expect(
      resolveScrollPin(pinned, measurement({ windowHeight: 900, containerHeight: 850, contentHeight: 1200 }), 112),
    ).toEqual(cleared);
  });

  it('pins when the summary has scrolled above the offset and the list still extends below', () => {
    expect(
      resolveScrollPin(
        cleared,
        measurement({ containerTop: -20, contentTop: -400, containerBottom: 200, contentBottom: 900 }),
        112,
      ),
    ).toEqual(pinned);
  });

  it('pins to the top once the summary reaches the offset and the list continues below', () => {
    expect(resolveScrollPin(cleared, measurement({ containerTop: 112 }), 112)).toEqual(pinned);
  });

  it('drops the fixed flag when the list has scrolled past the summary', () => {
    expect(resolveScrollPin(pinned, measurement({ contentTop: 200, containerTop: 112 }), 112)).toEqual({
      isFixed: false,
      isFixedToTop: true,
      isContainerBottom: false,
    });
  });

  it('releases a bottom pin when the fixed box is still below the offset and the list extends past it', () => {
    const bottomPinned = { isFixed: true, isFixedToTop: false, isContainerBottom: true };
    expect(
      resolveScrollPin(
        bottomPinned,
        measurement({
          containerTop: 660,
          containerBottom: 884,
          contentTop: 180,
          contentBottom: 1400,
        }),
        112,
      ),
    ).toEqual(cleared);
  });
});
