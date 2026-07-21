import { act, renderHook } from '@testing-library/react';
import { breakpoints, useBreakpoint } from './useBreakpoint';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
}

describe('useBreakpoint', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    setViewportWidth(originalInnerWidth);
  });

  // Regression coverage for the account shell: the persistent account rail relies on
  // useBreakpoint('md') to stay visible at 1024px, matching the Figma-specified breakpoint.
  it('returns true at the md breakpoint boundary (1024px), keeping the account rail visible', () => {
    setViewportWidth(breakpoints.md);

    const { result } = renderHook(() => useBreakpoint('md'));

    expect(result.current).toBe(true);
  });

  it('returns false just below the md breakpoint (1023px), so the off-canvas menu is used', () => {
    setViewportWidth(breakpoints.md - 1);

    const { result } = renderHook(() => useBreakpoint('md'));

    expect(result.current).toBe(false);
  });

  it('updates when the viewport is resized across the md breakpoint', () => {
    setViewportWidth(breakpoints.md - 1);

    const { result } = renderHook(() => useBreakpoint('md'));
    expect(result.current).toBe(false);

    act(() => {
      setViewportWidth(breakpoints.md);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(true);
  });
});
