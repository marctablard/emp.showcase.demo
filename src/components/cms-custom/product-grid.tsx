import Link from 'next/link';
import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { H2 } from '@/components/ui/h';
import { cn } from '@/lib/utils';
import { type SharedLink, sharedFieldDefinitions } from './_shared/field-definitions';

type Columns = 2 | 3 | 4 | 6;
type Density = 'compact' | 'comfortable';

type ProductGridProps = {
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

/**
 * Lightweight product showcase. Renders a grid of placeholder tiles linking
 * to `/product/<sku>` — wiring up real product fetching is out of scope for
 * the install (per design decision: no product prefetch decorator).
 * Replace the inner tile with the host's `ProductCard` once the SKU lookup
 * pipeline is in place.
 */
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
              <Link href={`/product/${sku}`} className="block h-full">
                <Card className="h-full transition hover:shadow-md">
                  <CardContent className="flex flex-col gap-2 p-4">
                    <span className="aspect-square w-full rounded-sm bg-surface-image-background" aria-hidden />
                    <CardTitle className="text-base">{sku}</CardTitle>
                    {showPrice ? <span className="text-sm text-text-placeholders">—</span> : null}
                    {showRating ? <span className="text-sm text-text-placeholders">★★★★☆</span> : null}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export const productGridEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-product-grid',
    label: 'Product grid',
    description:
      'Curated product grid by SKU. Real product details are fetched per page; this block carries the layout.',
    fieldDefinitions: sharedFieldDefinitions,
    props: {
      skus: { label: 'Product SKUs', type: 'array', items: { label: 'SKU', type: 'text' } },
      headline: { label: 'Headline', type: 'text' },
      view_all_link: { $ref: 'link', label: 'View all link', type: 'object' },
      columns: {
        label: 'Columns',
        type: 'select',
        options: [
          { label: '2', value: '2' },
          { label: '3', value: '3' },
          { label: '4', value: '4' },
          { label: '6', value: '6' },
        ],
      },
      show_price: { label: 'Show price', type: 'boolean' },
      show_rating: { label: 'Show rating', type: 'boolean' },
      density: {
        label: 'Density',
        type: 'select',
        options: [
          { label: 'Compact', value: 'compact' },
          { label: 'Comfortable', value: 'comfortable' },
        ],
      },
    },
    defaultProps: { columns: '3', show_price: true, show_rating: false, density: 'comfortable' },
  },
  mapProps: (p) => ({
    skus: p.skus ?? [],
    headline: p.headline,
    viewAllLink: p.view_all_link,
    columns: Number(p.columns) as Columns,
    showPrice: p.show_price,
    showRating: p.show_rating,
    density: p.density,
  }),
  component: ProductGrid,
};
