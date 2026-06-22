'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { type SharedImage, resolveImageSrc } from './_shared/field-definitions';

export type GalleryColumns = 2 | 3 | 4;
type Gap = 'sm' | 'md' | 'lg';
type Aspect = 'square' | 'video' | 'auto';

export type GalleryProps = {
  images?: SharedImage[];
  columns?: GalleryColumns;
  gap?: Gap;
  lightbox?: boolean;
  aspect?: Aspect;
};

const colClass = (c?: GalleryColumns) => {
  switch (c) {
    case 2:
      return 'grid-cols-2';
    case 4:
      return 'grid-cols-2 md:grid-cols-4';
    case 3:
    default:
      return 'grid-cols-2 md:grid-cols-3';
  }
};

const gapClass = (g?: Gap) => (g === 'sm' ? 'gap-2' : g === 'lg' ? 'gap-6' : 'gap-4');

const aspectClass = (a?: Aspect) => (a === 'video' ? 'aspect-video' : a === 'auto' ? 'aspect-[4/3]' : 'aspect-square');

export default function Gallery({
  images = [],
  columns = 3,
  gap = 'md',
  lightbox = true,
  aspect = 'square',
}: GalleryProps) {
  const [active, setActive] = useState<number | null>(null);
  // Track the original index so `data-cms-field` paths still point at the
  // editor's source array even after we drop entries with no resolvable src.
  const validImages = images
    .map((img, originalIndex) => ({ ...img, _src: resolveImageSrc(img), _idx: originalIndex }))
    .filter((img): img is SharedImage & { _src: string; _idx: number } => Boolean(img._src));
  if (validImages.length === 0) return null;

  return (
    <div data-cms="gallery" className="mx-auto flex w-full max-w-6xl flex-col px-6 md:px-12">
      <div className={cn('grid', colClass(columns), gapClass(gap))}>
        {validImages.map((img, i) => (
          <button
            type="button"
            key={i}
            data-cms-field={`images.${img._idx}`}
            onClick={lightbox ? () => setActive(i) : undefined}
            className={cn(
              'relative w-full overflow-hidden rounded-md bg-surface-image-background',
              aspectClass(aspect),
              lightbox && 'cursor-zoom-in transition-transform hover:scale-[1.02]',
            )}
          >
            <Image
              src={img._src}
              alt={img.alt ?? ''}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              className="object-cover"
            />
          </button>
        ))}
      </div>
      {lightbox && active !== null && validImages[active] ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActive(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'var(--cms-overlay-dark)' }}
        >
          <div className="relative max-h-full max-w-5xl">
            <Image
              src={validImages[active]._src}
              alt={validImages[active].alt ?? ''}
              width={1600}
              height={1200}
              className="h-auto max-h-[90vh] w-auto object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
