'use client';

import type { JSX } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { resolveProductLabelImageUrl } from '@/lib/common/product-label-image';
import { cn } from '@/lib/utils';
import type { ProductLabel } from '@/platform/services/model/product';

export interface ProductLabelsProps {
  labels: ProductLabel[];
  className?: string;
  badgeClassName?: string;
}

/**
 * Renders product labels from the tenant label catalog.
 * When a label has an absolute `image` URL, shows the icon with the name as tooltip;
 * otherwise falls back to the text badge.
 */
export function ProductLabels({ labels, className, badgeClassName }: Readonly<ProductLabelsProps>): JSX.Element | null {
  if (labels.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)} data-testid="product-labels">
      {labels.map((label) => {
        const name = label.name?.trim() || label.id;
        const imageUrl = resolveProductLabelImageUrl(label.image);

        if (imageUrl) {
          return (
            <Tooltip key={label.id} delayDuration={200}>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex h-12 shrink-0 items-center justify-center"
                  data-testid={`product-label-icon-${label.id}`}
                  aria-label={name}
                >
                  {/* Arbitrary tenant/CDN hosts (often SVG without extension) — next/image rejects SVG. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt={name} className="h-full w-auto object-contain" />
                </span>
              </TooltipTrigger>
              <TooltipContent>{name}</TooltipContent>
            </Tooltip>
          );
        }

        return (
          <Badge
            key={label.id}
            variant="info"
            rounded="roundedRight"
            className={cn('h-7', badgeClassName)}
            data-testid={`product-label-text-${label.id}`}
          >
            {name}
          </Badge>
        );
      })}
    </div>
  );
}
