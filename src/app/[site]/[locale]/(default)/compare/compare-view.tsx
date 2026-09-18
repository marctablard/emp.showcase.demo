'use client';

import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { COMPARISON_ROW, COMPARISON_STICKY_LABEL } from '@/components/comparison/comparison-columns';
import { ComparisonNameStrip } from '@/components/comparison/comparison-name-strip';
import { ComparisonProductCard } from '@/components/comparison/comparison-product-card';
import { ComparisonScrollControls } from '@/components/comparison/comparison-scroll-controls';
import { ComparisonTable } from '@/components/comparison/comparison-table';
import { Button } from '@/components/ui/button';
import { H1, H2 } from '@/components/ui/h';
import { Spinner } from '@/components/ui/spinner';
import { useIsHydrated } from '@/hooks/common/useIsHydrated';
import { useScrolledBehind } from '@/hooks/common/useScrolledBehind';
import { useComparison } from '@/hooks/comparison/useComparison';
import { useComparisonScroller } from '@/hooks/comparison/useComparisonScroller';
import { useProducts } from '@/hooks/product/useProducts';
import { Link, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { ProductFetchOptions } from '@/platform/services/product';

/**
 * The cards show the struck reference price, which is only filled when the product itself is
 * fetched with prices. Module-level so the options keep a stable identity.
 */
const COMPARISON_FETCH_OPTIONS: ProductFetchOptions = { prices: true };

/**
 * How early the name strip takes over from the cards, in pixels. Roughly the card's price block:
 * the names are there before the last sliver of the card it belongs to is gone.
 */
const NAME_STRIP_LEAD = 96;

export function CompareView() {
  const t = useTranslations('comparison');
  const { productIds, count, removeProduct } = useComparison();

  // The comparison hangs off a store persisted in `localStorage` that the server does not know.
  // Render the neutral loading state until mount, or hydration breaks — documented on the hook.
  const hydrated = useIsHydrated();
  const router = useRouter();
  const { products, loading } = useProducts(productIds, COMPARISON_FETCH_OPTIONS);
  const {
    ref: scrollAreaRef,
    followerRef: nameStripRowRef,
    style: geometryStyle,
    labelPlacement,
    cardVariant,
    canScrollBack,
    canScrollForward,
    firstVisible,
    lastVisible,
    scrollByColumn,
    hasSeparator,
  } = useComparisonScroller(products.length);

  // Once the cards are gone behind the bar, the strip below it takes over naming the columns.
  const {
    targetRef: productsRowRef,
    barrierRef: stickyBarRef,
    behind: namesVisible,
  } = useScrolledBehind(NAME_STRIP_LEAD);

  const handleClose = () => {
    // Prefer returning to the previous page; fall back to /browse when the compare page
    // was opened directly (no in-app history to go back to).
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/browse');
    }
  };

  if (!hydrated) {
    return (
      <div className="w-full content-container py-12 flex justify-center">
        <Spinner variant="lg" />
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="w-full content-container py-12 text-center">
        <H1 variant="h4">{t('title')}</H1>
        <p className="mt-4 text-text-on-disabled">{t('emptyState')}</p>
        <Link
          href="/browse"
          className="mt-6 inline-flex items-center justify-center rounded-button bg-surface-action px-6 py-3 text-text-on-action"
        >
          {t('emptyStateAction')}
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full content-container py-12 flex justify-center">
        <Spinner variant="lg" />
      </div>
    );
  }

  return (
    // The geometry sits on the outermost element, not on the scroll area: the name strip in the
    // sticky header lays out on the same tracks, and it is not a descendant of the scroller.
    <div className="w-full content-container pb-6" style={geometryStyle} data-testid="comparison-view">
      {/*
        Parked directly below the site header rather than at the top of the viewport: that header
        is fixed, so a bar at `top-4` sat behind it. `--dialog-safe-top` is the header's measured
        height plus a gap, kept current by a ResizeObserver in header-action-bar.
      */}
      {/*
        Fixed height in flow, with the card itself out of flow: the name strip below the bar must
        not grow the header, or it pushes the cards it replaces further down and undoes the very
        condition that revealed it. One card around both carries background, rounding and shadow.
      */}
      <div data-testid="comparison-sticky-header" className="sticky top-[var(--dialog-safe-top,5.25rem)] z-40 h-14">
        <div className="absolute inset-x-0 top-0 overflow-hidden rounded-lg bg-surface-page shadow-lg">
          <div
            ref={stickyBarRef}
            data-testid="comparison-sticky-bar"
            className="flex h-14 items-center gap-3 px-4 md:gap-4 md:px-6"
          >
            {/* `me-auto` rather than pushing the controls right: the close button has to stay at the
                right edge even when the controls are not there at all. */}
            <H1 variant="h4" className="me-auto min-w-0 truncate text-3xl md:text-4xl">
              {t('title')}
            </H1>
            {/* The stepper lives up here because the products row it controls scrolls out of sight. */}
            <ComparisonScrollControls
              canScrollBack={canScrollBack}
              canScrollForward={canScrollForward}
              firstVisible={firstVisible}
              lastVisible={lastVisible}
              total={products.length}
              onScroll={scrollByColumn}
            />
            <Button
              size="icon"
              variant="link"
              className="h-8 w-8 shrink-0 text-text-headings normal-case"
              onClick={handleClose}
              aria-label={t('close')}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
          <ComparisonNameStrip
            products={products}
            labelPlacement={labelPlacement}
            rowRef={nameStripRowRef}
            visible={namesVisible}
            hasSeparator={hasSeparator}
          />
        </div>
      </div>

      {/* Single product state. More top margin than the `mt-6` rhythm below: the sticky card's
          shadow reaches around 22px down, and at 24px the hint sat inside it. */}
      {products.length === 1 && <p className="mt-8 px-4 text-text-on-disabled md:px-6">{t('addMoreProducts')}</p>}

      {/*
        One shared horizontal scroll area for the cards AND the attribute blocks: they form a single
        grid — a card sits above its own values — so scrolling them separately would pull the columns
        apart. Snapping to column starts is what keeps a card from ending up half cut off; the scroll
        padding makes it snap beside the sticky label column instead of underneath it.
      */}
      <div
        ref={scrollAreaRef}
        data-testid="comparison-scroll-area"
        className={cn(
          'hide-scrollbar mt-6 snap-x snap-mandatory overflow-x-auto',
          '[scroll-padding-inline-start:var(--comparison-label,0px)]',
          // Tabbing to a control from below drops it under the sticky card: the document scroller
          // carries no padding of its own, so everything focusable brings its own offset — the
          // header's measured height plus the card's 56px and a little air.
          '[--comparison-focus-offset:calc(var(--dialog-safe-top,5.25rem)+4.5rem)]',
          '[&_a]:scroll-mt-[var(--comparison-focus-offset)] [&_button]:scroll-mt-[var(--comparison-focus-offset)]',
        )}
      >
        {/* `w-max` so the attribute blocks inside span the full scrollable width: as plain blocks
            they would take only the visible width and their lines would stop mid-scroll. No
            `min-w-full`: where the capped columns need less than the viewport, a line stretched
            past the last column makes that column look twice as wide as the others. */}
        <div className="w-max">
          {/* Sticky, or the heading slides away with the products it names. `md:px-6` matches the
              sticky bar's own padding, so the heading is in lot with the page title above it. */}
          <div className="sticky left-0 w-max px-4 py-6 md:px-6">
            <H2 variant="h5">{t('products')}</H2>
          </div>
          <div ref={productsRowRef} className={cn(COMPARISON_ROW, 'w-full')}>
            {labelPlacement === 'left' && (
              // The table's empty corner — it only occupies the label column's track.
              <div className={cn(COMPARISON_STICKY_LABEL, 'bg-surface-page')} aria-hidden />
            )}
            {products.map((product, index) => (
              <ComparisonProductCard
                key={product.id}
                product={product}
                onRemove={removeProduct}
                variant={cardVariant}
                separator={hasSeparator(index)}
              />
            ))}
          </div>

          {/* Comparison table */}
          {products.length >= 2 && (
            <ComparisonTable products={products} labelPlacement={labelPlacement} hasSeparator={hasSeparator} />
          )}
        </div>
      </div>
    </div>
  );
}
