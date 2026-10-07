'use client';

import type { HTMLAttributes } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductTile } from '@/components/product/product-tile';
import { ProductTileSkeleton } from '@/components/product/product-tile-skeleton';
import {
  Carousel,
  CarouselContent,
  CarouselDots,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Heading } from '@/components/ui/h';
import { useProducts } from '@/hooks/product/useProducts';
import { useRecommendations } from '@/hooks/recommendations/useRecommendations';
import { cn } from '@/lib/utils';
import type { Product } from '@/platform/services/model/product';
import { parseProductIds } from './parse-product-ids';

interface RecommendationsCarouselProps extends HTMLAttributes<HTMLDivElement> {
  overline?: string;
  headline?: string;
  productId?: Product['id'];
  products?: string;
  items?: Product[];
  loading?: boolean;
  locale?: string;
}

const RecommendationsCarousel = ({
  overline,
  headline,
  productId,
  products,
  items,
  loading = false,
  locale,
  className,
  ...rest
}: RecommendationsCarouselProps) => {
  const hasItems = Array.isArray(items) && items.length > 0;
  const hasProductId = !!productId && !hasItems && !loading;
  // parse product ids from comma-separated string (tolerates any whitespace around commas)
  const transformProducts = !hasItems && products ? parseProductIds(products) : undefined;
  const hasProducts = Array.isArray(transformProducts) && transformProducts.length > 0;

  // Fetch recommendations or products
  const {
    recommendations,
    loading: recLoading,
    error,
  } = useRecommendations(hasProductId ? productId : undefined, locale);
  const { products: productList, loading: productsLoading } = useProducts(transformProducts, { prices: true });

  const recommendationsToShow = hasItems
    ? items
    : hasProductId
      ? (recommendations?.products ?? [])
      : (productList ?? []);
  const isLoading = loading || (!hasItems && ((hasProductId && recLoading) || (hasProducts && productsLoading)));

  // Handle error state — no padded shell
  if (error) {
    return null;
  }

  // No source configured, or finished loading with nothing to show — no padded shell
  if (
    (!isLoading && !hasItems && !hasProductId && !hasProducts) ||
    (!isLoading && recommendationsToShow.length === 0)
  ) {
    return null;
  }

  return (
    <div className={cn('py-8 content-container', className)} {...rest}>
      {overline && (
        <Heading variant="overline" as="div" className="mb-3">
          {overline}
        </Heading>
      )}

      <div className="w-full relative">
        <Carousel className="w-full " orientation="horizontal">
          {headline && (
            <Heading variant="h2" as="div" className="sm:pr-36">
              {headline}
            </Heading>
          )}

          <CarouselContent className="mt-8 mb-8">
            {isLoading ? (
              <>
                {Array.from({ length: 5 }, (_, i) => (
                  <CarouselItem key={i + 1} size="basis-1/5.5">
                    <div className="relative w-[322px] h-full">
                      <ProductTileSkeleton />
                    </div>
                  </CarouselItem>
                ))}
              </>
            ) : (
              <>
                {Array.isArray(recommendationsToShow) &&
                  recommendationsToShow.map((product, index) => (
                    <CarouselItem key={index} size="basis-1/5.5">
                      <div className="relative w-[322px] h-full">
                        <ProductTile product={product} locale={locale} />
                      </div>
                    </CarouselItem>
                  ))}
              </>
            )}
          </CarouselContent>

          <CarouselDots />

          <CarouselPrevious className="hidden sm:flex top-0 right-20 bottom-1 h-10 w-10">
            <ChevronLeft className="h-6 w-6 text-text-action" />
          </CarouselPrevious>
          <CarouselNext className="hidden sm:flex top-0 right-4 bottom-1 h-10 w-10">
            <ChevronRight className="h-6 w-6 text-text-action" />
          </CarouselNext>
        </Carousel>
      </div>
    </div>
  );
};

export default RecommendationsCarousel;
