'use client';

import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ComparisonScrollControlsProps {
  canScrollBack: boolean;
  canScrollForward: boolean;
  /** 1-based range of products currently in view. */
  firstVisible: number;
  lastVisible: number;
  total: number;
  onScroll: (direction: -1 | 1) => void;
  className?: string;
}

/**
 * Stepping through the comparison, parked in the sticky bar so it stays reachable while the
 * customer scrolls down through the attributes. Beside the position indicator a disabled arrow
 * reads as the end of the list, so both stay in place — but the pair disappears entirely once
 * nothing is out of view.
 */
export function ComparisonScrollControls({
  canScrollBack,
  canScrollForward,
  firstVisible,
  lastVisible,
  total,
  onScroll,
  className,
}: Readonly<ComparisonScrollControlsProps>) {
  const t = useTranslations('comparison');

  // Everything fits: nothing to page, and no position worth reporting.
  if (!canScrollBack && !canScrollForward) return null;

  const range = firstVisible === lastVisible ? `${firstVisible}` : `${firstVisible}–${lastVisible}`;

  return (
    <div
      className={cn('flex shrink-0 items-center gap-1 md:gap-2', className)}
      data-testid="comparison-scroll-controls"
    >
      <ArrowButton
        direction={-1}
        enabled={canScrollBack}
        label={t('previousProducts')}
        onScroll={onScroll}
        testId="comparison-scroll-prev"
      />
      {/* The visible forms are compressed for the eye ("2–4 von 4"); a screen reader skips the dash
          and would read "2 4 von 4", so the spoken form is a sentence of its own. */}
      <span data-testid="comparison-scroll-position" className="whitespace-nowrap text-sm text-text-body tabular-nums">
        <span className="sm:hidden" aria-hidden>
          {t('productRangeShort', { range, total })}
        </span>
        <span className="hidden sm:inline" aria-hidden>
          {t('productRange', { range, total })}
        </span>
        <span className="sr-only" aria-live="polite">
          {firstVisible === lastVisible
            ? t('productPositionAnnouncement', { first: firstVisible, total })
            : t('productRangeAnnouncement', { first: firstVisible, last: lastVisible, total })}
        </span>
      </span>
      <ArrowButton
        direction={1}
        enabled={canScrollForward}
        label={t('nextProducts')}
        onScroll={onScroll}
        testId="comparison-scroll-next"
      />
    </div>
  );
}

function ArrowButton({
  direction,
  enabled,
  label,
  onScroll,
  testId,
}: Readonly<{
  direction: -1 | 1;
  enabled: boolean;
  label: string;
  onScroll: (direction: -1 | 1) => void;
  testId: string;
}>) {
  return (
    <Button
      type="button"
      variant="carouselControl"
      size="icon"
      // Same look as the variant carousel's controls, but in flow instead of overlaid.
      className="static translate-y-0 [&_svg]:h-6 [&_svg]:w-6 [&_svg]:text-icon-action"
      disabled={!enabled}
      // No `title` beside the `aria-label`: the same text twice is read twice by some assistive
      // technology, and a chevron next to the position indicator needs no hover explanation.
      aria-label={label}
      data-testid={testId}
      onClick={() => onScroll(direction)}
    >
      {direction === -1 ? <ChevronLeft /> : <ChevronRight />}
    </Button>
  );
}
