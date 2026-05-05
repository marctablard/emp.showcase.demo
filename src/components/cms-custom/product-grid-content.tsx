'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { H2 } from '@/components/ui/h';
import { cn } from '@/lib/utils';
import type { SharedLink } from './_shared/field-definitions';
import { CmsProductTile } from './cms-product-tile';

type Columns = 2 | 3 | 4 | 6;
type Density = 'compact' | 'comfortable';

export type ProductGridProps = {
  skus?: string[];
  headline?: string;
  viewAllLink?: SharedLink;
  columns?: Columns;
  showPrice?: boolean;
  showRating?: boolean;
  density?: Density;
};

const colClass = (c?: Columns) => {
  switch (c) {
    case 2:
      return 'grid-cols-2';
    case 4:
      return 'grid-cols-2 md:grid-cols-4';
    case 6:
      return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6';
    case 3:
    default:
      return 'grid-cols-2 md:grid-cols-3';
  }
};

const densityClass = (d?: Density) => (d === 'compact' ? 'gap-3' : 'gap-6');

export default function ProductGrid({
  skus = [],
  headline,
  viewAllLink,
  columns = 3,
  showPrice = true,
  showRating = false,
  density = 'comfortable',
}: ProductGridProps) {
  return (
    <section data-cms="product-grid" className="w-full py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 md:px-12">
        {(headline || viewAllLink?.url) && (
          <div className="flex items-end justify-between gap-4">
            {headline ? <H2>{headline}</H2> : <span />}
            {viewAllLink?.url ? (
              <Button asChild variant="link">
                <Link href={viewAllLink.url}>{viewAllLink.label ?? 'View all'}</Link>
              </Button>
            ) : null}
          </div>
        )}
        <ul className={cn('grid', colClass(columns), densityClass(density))}>
          {skus.map((sku) => (
            <li key={sku}>
              <CmsProductTile sku={sku} showPrice={showPrice} showRating={showRating} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
