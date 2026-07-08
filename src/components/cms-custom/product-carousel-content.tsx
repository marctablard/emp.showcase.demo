'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { H2 } from '@/components/ui/h';
import { cn } from '@/lib/utils';
import type { SharedLink } from './_shared/field-definitions';
import { CmsProductTile } from './cms-product-tile';

type SlidesPerView = 2 | 3 | 4 | 5;

export type ProductCarouselProps = {
  skus?: string[];
  headline?: string;
  viewAllLink?: SharedLink;
  slidesPerView?: SlidesPerView;
  loop?: boolean;
  showPrice?: boolean;
  showRating?: boolean;
};

const slideBasis = (n?: SlidesPerView) => {
  switch (n) {
    case 2:
      return 'basis-full sm:basis-1/2';
    case 4:
      return 'basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4';
    case 5:
      return 'basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/5';
    case 3:
    default:
      return 'basis-full sm:basis-1/2 lg:basis-1/3';
  }
};

export default function ProductCarousel({
  skus = [],
  headline,
  viewAllLink,
  slidesPerView = 3,
  loop = true,
  showPrice = true,
  showRating = false,
}: ProductCarouselProps) {
  if (skus.length === 0) return null;

  return (
    <section data-cms="product-carousel" className="w-full py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 md:px-12">
        {(headline || viewAllLink?.url) && (
          <div className="flex items-end justify-between gap-4">
            {headline ? <H2>{headline}</H2> : <span />}
            {viewAllLink?.url ? (
              <Button asChild variant="link">
                <Link href={viewAllLink.url}>
                  <span data-cms-field="view_all_link.label">{viewAllLink.label ?? 'View all'}</span>
                </Link>
              </Button>
            ) : null}
          </div>
        )}

        <Carousel className="relative" orientation="horizontal" opts={{ loop, align: 'start' }}>
          <CarouselContent className="-ml-4">
            {skus.map((sku, i) => (
              <CarouselItem key={sku} data-cms-field={`skus.${i}`} className={cn('pl-4', slideBasis(slidesPerView))}>
                <CmsProductTile sku={sku} showPrice={showPrice} showRating={showRating} />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-2 h-10 w-10">
            <ChevronLeft className="text-icon-action h-6 w-6" />
          </CarouselPrevious>
          <CarouselNext className="right-2 h-10 w-10">
            <ChevronRight className="text-icon-action h-6 w-6" />
          </CarouselNext>
        </Carousel>
      </div>
    </section>
  );
}
