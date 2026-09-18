/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { useScrolledBehind } from './useScrolledBehind';

class ResizeObserverMock {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

beforeAll(() => {
  Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ResizeObserverMock });
  // The check is coalesced into a frame; run it straight away so `act` sees the update.
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  }) as typeof window.requestAnimationFrame;
});

/** jsdom has no layout, so the only thing that matters here is stubbed: the bottom edge. */
function elementWithBottom(bottom: number) {
  const element = document.createElement('div');
  element.getBoundingClientRect = () => ({ bottom }) as DOMRect;
  return element;
}

function mount(targetBottom: number, barrierBottom: number, lead?: number) {
  const rendered = renderHook(() => useScrolledBehind(lead));
  const target = elementWithBottom(targetBottom);

  act(() => {
    rendered.result.current.targetRef(target);
    rendered.result.current.barrierRef(elementWithBottom(barrierBottom));
  });

  return { ...rendered, target };
}

describe('useScrolledBehind', () => {
  it('is false while the target still reaches below the barrier', () => {
    const { result } = mount(400, 120);

    expect(result.current.behind).toBe(false);
  });

  it('is true once the target ends above the barrier', () => {
    const { result } = mount(80, 120);

    expect(result.current.behind).toBe(true);
  });

  it('waits for the elements instead of answering at mount', () => {
    const { result } = renderHook(() => useScrolledBehind());

    // The comparison renders a spinner first: at mount there is nothing to measure yet.
    expect(result.current.behind).toBe(false);

    act(() => {
      result.current.targetRef(elementWithBottom(20));
      result.current.barrierRef(elementWithBottom(120));
    });

    expect(result.current.behind).toBe(true);
  });

  it('re-answers on scroll instead of once on mount', () => {
    const { result, target } = mount(400, 120);

    expect(result.current.behind).toBe(false);

    target.getBoundingClientRect = () => ({ bottom: 20 }) as DOMRect;
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.behind).toBe(true);
  });

  it('answers a lead early, so a replacement is there before the original is gone', () => {
    // The comparison reveals its name strip about a price block before the cards have fully left.
    const { result } = mount(200, 120, 96);

    // 200 is below the barrier, but within the lead — without it this would still be false.
    expect(result.current.behind).toBe(true);
  });

  it('coalesces a burst of events into one frame and cancels a pending one on unmount', () => {
    // A deferred frame instead of the synchronous stub the other cases use: what matters here is
    // what happens while one is still outstanding.
    const pending: FrameRequestCallback[] = [];
    const request = jest.fn((callback: FrameRequestCallback) => {
      pending.push(callback);
      return 42;
    });
    const cancel = jest.fn();
    const previousRequest = window.requestAnimationFrame;
    const previousCancel = window.cancelAnimationFrame;
    window.requestAnimationFrame = request as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = cancel as typeof window.cancelAnimationFrame;

    try {
      const { unmount } = mount(400, 120);

      act(() => {
        window.dispatchEvent(new Event('scroll'));
        window.dispatchEvent(new Event('scroll'));
      });

      // One frame from the initial check, and none while it is still outstanding — a fling scroll
      // fires the event on every frame and would otherwise queue one measurement per event.
      expect(request).toHaveBeenCalledTimes(1);
      expect(pending).toHaveLength(1);

      unmount();

      // The outstanding frame would otherwise measure a torn-down component.
      expect(cancel).toHaveBeenCalledWith(42);
    } finally {
      window.requestAnimationFrame = previousRequest;
      window.cancelAnimationFrame = previousCancel;
    }
  });

  it('drops its listeners when unmounted', () => {
    const removeEventListener = jest.spyOn(window, 'removeEventListener');
    const { unmount } = mount(400, 120);

    unmount();

    expect(removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true });
    removeEventListener.mockRestore();
  });
});
