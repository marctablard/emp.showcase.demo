'use client';

import type { RefObject } from 'react';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import { COMPARISON_ROW } from '@/components/comparison/comparison-columns';
import type { ComparisonLabelPlacement } from '@/hooks/comparison/useComparisonScroller';
import { useL10n } from '@/hooks/useL10n';
import { cn } from '@/lib/utils';
import type { Product } from '@/platform/services/model/product';

interface ComparisonNameStripProps {
  products: Product[];
  labelPlacement: ComparisonLabelPlacement;
  /** The scroller writes this row's transform directly, so the names cannot lag behind. */
  rowRef: RefObject<HTMLDivElement | null>;
  /** Which columns are preceded by a separator — see `useComparisonScroller`. */
  hasSeparator: (columnIndex: number) => boolean;
  visible: boolean;
}

/**
 * Which column belongs to which product, once the cards have scrolled out of sight.
 *
 * It has to live outside the horizontal scroller — `overflow-x` there makes the vertical axis a
 * scroll context of its own, so `sticky; top` would stick to the container rather than the
 * viewport. Hence the transform the scroller writes here, and the opaque patch over the labels.
 *
 * It shares the sticky bar's card, which is why it carries neither background nor shadow of its
 * own: two shadows there left a smudge across the bar above it.
 */
export function ComparisonNameStrip({
  products,
  labelPlacement,
  rowRef,
  visible,
  hasSeparator,
}: Readonly<ComparisonNameStripProps>) {
  const locale = useLocale();
  const { l10n } = useL10n(locale);

  return (
    <div
      // A duplicate of the names in the cards — nothing a screen reader needs to read twice.
      aria-hidden
      data-testid="comparison-name-strip"
      data-visible={visible || undefined}
      className={cn(
        'relative overflow-hidden transition-[height] duration-200',
        visible ? 'h-16 border-t border-border-primary' : 'h-0',
      )}
    >
      <div ref={rowRef} className={cn(COMPARISON_ROW, 'h-16')} data-testid="comparison-name-strip-row">
        {labelPlacement === 'left' && <div />}
        {products.map((product, index) => (
          <div
            key={product.id}
            className={cn(
              'flex min-w-0 items-center gap-2 px-3',
              hasSeparator(index) && 'border-l border-border-primary',
            )}
          >
            <div className="relative h-10 w-10 shrink-0 rounded-sm bg-surface-image-background">
              <Image
                src={product.primaryImage?.url ?? '/images/no_image_alt.png'}
                alt=""
                fill
                sizes="40px"
                className="object-contain p-1"
              />
            </div>
            <span className="line-clamp-2 text-sm font-bold text-text-headings">{l10n(product.name)}</span>
          </div>
        ))}
      </div>
      {labelPlacement === 'left' && (
        <div className="absolute inset-y-0 left-0 w-[var(--comparison-label,0px)] bg-surface-page" />
      )}
    </div>
  );
}
