'use client';

import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCartUpsells } from '@/hooks/cart/useCartUpsells';
import { ProductTile } from '../product/product-tile';
import { ProductTileSkeleton } from '../product/product-tile-skeleton';
import { Carousel, CarouselContent, CarouselDots, CarouselItem, CarouselNext, CarouselPrevious } from '../ui/carousel';
import { Heading } from '../ui/h';

export function CartUpsells() {
  const t = useTranslations('cart');
  const { upsellProducts, loading } = useCartUpsells();

  // Don't render if no upsells or still loading
  if (loading && upsellProducts.length === 0) {
    return null;
  }

  if (upsellProducts.length === 0) {
    return null;
  }

  return (
    <div className="pt-4 pb-2 w-full">
      <div className="w-full relative">
        <Carousel className="w-full" orientation="horizontal">
          <Heading variant="h4" as="div" className="mb-2">
            {t('upsells')}
          </Heading>

          <CarouselContent className="mt-3 mb-2">
            {loading ? (
              <>
                {Array.from({ length: 3 }, (_, i) => (
                  <CarouselItem key={i + 1} size="basis-1/4">
                    <div className="relative w-full h-full">
                      <ProductTileSkeleton />
                    </div>
                  </CarouselItem>
                ))}
              </>
            ) : (
              <>
                {upsellProducts.map((product, index) => (
                  <CarouselItem key={product.id || index} size="basis-1/4">
                    <div className="relative w-full h-full">
                      <ProductTile product={product} compact={true} />
                    </div>
                  </CarouselItem>
                ))}
              </>
            )}
          </CarouselContent>

          <CarouselDots />

          <CarouselPrevious className="hidden sm:flex top-0 right-16 bottom-1 h-8 w-8">
            <ChevronLeft className="h-4 w-4 text-text-action" />
          </CarouselPrevious>
          <CarouselNext className="hidden sm:flex top-0 right-2 bottom-1 h-8 w-8">
            <ChevronRight className="h-4 w-4 text-text-action" />
          </CarouselNext>
        </Carousel>
      </div>
    </div>
  );
}
