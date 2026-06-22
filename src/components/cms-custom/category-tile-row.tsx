import Image from 'next/image';
import Link from 'next/link';
import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { H2, H4 } from '@/components/ui/h';
import { cn } from '@/lib/utils';
import { type SharedImage, resolveImageSrc } from './_shared/field-definitions';

type Columns = 3 | 4 | 6;
type TileStyle = 'image' | 'image_overlay' | 'card';
type Aspect = 'square' | 'video' | 'wide';

/**
 * Shape produced by `StorefrontCMSComponentDecoratorService` for the
 * `cms-category-tile-row` decorator. The keys here intentionally mirror
 * what a typical Emporix Category exposes after server-side enrichment.
 */
export type DecoratedCategory = {
  id: string;
  name?: string;
  slug?: string;
  path?: string;
  image?: SharedImage;
};

type CategoryTileRowProps = {
  categoryIds?: string[];
  headline?: string;
  columns?: Columns;
  tileStyle?: TileStyle;
  aspect?: Aspect;
  // Injected at SSR time by the decorator service.
  _categories?: DecoratedCategory[];
};

const colClass = (c?: Columns) => {
  switch (c) {
    case 4:
      return 'grid-cols-2 md:grid-cols-4';
    case 6:
      return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6';
    case 3:
    default:
      return 'grid-cols-1 md:grid-cols-3';
  }
};

const aspectClass = (a?: Aspect) => (a === 'video' ? 'aspect-video' : a === 'wide' ? 'aspect-[21/9]' : 'aspect-square');

export default function CategoryTileRow({
  categoryIds = [],
  headline,
  columns = 3,
  tileStyle = 'image_overlay',
  aspect = 'square',
  _categories,
}: CategoryTileRowProps) {
  // Prefer the decorated payload; fall back to a minimal shape derived from ids
  // when the decorator hasn't run (e.g. preview mode without DI context).
  const categories: DecoratedCategory[] =
    _categories && _categories.length > 0 ? _categories : categoryIds.map((id) => ({ id }));

  if (categories.length === 0) return null;

  return (
    <section data-cms="category-tile-row" className="w-full py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 md:px-12">
        {headline ? <H2>{headline}</H2> : null}
        <ul className={cn('grid gap-4', colClass(columns))}>
          {categories.map((c, idx) => {
            const href = c.path ?? (c.slug ? `/category/${c.slug}` : `/category/${c.id}`);
            const label = c.name ?? c.id;
            const tileImageSrc = resolveImageSrc(c.image);
            const tile = (
              <div
                className={cn(
                  'relative w-full overflow-hidden rounded-md bg-surface-image-background',
                  aspectClass(aspect),
                )}
              >
                {tileImageSrc ? (
                  <Image
                    src={tileImageSrc}
                    alt={c.image?.alt ?? label}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : null}
                {tileStyle === 'image_overlay' ? (
                  <span aria-hidden className="absolute inset-0" style={{ background: 'var(--cms-overlay-dark)' }} />
                ) : null}
                {tileStyle !== 'card' ? (
                  <span className="absolute inset-x-0 bottom-0 flex items-end justify-start p-4 text-text-on-action">
                    <H4 className="text-text-on-action">{label}</H4>
                  </span>
                ) : null}
              </div>
            );
            return (
              <li key={c.id}>
                <Link href={href} data-cms-field={`category_ids.${idx}`} className="group flex flex-col gap-2">
                  {tile}
                  {tileStyle === 'card' ? <H4>{label}</H4> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export const categoryTileRowEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-category-tile-row',
    label: 'Category tiles',
    description: 'Row of category tiles. Category metadata is fetched server-side by the decorator service.',
    props: {
      category_ids: {
        label: 'Categories',
        type: 'category',
        multiple: true,
      },
      headline: { label: 'Headline', type: 'text' },
      columns: {
        label: 'Columns',
        type: 'select',
        options: [
          { label: '3', value: '3' },
          { label: '4', value: '4' },
          { label: '6', value: '6' },
        ],
      },
      tile_style: {
        label: 'Tile style',
        type: 'select',
        options: [
          { label: 'Image', value: 'image' },
          { label: 'Image with overlay label', value: 'image_overlay' },
          { label: 'Card with caption', value: 'card' },
        ],
      },
      aspect: {
        label: 'Aspect ratio',
        type: 'select',
        options: [
          { label: 'Square', value: 'square' },
          { label: 'Video (16:9)', value: 'video' },
          { label: 'Wide (21:9)', value: 'wide' },
        ],
      },
    },
    defaultProps: { columns: '3', tile_style: 'image_overlay', aspect: 'square' },
  },
  mapProps: (p) => ({
    categoryIds: p.category_ids ?? [],
    headline: p.headline,
    columns: Number(p.columns) as Columns,
    tileStyle: p.tile_style,
    aspect: p.aspect,
    _categories: p._categories,
  }),
  component: CategoryTileRow,
};
