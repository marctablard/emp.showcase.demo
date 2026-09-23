'use client';

import { type JSX, startTransition, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { H5 } from '@/components/ui/h';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useL10n } from '@/hooks/useL10n';
import { useRouter } from '@/i18n/navigation';
import { PRODUCT_NO_IMAGE_SRC, resolveProductImageSrc } from '@/lib/common/product-image';
import {
  formatTemplateAttributeValue,
  resolveVariantAttributeLabel,
  resolveVariantAttributeValueLabel,
} from '@/lib/common/product-template-attributes';
import {
  type VariantAttributeDisplayPair,
  type VariantAttributeFilters,
  getUnselectedVariantAttributePairs,
} from '@/lib/common/product-variant-attributes';
import { L10N_MISSING_LABEL } from '@/lib/l10n';
import { cn, formatCurrency } from '@/lib/utils';
import type { LocalizedString } from '@/platform/services/model/common';
import type { ProductPrice } from '@/platform/services/model/price';
import type { Product, ProductTemplateAttributeType } from '@/platform/services/model/product';

/** Figma Link card outer border-box (`12799:113116`). */
const VARIANT_CARD_WIDTH_PX = 161;
/** Inner thumbnail / info width (`12799:113117`); 2px inset is the border. */
const VARIANT_CARD_INNER_WIDTH_PX = 157;
/** Gap between cards (Figma row gap / `spacing/4`). */
const VARIANT_CARD_GAP_PX = 16;
/** Figma Slider Controls (`12799:113113`) — 40×40, icon 24×24. */
const VARIANT_CAROUSEL_PAGER_CLASS_NAME =
  'static size-10 translate-y-0 border-border-action bg-surface-primary p-2 disabled:border-transparent disabled:bg-surface-disabled [&_svg]:size-6 [&_svg]:text-icon-action';

export interface ProductVariantCarouselProps {
  variants: Product[];
  prices: ProductPrice[];
  currentProductId: string;
  attributeOrder: string[];
  attributeTypes?: Record<string, ProductTemplateAttributeType>;
  /** Localized names from Product Templates `attributes[].name`. */
  attributeLabels?: Record<string, LocalizedString>;
  /** Chip axes the shopper already selected — a single pinned value is omitted from card call-outs. */
  selectedFilters?: VariantAttributeFilters;
  /** Filter or navigation in flight — skeleton above the Sellable variants heading. */
  isLoading?: boolean;
  /** When set, the selector owns navigation (and can keep the list loader visible). */
  onVariantSelect?: (variantId: string) => void;
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

function ProductVariantCarouselValue({ label, value }: Readonly<{ label: string; value: string }>) {
  const full = label ? `${label}: ${value}` : value;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        {/* Span (not a button): the card is already a button. */}
        <span
          className="block min-w-0 truncate group-focus-visible:overflow-visible group-focus-visible:whitespace-normal"
          data-testid="product-variant-carousel-value"
        >
          {value}
        </span>
      </TooltipTrigger>
      <TooltipContent data-testid="product-variant-carousel-value-tooltip">{full}</TooltipContent>
    </Tooltip>
  );
}

export function resolvePageCount(variantCount: number, slidesPerPage: number): number {
  if (variantCount <= 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(variantCount / Math.max(1, slidesPerPage)));
}

function orderDisplayPairs(
  pairs: VariantAttributeDisplayPair[],
  attributeOrder: string[],
): VariantAttributeDisplayPair[] {
  if (attributeOrder.length === 0) {
    return pairs;
  }
  const pairByKey = new Map(pairs.map((pair) => [pair.key, pair]));
  return [
    ...attributeOrder.flatMap((key) => {
      const pair = pairByKey.get(key);
      return pair ? [pair] : [];
    }),
    ...pairs.filter((pair) => !attributeOrder.includes(pair.key)),
  ];
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
  attributeTypes,
  attributeLabels,
  selectedFilters = {},
  isLoading = false,
  onVariantSelect,
  className,
}: Readonly<ProductVariantCarouselProps>): JSX.Element | null {
  const t = useTranslations('product');
  const tCarousel = useTranslations('common.UI.Carousel');
  const locale = useLocale();
  const { l10n, l10nOrEmpty } = useL10n();
  const router = useRouter();
  const viewportRef = useRef<HTMLDivElement>(null);
  const selectedCardRef = useRef<HTMLButtonElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [userPage, setUserPage] = useState<number | null>(null);
  const [prevSelectionSyncKey, setPrevSelectionSyncKey] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const showListLoading = isLoading || isNavigating;

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
  }, [variants.length]);

  const slidesPerPage = resolveSlidesPerPage(viewportWidth);
  const pageCount = resolvePageCount(variants.length, slidesPerPage);
  const maxPage = Math.max(0, pageCount - 1);
  const selectedIndex = variants.findIndex((variant) => variant.id === currentProductId);
  const selectedPage = selectedIndex >= 0 && slidesPerPage >= 1 ? Math.floor(selectedIndex / slidesPerPage) : 0;
  const selectionSyncKey = `${currentProductId}:${slidesPerPage}:${variants.map((variant) => variant.id).join(',')}`;
  if (prevSelectionSyncKey !== selectionSyncKey) {
    setPrevSelectionSyncKey(selectionSyncKey);
    setUserPage(null);
    setIsNavigating(false);
  }
  const page = Math.min(userPage ?? selectedPage, maxPage);
  const showEmptySelection = variants.length === 0 && !showListLoading;

  useEffect(() => {
    selectedCardRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [currentProductId, page, variants]);

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
    setUserPage(Math.max(0, Math.min(nextPage, pageCount - 1)));
  };

  const openVariant = (variant: Product): void => {
    if (variant.sellable === false || variant.id === currentProductId) {
      return;
    }
    setIsNavigating(true);
    if (onVariantSelect) {
      onVariantSelect(variant.id);
      return;
    }
    startTransition(() => {
      router.push(`/product/${variant.id}`);
    });
  };

  return (
    <div className={cn('flex min-w-0 w-full flex-col gap-4', className)} data-testid="product-variant-carousel">
      {showListLoading ? (
        <output className="block w-full" data-testid="product-variant-list-loading">
          <span className="sr-only">{t('loadingVariants')}</span>
          <Skeleton className="h-6 w-full" />
        </output>
      ) : null}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <H5>{t('variants.sellableVariants')}</H5>
          <span className="text-base text-text-on-disabled">{t('variants.count', { count: variants.length })}</span>
        </div>
        <div className="flex items-center gap-6">
          {variants.length > 0 ? (
            <>
              <Button
                type="button"
                variant="carouselControl"
                size="icon"
                className={VARIANT_CAROUSEL_PAGER_CLASS_NAME}
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
                className={VARIANT_CAROUSEL_PAGER_CLASS_NAME}
                disabled={!canScrollNext}
                title={tCarousel('next')}
                data-testid="product-variant-carousel-next"
                onClick={() => goToPage(safePage + 1)}
              >
                <ChevronRight aria-label="Next slide" />
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {showEmptySelection ? (
        <p className="text-base text-text-placeholders" data-testid="product-variant-carousel-empty">
          {t('variants.noMatchingSellableVariants')}
        </p>
      ) : (
        <div
          ref={viewportRef}
          className="min-w-0 w-full overflow-hidden"
          data-testid="product-variant-carousel-viewport"
        >
          <div
            className="flex gap-4 transition-transform duration-300 ease-out"
            style={{ transform: `translate3d(-${translateXPx}px, 0, 0)` }}
            data-testid="product-variant-carousel-track"
            data-page={safePage}
          >
            {variants.map((variant) => {
              const isSelected = variant.id === currentProductId;
              const isDisabled = variant.sellable === false;
              const displayPairs = orderDisplayPairs(
                getUnselectedVariantAttributePairs(variant, selectedFilters),
                attributeOrder,
              );
              const price = getPrice(variant.id);
              const netAmount = resolveNetUnitPrice(price);
              const image = variant.images?.[0] ?? variant.primaryImage;
              const imageSrc = resolveProductImageSrc(image?.url);
              const namedAlt = image?.altText ? l10nOrEmpty(image.altText) : '';
              const imageAlt = imageSrc === PRODUCT_NO_IMAGE_SRC ? t('noImage') : namedAlt || l10nOrEmpty(variant.name);

              return (
                <button
                  key={variant.id}
                  ref={isSelected ? selectedCardRef : undefined}
                  type="button"
                  disabled={isDisabled}
                  aria-disabled={isDisabled || undefined}
                  className={cn(
                    'group box-border flex h-[228px] w-[161px] min-w-[161px] shrink-0 flex-col overflow-hidden rounded-sm border-2 p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2',
                    isSelected ? 'border-border-secondary' : 'border-border-primary',
                    isDisabled ? 'cursor-not-allowed bg-surface-disabled text-text-disabled' : 'cursor-pointer',
                  )}
                  data-testid="product-variant-carousel-card"
                  data-variant-selected={isSelected ? 'true' : 'false'}
                  onClick={() => openVariant(variant)}
                >
                  <div className="flex h-[112px] w-full items-center justify-center bg-surface-image-background p-4">
                    <div className="relative size-full">
                      <Image
                        src={imageSrc}
                        alt={imageAlt}
                        fill
                        className="object-contain object-center"
                        sizes={`${VARIANT_CARD_INNER_WIDTH_PX}px`}
                      />
                    </div>
                  </div>
                  <div className="flex h-[112px] w-full min-w-0 flex-col gap-2 px-2 py-1 text-base text-text-body">
                    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
                      {displayPairs.map((pair) => {
                        const displayValue =
                          resolveVariantAttributeValueLabel(pair.value, pair.valueName, l10n) ??
                          formatTemplateAttributeValue(pair.value, attributeTypes?.[pair.key], locale);
                        const resolvedLabel = resolveVariantAttributeLabel(pair.key, pair.name, attributeLabels, l10n);
                        const label = resolvedLabel === L10N_MISSING_LABEL ? '' : resolvedLabel;
                        return <ProductVariantCarouselValue key={pair.key} label={label} value={displayValue} />;
                      })}
                    </div>
                    <span className="shrink-0 font-bold" data-testid="product-variant-carousel-price">
                      {netAmount == null ? t('price.notAvailable') : formatCurrency(netAmount, price?.currency)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

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
