/**
 * Row geometry of the comparison, shared by the product row and every attribute block. The two are
 * separate components but form one grid — a card has to sit exactly above its own values — so both
 * lay out on the same track list. `useComparisonScroller` measures it and publishes it as a CSS
 * variable on the scroll root; the fallback covers the commit before the first measurement.
 */
export const COMPARISON_ROW = 'grid [grid-template-columns:var(--comparison-template,repeat(4,20rem))]';

/**
 * Sticky positioning for the label column and the corner above it. The fill comes from the caller
 * and has to be opaque, or the products slide through the label while it stays put.
 */
export const COMPARISON_STICKY_LABEL = 'sticky left-0 z-10';
