'use client';

import { type JSX, startTransition, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { H5 } from '@/components/ui/h';
import { useL10n } from '@/hooks/useL10n';
import { useRouter } from '@/i18n/navigation';
import { getSelectedVariantAttributeValues } from '@/lib/common/product-variant-attributes';
import { cn, formatCurrency } from '@/lib/utils';
import type { ProductPrice } from '@/platform/services/model/price';
import type { Product } from '@/platform/services/model/product';

/** Figma card content width (`12799:113117`). */
const VARIANT_CARD_WIDTH_PX = 157;
/** Gap between cards (Figma row gap / `spacing/4`). */
const VARIANT_CARD_GAP_PX = 16;

export interface ProductVariantCarouselProps {
  variants: Product[];
  prices: ProductPrice[];
  currentProductId: string;
  attributeOrder: string[];
  className?: string;
}

function resolveNetUnitPrice(price: ProductPrice | undefined): number | null {
  if (!price) {
    return null;
  }
  if (price.tax?.netValue != null) {
    return price.tax.netValue;
  }
  return price.amount;
}

export function resolveSlidesPerPage(viewportWidthPx: number): number {
  if (viewportWidthPx <= 0) {
    return 1;
  }
  return Math.max(
    1,
    Math.floor((viewportWidthPx + VARIANT_CARD_GAP_PX) / (VARIANT_CARD_WIDTH_PX + VARIANT_CARD_GAP_PX)),
  );
}

export function resolvePageCount(variantCount: number, slidesPerPage: number): number {
  if (variantCount <= 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(variantCount / Math.max(1, slidesPerPage)));
}

/**
 * Figma Sellable variants carousel (`12799:113107`) — thumbnail + attribute values + net price.
 * Page-based track (arrows + dots move by fully visible cards). Card click → variant PDP.
 *
 * Uses CSS transform paging instead of Embla: the PDP grid column + Embla snap math kept
 * collapsing to a single snap (no dots / dead arrows) even when cards visually overflowed.
 */
export function ProductVariantCarousel({
  variants,
  prices,
  currentProductId,
  attributeOrder,
  className,
}: Readonly<ProductVariantCarouselProps>): JSX.Element | null {
  const t = useTranslations('product');
  const tCarousel = useTranslations('common.UI.Carousel');
  const { l10n, l10nOrEmpty } = useL10n();
  const router = useRouter();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const updateWidth = (): void => {
      setViewportWidth(viewport.clientWidth);
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(viewport);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const slidesPerPage = resolveSlidesPerPage(viewportWidth);
  const pageCount = resolvePageCount(variants.length, slidesPerPage);
  const maxPage = Math.max(0, pageCount - 1);
  if (page > maxPage) {
    setPage(maxPage);
  }

  if (variants.length === 0) {
    return null;
  }

  const getPrice = (variantId: string): ProductPrice | undefined =>
    prices.find((price) => price.productId === variantId);

  const safePage = Math.min(page, maxPage);
  const slideStridePx = VARIANT_CARD_WIDTH_PX + VARIANT_CARD_GAP_PX;
  const contentWidthPx = variants.length * slideStridePx - VARIANT_CARD_GAP_PX;
  const maxTranslatePx = Math.max(0, contentWidthPx - viewportWidth);
  const translateXPx = Math.min(safePage * slidesPerPage * slideStridePx, maxTranslatePx);
  const canScrollPrev = safePage > 0;
  const canScrollNext = safePage < pageCount - 1;

  const goToPage = (nextPage: number): void => {
    setPage(Math.max(0, Math.min(nextPage, pageCount - 1)));
  };

  return (
    <div className={cn('flex min-w-0 w-full flex-col gap-4', className)} data-testid="product-variant-carousel">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <H5>{t('variants.sellableVariants')}</H5>
          <span className="text-base text-text-on-disabled">{t('variants.count', { count: variants.length })}</span>
        </div>
        <div className="flex items-center gap-6">
          <Button
            type="button"
            variant="carouselControl"
            size="icon"
            className="static translate-y-0 [&_svg]:h-6 [&_svg]:w-6 [&_svg]:text-icon-action"
            disabled={!canScrollPrev}
            title={tCarousel('prev')}
            data-testid="product-variant-carousel-prev"
            onClick={() => goToPage(safePage - 1)}
          >
            <ChevronLeft aria-label="Previous slide" />
          </Button>
          <Button
            type="button"
            variant="carouselControl"
            size="icon"
            className="static translate-y-0 [&_svg]:h-6 [&_svg]:w-6 [&_svg]:text-icon-action"
            disabled={!canScrollNext}
            title={tCarousel('next')}
            data-testid="product-variant-carousel-next"
            onClick={() => goToPage(safePage + 1)}
          >
            <ChevronRight aria-label="Next slide" />
          </Button>
        </div>
      </div>

      <div ref={viewportRef} className="min-w-0 w-full overflow-hidden" data-testid="product-variant-carousel-viewport">
        <div
          className="flex gap-4 transition-transform duration-300 ease-out"
          style={{ transform: `translate3d(-${translateXPx}px, 0, 0)` }}
          data-testid="product-variant-carousel-track"
          data-page={safePage}
        >
          {variants.map((variant) => {
            const isSelected = variant.id === currentProductId;
            const selectedValues = getSelectedVariantAttributeValues(variant);
            const orderedValues = attributeOrder
              .map((key) => selectedValues[key])
              .filter((value): value is string => Boolean(value));
            const fallbackValues = Object.values(selectedValues);
            const displayValues = orderedValues.length > 0 ? orderedValues : fallbackValues;
            const price = getPrice(variant.id);
            const netAmount = resolveNetUnitPrice(price);
            const image = variant.images?.[0] ?? variant.primaryImage;

            return (
              <button
                key={variant.id}
                type="button"
                className={cn(
                  'flex shrink-0 cursor-pointer flex-col rounded-sm border-2 p-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2',
                  isSelected ? 'border-border-secondary' : 'border-border-primary',
                )}
                style={{ width: VARIANT_CARD_WIDTH_PX, minWidth: VARIANT_CARD_WIDTH_PX }}
                data-testid="product-variant-carousel-card"
                data-variant-selected={isSelected ? 'true' : 'false'}
                onClick={() => {
                  if (variant.id === currentProductId) {
                    return;
                  }
                  startTransition(() => {
                    router.push(`/product/${variant.id}`);
                  });
                }}
              >
                <div className="flex h-[112px] w-full items-center justify-center bg-surface-image-background p-4">
                  {image?.url ? (
                    <div className="relative size-full">
                      <Image
                        src={image.url}
                        alt={
                          image.altText
                            ? l10nOrEmpty(image.altText) || l10nOrEmpty(variant.name)
                            : l10nOrEmpty(variant.name)
                        }
                        fill
                        className="object-contain object-center"
                        sizes={`${VARIANT_CARD_WIDTH_PX}px`}
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-text-on-disabled">{t('noImage')}</span>
                  )}
                </div>
                <div className="flex w-full flex-col gap-2 px-2 py-1 text-base text-text-body">
                  <div className="flex flex-col">
                    {displayValues.map((value) => (
                      <span key={value} className="truncate">
                        {l10n(value)}
                      </span>
                    ))}
                  </div>
                  <span className="font-bold">
                    {netAmount != null ? formatCurrency(netAmount, price?.currency) : t('price.notAvailable')}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {pageCount > 1 ? (
        <div
          className="mb-2 mt-0 flex w-full items-center justify-center gap-4"
          data-testid="product-variant-carousel-dots"
        >
          {Array.from({ length: pageCount }, (_, index) => (
            <button
              key={index}
              type="button"
              title={tCarousel('pageTitle', { index: index + 1 })}
              data-testid="product-variant-carousel-dot"
              data-dot-active={index === safePage ? 'true' : 'false'}
              className={cn(
                'cursor-pointer rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2',
                index === safePage
                  ? 'h-4 w-4 bg-linear-to-t from-gradient-secondary-end to-gradient-secondary-start hover:to-gradient-secondary-end'
                  : 'h-3 w-3 border border-border-secondary bg-surface-page hover:border-border-action-hover hover:bg-surface-action-hover-2',
              )}
              onClick={() => goToPage(index)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
