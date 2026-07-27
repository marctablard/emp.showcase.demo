'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselType,
} from '@/components/ui/carousel';
import { H4, H5, H6 } from '@/components/ui/h';
import { useCategoryProductCounts } from '@/hooks/category/useCategoryProductCounts';
import { Link } from '@/i18n/navigation';
import { buildBrowseHrefForPureCategoryId } from '@/lib/navigation/build-browse-category-href';
import { l10n, l10nOrEmpty } from '@/lib/utils';
import type { Category } from '@/platform/services/model/category';
import { getBatteryIncludedCategoryStaticCount } from '@/platform/services/model/category/batteryincluded-category';

interface PlpCategoryCarouselProps {
  /** Categories to render as cards. Empty list renders nothing. */
  categories: Category[];
  locale: string;
}

/**
 * Root-level category thumbnail carousel that sits above the PLP list layout.
 * Figma: `B2B-New-Showcase` node `10254:165716` (Category Thumbnail).
 *
 * Product count. Each card links to the category-scoped PLP; URL sync and tree selection come in
 * later steps. Hidden entirely when `categories` is empty to avoid an orphan header.
 */
export function PlpCategoryCarousel({ categories, locale }: PlpCategoryCarouselProps) {
  /**
   * Root-level category thumbnail carousel that sits above the PLP list layout.
   * Figma: `B2B-New-Showcase` node `10254:165716` (Category Thumbnail).
   *
   * Product count. Each card links to the category-scoped PLP; URL sync and tree selection come in
   * later steps. Hidden entirely when `categories` is empty to avoid an orphan header.
   */
  const t = useTranslations('search.plpCategoryCarousel');
  const [api, setApi] = useState<CarouselType>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const staticCounts = useMemo(
    () =>
      categories.reduce<Record<string, number>>((acc, category) => {
        const count = getBatteryIncludedCategoryStaticCount(category);
        if (typeof count === 'number') {
          acc[category.id] = count;
        }
        return acc;
      }, {}),
    [categories],
  );

  const categoryIdsKey = useMemo(() => categories.map((c) => c.id).join('|'), [categories]);
  const { counts, requestCounts } = useCategoryProductCounts();

  useEffect(() => {
    if (categoryIdsKey.length === 0) {
      return;
    }
    requestCounts(categoryIdsKey.split('|').filter((id) => staticCounts[id] === undefined));
  }, [categoryIdsKey, requestCounts, staticCounts]);

  const mergedCounts = useMemo(() => ({ ...counts, ...staticCounts }), [counts, staticCounts]);

  // Drop categories whose product count has resolved to 0. Unknown counts stay visible so the
  // carousel does not flicker while counts stream in.
  const visibleCategories = useMemo(
    () => categories.filter((c) => mergedCounts[c.id] !== 0),
    [categories, mergedCounts],
  );

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

  if (visibleCategories.length === 0) {
    return null;
  }

  const showControls = canScrollPrev || canScrollNext;

  return (
    <section className="w-full" aria-label={t('title')} data-testid="plp-category-carousel">
      {/* Desktop Layout: Horizontal Carousel */}
      <Carousel
        className="hidden w-full md:block"
        orientation="horizontal"
        opts={{ align: 'start', containScroll: 'trimSnaps' }}
        setApi={setApi}
      >
        <div className="flex items-center justify-between gap-4">
          {showControls ? (
            <div className="flex items-center gap-6">
              <CarouselPrevious className="static translate-y-0 [&_svg]:h-6 [&_svg]:w-6 [&_svg]:text-icon-action" />
              <CarouselNext className="static translate-y-0 [&_svg]:h-6 [&_svg]:w-6 [&_svg]:text-icon-action" />
            </div>
          ) : null}
        </div>

        <CarouselContent className="py-6">
          {visibleCategories.map((category) => {
            const name = l10n(category.name, locale);
            const href = buildBrowseHrefForPureCategoryId(category.id, category);
            const image = category.media?.[0];
            const count = mergedCounts[category.id];
            return (
              <CarouselItem key={category.id} size="basis-[260px] md:basis-[300px] md:basis-[320px] lg:basis-[340px]">
                <Link
                  href={href}
                  className="group flex h-[260px] w-full flex-col overflow-hidden rounded-[8px] bg-surface-primary shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-border-focus"
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
                      <span className="text-sm font-bold text-text-on-disabled">{count}</span>
                    ) : null}
                  </div>
                </Link>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>

      {/* Mobile Layout: Vertical List of Cards */}
      <div className="flex w-full flex-col gap-6 md:hidden">
        {visibleCategories.map((category) => {
          const name = l10n(category.name, locale);
          const href = buildBrowseHrefForPureCategoryId(category.id, category);
          const image = category.media?.[0];
          const count = mergedCounts[category.id];
          return (
            <Link
              key={category.id}
              href={href}
              className="group flex h-[80px] w-full items-center overflow-hidden rounded-[4px] bg-surface-primary shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-border-focus"
              data-testid="plp-category-mobile-card"
            >
              <div className="relative flex h-[80px] w-[80px] shrink-0 items-center justify-center bg-surface-image-background p-2">
                {image?.url ? (
                  <Image
                    src={image.url}
                    alt={image.altText ? l10nOrEmpty(image.altText, locale) || name : name}
                    fill
                    sizes="80px"
                    className="object-contain p-2"
                  />
                ) : null}
              </div>
              <div className="flex w-full flex-col justify-center px-4">
                <H4 className="truncate text-text-headings">{name}</H4>
                {typeof count === 'number' ? <H6 className="text-text-body">{count}</H6> : null}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default PlpCategoryCarousel;
