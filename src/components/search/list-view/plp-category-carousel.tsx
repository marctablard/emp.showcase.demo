'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselType,
} from '@/components/ui/carousel';
import { H4, H5 } from '@/components/ui/h';
import { useCategoryProductCounts } from '@/hooks/category/useCategoryProductCounts';
import { Link } from '@/i18n/navigation';
import { buildBrowseHrefForCategoryId } from '@/lib/navigation/build-browse-category-href';
import { l10n, l10nOrEmpty } from '@/lib/utils';
import type { Category } from '@/platform/services/model/category';

interface PlpCategoryCarouselProps {
  /** Categories to render as cards. Empty list renders nothing. */
  categories: Category[];
  locale: string;
}

/**
 * Root-level category thumbnail carousel that sits above the PLP list layout.
 * Figma: `B2B-New-Showcase` node `10254:165716` (Category Thumbnail).
 *
 * Step 2a scope: render the supplied categories as horizontal cards with name and best-effort
 * product count. Each card links to the category-scoped PLP; URL sync and tree selection come in
 * later steps. Hidden entirely when `categories` is empty to avoid an orphan header.
 */
export function PlpCategoryCarousel({ categories, locale }: PlpCategoryCarouselProps) {
  const t = useTranslations('search.plpCategoryCarousel');
  const [api, setApi] = useState<CarouselType>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const categoryIds = useMemo(() => categories.map((c) => c.id), [categories]);
  const categoryIdsKey = categoryIds.join('|');
  const { counts, requestCounts } = useCategoryProductCounts();

  useEffect(() => {
    if (categoryIds.length === 0) {
      return;
    }
    requestCounts(categoryIds);
    // `categoryIdsKey` keeps the effect stable when parents hand us a new array identity with the
    // same ids (e.g. re-memoised navigationRoots).
  }, [categoryIdsKey, categoryIds, requestCounts]);

  useEffect(() => {
    if (!api) {
      return;
    }
    const update = () => {
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };
    update();
    api.on('select', update);
    api.on('reInit', update);
    return () => {
      api.off('select', update);
      api.off('reInit', update);
    };
  }, [api]);

  if (categories.length === 0) {
    return null;
  }

  const showControls = canScrollPrev || canScrollNext;

  return (
    <section className="w-full" aria-label={t('title')} data-testid="plp-category-carousel">
      <Carousel
        className="w-full"
        orientation="horizontal"
        opts={{ align: 'start', containScroll: 'trimSnaps' }}
        setApi={setApi}
      >
        <div className="flex items-center justify-between gap-4">
          <H4>{t('title')}</H4>
          {showControls ? (
            <div className="flex items-center gap-6">
              <CarouselPrevious className="static translate-y-0">
                <ChevronLeft className="h-6 w-6 text-icon-action" />
              </CarouselPrevious>
              <CarouselNext className="static translate-y-0">
                <ChevronRight className="h-6 w-6 text-icon-action" />
              </CarouselNext>
            </div>
          ) : null}
        </div>

        <CarouselContent className="py-6">
          {categories.map((category) => {
            const name = l10n(category.name, locale);
            const href = buildBrowseHrefForCategoryId(category.id);
            const image = category.media?.[0];
            const count = counts[category.id];
            return (
              <CarouselItem key={category.id} size="basis-[260px] sm:basis-[300px] md:basis-[320px] lg:basis-[340px]">
                <Link
                  href={href}
                  className="group flex h-full w-full flex-col overflow-hidden rounded-[4px] bg-surface-primary shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-border-focus"
                  data-testid="plp-category-carousel-card"
                >
                  <div className="relative flex h-[160px] w-full items-center justify-center bg-surface-image-background p-4">
                    {image?.url ? (
                      <Image
                        src={image.url}
                        alt={image.altText ? l10nOrEmpty(image.altText, locale) || name : name}
                        fill
                        sizes="(max-width: 640px) 260px, (max-width: 1024px) 320px, 340px"
                        className="object-contain p-4"
                      />
                    ) : null}
                  </div>
                  <div className="flex h-[100px] w-full flex-col items-center justify-center gap-1 px-4 py-3 text-center">
                    <H5 className="text-text-body">{name}</H5>
                    {typeof count === 'number' ? (
                      <span className="font-headlines text-2xl font-bold text-text-on-disabled">{count}</span>
                    ) : null}
                  </div>
                </Link>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>
    </section>
  );
}

export default PlpCategoryCarousel;
