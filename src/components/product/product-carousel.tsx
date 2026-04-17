'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import type { CarouselApi } from '@/components/ui/carousel';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useL10n } from '@/hooks/useL10n';
import { imageSizes } from '@/lib/utils';
import type { Media } from '@/platform/services/model/common';

interface ProductCarouselProps {
  images: Media[] | undefined;
}

export function ProductCarousel({ images }: ProductCarouselProps) {
  const { l10n } = useL10n();

  const [mainApi, setMainApi] = useState<CarouselApi>();
  const [thumbApi, setThumbApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);

  // Sync the main carousel with the thumbnail carousel
  useEffect(() => {
    if (!mainApi || !thumbApi) return;

    const onSelect = () => {
      const index = mainApi.selectedScrollSnap();
      setActiveIndex(index);
      thumbApi.scrollTo(index);
    };

    mainApi.on('select', onSelect);
    return () => {
      mainApi.off('select', onSelect);
    };
  }, [mainApi, thumbApi]);

  if (!images || images.length === 0) {
    return (
      <div className="bg-surface-image-background h-96 flex items-center justify-center">
        <span className="text-text-placeholders">No images available</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col md:flex-row gap-5 md:gap-8 relative">
      {/* Main Carousel */}
      <div className="w-full md:w-[calc(100%-125px)] static md:relative p-6">
        <Carousel
          className="static md:relative w-full h-full flex items-center"
          orientation="horizontal"
          loop={true}
          setApi={setMainApi}
        >
          <CarouselContent>
            {images.map((image, index) => (
              <CarouselItem key={index}>
                <div className="relative w-[296px] sm:w-[431px] h-[255px] sm:h-[351px] md:h-[160px] lg:h-[460px] md:w-full mx-auto">
                  <Image
                    src={image.url}
                    alt={image.altText ? l10n(image.altText) : `Product image ${index + 1}`}
                    fill
                    sizes={imageSizes}
                    priority={index === 0}
                    fetchPriority={index === 0 ? 'high' : 'auto'}
                    className="object-cover object-center"
                  />
                  {image.contentType?.startsWith('video/') && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-surface-page/80 rounded-full">
                        <Play className="h-8 w-8 text-icon-action" />
                      </div>
                    </div>
                  )}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-4 md:left-auto md:right-14 bottom-1 w-10 h-10 mr-2">
            <ChevronLeft className="h-6 w-6 text-icon-action" />
          </CarouselPrevious>
          <CarouselNext className="right-4 bottom-1 w-10 h-10">
            <ChevronRight className="h-6 w-6 text-icon-action" />
          </CarouselNext>
        </Carousel>
      </div>

      {/* Thumbnail Carousel - Vertical on the right */}
      <div className="md:min-w-[125px]">
        <div className="md:h-[500px] overflow-hidden">
          <Carousel className="h-full" orientation="horizontal" setApi={setThumbApi}>
            <CarouselContent className="h-full w-full md:flex-col my-1 gap-2 md:gap-3 p-0 justify-center ml-0">
              {images.map((image, index) => (
                <CarouselItem
                  key={index}
                  className="basis-1/5 min-h-0 cursor-pointer pt-0 pl-0 flex items-center justify-center max-w-[60px] md:max-w-full"
                  onClick={() => mainApi?.scrollTo(index)}
                >
                  <div
                    className={`w-full w-[60px] h-[40px] md:max-w-[120px] md:h-[80px] relative rounded-md overflow-hidden ${activeIndex === index ? 'ring-2 ring-border-focus' : 'border border-transparent'}`}
                  >
                    <Image
                      src={image.url}
                      alt={image.altText ? l10n(image.altText) : `Thumbnail ${index + 1}`}
                      fill
                      sizes={imageSizes}
                      className="px-2 py-1 md:p-1.5 object-cover object-center"
                    />
                    {image.contentType?.startsWith('video/') && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
                        <Play className="h-4 w-4 text-icon-on-action" />
                      </div>
                    )}
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>
      </div>
    </div>
  );
}
