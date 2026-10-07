'use client';

import Image from 'next/image';
import { ChevronDown, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProductThumbnailItem {
  imageUrl?: string;
  name?: string;
}

interface AccountProductThumbnailsProps {
  items: ProductThumbnailItem[];
  /** Max thumbnails rendered before collapsing the rest into a "+N" chip. */
  max?: number;
  className?: string;
  /** When provided, the vignettes become a button that toggles an expandable products panel. */
  onToggle?: () => void;
  /** Reflects the open/closed state of the linked panel (rotates the chevron). */
  expanded?: boolean;
  /** Accessible label for the toggle button. */
  toggleLabel?: string;
  'data-testid'?: string;
}

/**
 * Compact row of product vignettes for account list tables (orders / quotes /
 * approvals). Renders up to `max` tiny square thumbnails and a "+N" chip when
 * there are more products. Square corners + `bg-surface-image-background`
 * fallback mirror the detail-page product cells (`Package` placeholder when a
 * product has no image).
 *
 * When `onToggle` is passed the whole cluster becomes a button (with a chevron)
 * that opens/closes an inline product breakdown row.
 */
export function AccountProductThumbnails({
  items,
  max = 3,
  className,
  onToggle,
  expanded = false,
  toggleLabel,
  'data-testid': testId,
}: AccountProductThumbnailsProps) {
  if (!items || items.length === 0) {
    return <span className="text-text-placeholders">–</span>;
  }

  const shown = items.slice(0, max);
  const remaining = items.length - shown.length;
  const title = items
    .map((item) => item.name)
    .filter(Boolean)
    .join(', ');

  const vignettes = (
    <>
      {shown.map((item, index) => (
        <span
          key={index}
          className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden border border-border-primary bg-surface-image-background"
        >
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.name || ''}
              width={36}
              height={36}
              className="h-full w-full object-contain"
            />
          ) : (
            <Package className="h-4 w-4 text-icon-secondary opacity-40" aria-hidden="true" />
          )}
        </span>
      ))}
      {remaining > 0 ? (
        <span className="flex h-9 min-w-9 shrink-0 items-center justify-center border border-border-primary bg-surface-page px-1 text-xs font-bold text-text-body">
          +{remaining}
        </span>
      ) : null}
    </>
  );

  if (onToggle) {
    return (
      <button
        type="button"
        aria-label={toggleLabel}
        aria-expanded={expanded}
        data-testid={testId}
        title={title || toggleLabel}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className={cn(
          'group flex items-center gap-1 rounded-none outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
          className,
        )}
      >
        {vignettes}
        <ChevronDown
          className={cn(
            'ml-0.5 h-4 w-4 shrink-0 text-text-placeholders transition-transform group-hover:text-text-body',
            expanded && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
    );
  }

  return (
    <div className={cn('flex items-center gap-1', className)} title={title || undefined}>
      {vignettes}
    </div>
  );
}

export default AccountProductThumbnails;
