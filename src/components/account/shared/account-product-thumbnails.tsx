'use client';

import Image from 'next/image';
import { Package } from 'lucide-react';
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
}

/**
 * Compact row of product vignettes for account list tables (orders / quotes /
 * approvals). Renders up to `max` tiny square thumbnails and a "+N" chip when
 * there are more products. Square corners + `bg-surface-image-background`
 * fallback mirror the detail-page product cells (`Package` placeholder when a
 * product has no image).
 */
export function AccountProductThumbnails({ items, max = 3, className }: AccountProductThumbnailsProps) {
  if (!items || items.length === 0) {
    return <span className="text-text-placeholders">–</span>;
  }

  const shown = items.slice(0, max);
  const remaining = items.length - shown.length;
  const title = items
    .map((item) => item.name)
    .filter(Boolean)
    .join(', ');

  return (
    <div className={cn('flex items-center gap-1', className)} title={title || undefined}>
      {shown.map((item, index) => (
        <div
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
        </div>
      ))}
      {remaining > 0 ? (
        <div className="flex h-9 min-w-9 shrink-0 items-center justify-center border border-border-primary bg-surface-page px-1 text-xs font-bold text-text-body">
          +{remaining}
        </div>
      ) : null}
    </div>
  );
}

export default AccountProductThumbnails;
