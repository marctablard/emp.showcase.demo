'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useProducts } from '@/hooks/product/useProducts';
import { useRecommendations } from '@/hooks/recommendations/useRecommendations';
import type { Product } from '@/platform/services/model/product';
import { ProductTile } from '../product/product-tile';
import { ProductTileSkeleton } from '../product/product-tile-skeleton';
import { Carousel, CarouselContent, CarouselDots, CarouselItem, CarouselNext, CarouselPrevious } from '../ui/carousel';
import { Heading } from '../ui/h';

interface RecommendationsProps {
  overline?: string;
  headline?: string;
  productId?: Product['id'];
  products?: string;
  locale?: string;
}

const Recommendations = ({ overline, headline, productId, products, locale }: RecommendationsProps) => {
  const hasProductId = !!productId;
  // get product ids as string because of storyblok and transform it to array
  const transformProducts = products?.split(', ');
  const hasProducts = Array.isArray(transformProducts) && transformProducts.length > 0;

  // Fetch recommendations or products
  const { recommendations, loading: recLoading, error } = useRecommendations(productId);
  const { products: productList, loading: productsLoading } = useProducts(transformProducts, { prices: true });

  const recommendationsToShow = hasProductId ? (recommendations?.products ?? []) : (productList ?? []);

  // Handle error state
  if (error) {
    return null;
  }

  if ((!hasProductId && !hasProducts) || recommendationsToShow.length === 0) {
    return null;
  }

  return (
    <div className="py-8 max-w-6xl mx-auto px-4 lg:px-9">
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
            {(hasProductId && recLoading) || (hasProducts && productsLoading) ? (
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

export type { RecommendationsProps };
export default Recommendations;
