/**
 * @jest-environment jsdom
 *
 * The hook derives the whole comparison layout from one measurement, so these cases pin the
 * geometry per viewport: how many products fit, how wide a column ends up, where the attribute
 * labels go and when paging is offered. jsdom has no layout — the element's widths are stubbed.
 */
import type { RefObject } from 'react';
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import { useComparisonScroller } from './useComparisonScroller';

let clientWidth = 0;
let scrollLeft = 0;
const scrollBy = jest.fn();

class ResizeObserverMock {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

beforeAll(() => {
  Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ResizeObserverMock });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => clientWidth });
  Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
    configurable: true,
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = value;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollBy', { configurable: true, value: scrollBy });
  // The scroll handler coalesces into a frame; run it straight away so `act` sees the update.
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  }) as typeof window.requestAnimationFrame;
});

function Harness({ products }: { products: number }) {
  const {
    ref,
    followerRef,
    style,
    labelPlacement,
    visibleCount,
    columnWidth,
    cardVariant,
    canScrollBack,
    canScrollForward,
    firstVisible,
    lastVisible,
    scrollByColumn,
    hasSeparator,
  } = useComparisonScroller(products);

  return (
    <>
      <div
        ref={ref}
        data-testid="area"
        style={style}
        data-placement={labelPlacement}
        data-visible={visibleCount}
        data-column={Math.round(columnWidth)}
        data-variant={cardVariant}
        data-back={String(canScrollBack)}
        data-forward={String(canScrollForward)}
        data-range={`${firstVisible}-${lastVisible}`}
        // One digit per column: whether a separator precedes it.
        data-separators={Array.from({ length: products }, (_, index) => (hasSeparator(index) ? '1' : '0')).join('')}
        onClick={() => scrollByColumn(1)}
      />
      {/* Stands in for the name strip, which sits outside the scroller and has to follow it. */}
      <div ref={followerRef} data-testid="follower" />
    </>
  );
}

async function mount(width: number, products: number) {
  clientWidth = width;
  scrollLeft = 0;
  render(<Harness products={products} />);
  await act(async () => {});

  return screen.getByTestId('area');
}

beforeEach(() => {
  scrollBy.mockClear();
});

describe('useComparisonScroller', () => {
  it('shows two columns and the labels above them on a phone', async () => {
    const area = await mount(343, 4);

    expect(area.dataset.placement).toBe('above');
    expect(area.dataset.visible).toBe('2');
    // A 152px label column would have left barely half a product visible next to it.
    expect(area.dataset.column).toBe('171');
    expect(area.dataset.variant).toBe('compact');
    expect(area.dataset.forward).toBe('true');
    expect(area.dataset.back).toBe('false');
    expect(area.dataset.range).toBe('1-2');
  });

  it('shows three columns on a tablet, still without a label column', async () => {
    const area = await mount(736, 4);

    expect(area.dataset.placement).toBe('above');
    expect(area.dataset.visible).toBe('3');
    expect(area.dataset.column).toBe('245');
    // Room for the whole card, but not for the buttons beside the price.
    expect(area.dataset.variant).toBe('stacked');
    expect(area.dataset.forward).toBe('true');
  });

  it('puts the labels into a column of their own from the desktop breakpoint', async () => {
    const area = await mount(952, 4);

    expect(area.dataset.placement).toBe('left');
    expect(area.dataset.visible).toBe('3');
    expect(area.dataset.column).toBe('250');
    expect(area.dataset.range).toBe('1-3');
    expect(area.dataset.forward).toBe('true');
  });

  it('fits all four products from 1280px, where the old fixed columns overflowed', async () => {
    const area = await mount(1208, 4);

    expect(area.dataset.visible).toBe('4');
    expect(area.dataset.column).toBe('252');
    // Nothing to page to, so the bar offers no arrows.
    expect(area.dataset.back).toBe('false');
    expect(area.dataset.forward).toBe('false');
  });

  it('caps the column width so two products do not blow up on a wide screen', async () => {
    const area = await mount(1848, 2);

    expect(area.dataset.visible).toBe('2');
    expect(area.dataset.column).toBe('360');
    expect(area.dataset.variant).toBe('roomy');
    // The cap only ever binds while everything is visible.
    expect(area.dataset.forward).toBe('false');
  });

  it('publishes the track list the rows lay out on', async () => {
    const area = await mount(1208, 4);

    // 1208px of scrollport minus the 200px label column, split four ways with nothing left over.
    expect(area.getAttribute('style')).toContain('--comparison-template: 200px repeat(3, 252px) 252px');
    expect(area.getAttribute('style')).toContain('--comparison-label: 200px');
  });

  it('leaves the label track out of the list where the labels sit above the values', async () => {
    const area = await mount(343, 4);

    // 343px over two visible columns leaves a pixel, which the last column takes: that keeps the
    // furthest scroll position a whole number of columns.
    expect(area.getAttribute('style')).toContain('--comparison-template: repeat(3, 171px) 172px');
    expect(area.getAttribute('style')).toContain('--comparison-label: 0px');
  });

  it('reports the visible range and the possible directions from the scroll offset', async () => {
    const area = await mount(343, 4);

    await act(async () => {
      // Two whole columns — the furthest the four products can be scrolled.
      area.scrollLeft = 342;
      area.dispatchEvent(new Event('scroll'));
    });

    expect(area.dataset.range).toBe('3-4');
    expect(area.dataset.back).toBe('true');
    // The end of the scroll is a whole number of columns, so it is reached exactly here.
    expect(area.dataset.forward).toBe('false');
  });

  it('drops the animation where the visitor asked for less motion', async () => {
    const matchMedia = jest.fn().mockReturnValue({ matches: true });
    // @ts-expect-error jsdom does not implement matchMedia; the hook guards for exactly that.
    window.matchMedia = matchMedia;
    const area = await mount(952, 4);

    act(() => {
      area.click();
    });

    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(scrollBy).toHaveBeenCalledWith({ left: 250, behavior: 'auto' });
    // @ts-expect-error restore the jsdom default for the remaining cases
    window.matchMedia = undefined;
  });

  it('advances by a single product, so the previous one stays in view', async () => {
    const area = await mount(952, 4);

    act(() => {
      area.click();
    });

    // One column, not the whole set of three.
    expect(scrollBy).toHaveBeenCalledWith({ left: 250, behavior: 'smooth' });
  });

  it('separates visible products from each other but never at the edges of the view', async () => {
    const area = await mount(343, 4);

    // Products 1 and 2 in view: only the line between them, none at either edge.
    expect(area.dataset.separators).toBe('0100');

    await act(async () => {
      area.scrollLeft = 171;
      area.dispatchEvent(new Event('scroll'));
    });

    // Slid to products 2 and 3: the line that just sat on the right edge is now between them.
    expect(area.dataset.separators).toBe('0010');

    await act(async () => {
      area.scrollLeft = 342;
      area.dispatchEvent(new Event('scroll'));
    });

    expect(area.dataset.separators).toBe('0001');
  });

  it('leaves the label column unlined, since the values are set off by their area anyway', async () => {
    const area = await mount(952, 4);

    // Three products in view: lines between them, none at the label column and none at the right
    // edge, where the fourth product's column begins.
    expect(area.dataset.separators).toBe('0110');
  });

  it('moves a follower in the scroll event itself, so it cannot trail the columns', async () => {
    const area = await mount(343, 4);

    expect(screen.getByTestId('follower').style.transform).toBe('translateX(0px)');

    await act(async () => {
      area.scrollLeft = 343;
      area.dispatchEvent(new Event('scroll'));
    });

    // Written straight from the event: going through React state would leave it a frame behind.
    expect(screen.getByTestId('follower').style.transform).toBe('translateX(-343px)');
  });
});
