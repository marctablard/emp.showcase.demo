'use client';

import { type CSSProperties, type RefObject, useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * Geometry and stepping of the comparison's horizontal scroller. The columns are measured, not
 * set: how many products are shown at once follows from the width actually available, so no
 * column is ever cut in half. Fixed column widths overflowed every desktop below ~1680px.
 */

/** Scrollport widths at the `md` and `sm` breakpoints: viewport minus the content padding. */
const LABEL_LEFT_MIN_WIDTH = 952;
const TABLET_MIN_WIDTH = 736;

/** Leading column holding the attribute names, used once it fits beside the products. */
const LABEL_COLUMN_WIDTH = 200;

/** Below this column width the card's buttons move below the price instead of beside it. */
const STACKED_CARD_MAX_WIDTH = 320;

/** Below this one the card also shortens its image area and tightens its padding. */
const COMPACT_CARD_MAX_WIDTH = 224;

/**
 * Widest a product column may become, so two products on a wide screen do not blow up into two
 * half-screen cards. The cap can only ever bind while every product is visible: as soon as one
 * does not fit, the fitting count keeps the quotient below it.
 */
const MAX_COLUMN_WIDTH = 360;

/** Sub-pixel column widths make exact scroll comparisons unreliable. */
const SCROLL_EPSILON = 1;

/**
 * How close to the edge of the visible area a separator may come before it is dropped. Covers the
 * few pixels the column rounding leaves over, so the last column's edge counts as an edge too.
 */
const SEPARATOR_EDGE_TOLERANCE = 4;

export type ComparisonLabelPlacement = 'left' | 'above';

export type ComparisonCardVariant = 'compact' | 'stacked' | 'roomy';

export interface ComparisonScroller {
  /** Callback ref: the measurement has to start over whenever the scroll element changes. */
  ref: (node: HTMLDivElement | null) => void;
  /** Left of the values from `md`, on its own line above them below that. */
  labelPlacement: ComparisonLabelPlacement;
  /** Products fitting side by side. */
  visibleCount: number;
  columnWidth: number;
  /** How much of the card fits the column it has been given. */
  cardVariant: ComparisonCardVariant;
  /** `--comparison-template`, `--comparison-label` and `--comparison-visible` for the scroll root. */
  style: CSSProperties;
  /**
   * Attach to an element that has to follow the scroller. Its transform is written in the scroll
   * event itself: going through React state would leave it a frame behind, which shows up as the
   * element visibly trailing the columns.
   */
  followerRef: RefObject<HTMLDivElement | null>;
  canScrollBack: boolean;
  canScrollForward: boolean;
  /** 1-based range currently in view, for the position indicator. */
  firstVisible: number;
  lastVisible: number;
  /** Moves the view by a single product, the way the arrows offer it. */
  scrollByColumn: (direction: -1 | 1) => void;
  /**
   * Whether the column at this index is preceded by a separator. Only between two visible products:
   * at the edge of the visible area the line reads as an outer frame rather than as a division, so
   * it is dropped there and comes back as soon as scrolling has moved it inwards.
   */
  hasSeparator: (columnIndex: number) => boolean;
}

/**
 * Narrowest a product column may become before the layout drops one. Below `sm` the card stacks
 * its buttons under the price and gets by with less; from `md` a column also carries the widest
 * attribute values.
 */
function minColumnWidth(containerWidth: number): number {
  if (containerWidth >= LABEL_LEFT_MIN_WIDTH) return 240;
  return containerWidth >= TABLET_MIN_WIDTH ? 224 : 160;
}

function cardVariantFor(columnWidth: number): ComparisonCardVariant {
  if (columnWidth < COMPACT_CARD_MAX_WIDTH) return 'compact';
  return columnWidth < STACKED_CARD_MAX_WIDTH ? 'stacked' : 'roomy';
}

export function useComparisonScroller(productCount: number): ComparisonScroller {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  // Typed to the element it is actually attached to: `RefObject` is invariant, so a wider
  // `HTMLElement` would not be assignable to a `div`'s `ref`.
  const follower = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Before paint, so the first commit already has the real width and no wrong column count is
  // ever shown. The view renders a spinner until hydration, so this never runs on the server.
  useLayoutEffect(() => {
    if (!element) return;

    const followScroller = () => {
      const node = follower.current;
      if (node) node.style.transform = `translateX(${-element.scrollLeft}px)`;
    };

    const measure = () => {
      setContainerWidth(element.clientWidth);
      setScrollLeft(element.scrollLeft);
    };

    measure();
    followScroller();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(element);

    let frame = 0;
    const handleScroll = () => {
      followScroller();

      // Only the arrows and the position indicator go through React, coalesced into a frame.
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setScrollLeft(element.scrollLeft);
      });
    };

    element.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      resizeObserver.disconnect();
      element.removeEventListener('scroll', handleScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [element]);

  const columnCount = Math.max(productCount, 1);
  const measured = containerWidth > 0;
  const labelPlacement: ComparisonLabelPlacement = containerWidth >= LABEL_LEFT_MIN_WIDTH ? 'left' : 'above';
  const labelWidth = labelPlacement === 'left' ? LABEL_COLUMN_WIDTH : 0;
  const minColumn = minColumnWidth(containerWidth);
  const track = Math.max(containerWidth - labelWidth, minColumn);
  const visibleCount = Math.min(Math.max(1, Math.floor(track / minColumn)), columnCount);
  // Whole pixels, so the 1px separators land on a pixel boundary instead of being smeared across
  // two of them.
  const evenColumn = Math.floor(track / visibleCount);
  const columnWidth = measured ? Math.min(evenColumn, MAX_COLUMN_WIDTH) : 0;

  /**
   * What the rounding leaves over goes to the last column, which makes the furthest scroll position
   * a whole number of columns. Otherwise the final slide stops those few pixels short and leaves a
   * sliver of the previous column standing at the edge.
   */
  const remainder = measured && columnWidth === evenColumn ? track - visibleCount * columnWidth : 0;

  // Before the first measurement the columns keep their previous fixed width — the view is not
  // painted yet, but a browser without a ResizeObserver still gets a usable comparison.
  const columnSize = measured ? `${columnWidth}px` : '20rem';
  const lastColumnSize = measured ? `${columnWidth + remainder}px` : '20rem';
  const template = [
    labelPlacement === 'left' ? `${labelWidth}px` : '',
    columnCount > 1 ? `repeat(${columnCount - 1}, ${columnSize})` : '',
    lastColumnSize,
  ]
    .filter(Boolean)
    .join(' ');

  const contentWidth = labelWidth + (columnCount - 1) * columnWidth + columnWidth + remainder;
  const maxScroll = Math.max(0, contentWidth - containerWidth);

  // One product per step rather than a whole page: with three or four columns in view, paging
  // replaces the entire set at once and the customer loses the product they were comparing
  // against. A single column keeps the overlap.
  const scrollByColumn = useCallback(
    (direction: -1 | 1) => {
      // Asked at click time, not once at module scope: the setting can change while the page is open.
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

      element?.scrollBy({ left: direction * columnWidth, behavior: reducedMotion ? 'auto' : 'smooth' });
    },
    [element, columnWidth],
  );

  const hasSeparator = useCallback(
    (columnIndex: number) => {
      if (!measured) return false;

      // Where the column's leading edge currently sits inside the scrollport.
      const offset = labelWidth + columnIndex * columnWidth - scrollLeft;

      return offset > labelWidth + SEPARATOR_EDGE_TOLERANCE && offset < containerWidth - SEPARATOR_EDGE_TOLERANCE;
    },
    [measured, labelWidth, columnWidth, scrollLeft, containerWidth],
  );

  // Snapping lands the first visible product's edge on the scrollport, so the offset is a whole
  // number of columns — which is what makes the range readable off the scroll position.
  const firstVisible = columnWidth > 0 ? Math.min(columnCount, Math.round(scrollLeft / columnWidth) + 1) : 1;

  return {
    ref: setElement,
    labelPlacement,
    visibleCount,
    columnWidth,
    cardVariant: cardVariantFor(measured ? columnWidth : STACKED_CARD_MAX_WIDTH),
    style: {
      '--comparison-template': template,
      '--comparison-label': `${labelWidth}px`,
      // The visible width, for content that has to centre on what can be seen rather than on the
      // scrollable width — the latter reaches past the viewport as soon as a product does not fit.
      ...(measured ? { '--comparison-visible': `${containerWidth}px` } : {}),
    } as CSSProperties,
    followerRef: follower,
    canScrollBack: measured && scrollLeft > SCROLL_EPSILON,
    canScrollForward: measured && scrollLeft < maxScroll - SCROLL_EPSILON,
    firstVisible,
    lastVisible: Math.min(columnCount, firstVisible + visibleCount - 1),
    scrollByColumn,
    hasSeparator,
  };
}
