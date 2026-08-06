'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowDown, Copy, FlipHorizontal2, Share2, Sun } from 'lucide-react';
import { ProductCarousel } from '@/components/product/product-carousel';
import { Badge } from '@/components/ui/badge';
import { BulletPoint } from '@/components/ui/bullet-point';
import { Card, CardContent } from '@/components/ui/card';
import { EnergyBadge } from '@/components/ui/energy-badge';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { WishlistPinButton } from '@/components/wishlist/wishlist-pin-button';
import { useValidateAddToCart } from '@/hooks/cart/useValidateAddToCart';
import { startEffectTask } from '@/hooks/common/start-effect-task';
import { useLogger } from '@/hooks/common/useLogger';
import { useShopContextReady } from '@/hooks/common/useShopContextReady';
import { useComparison } from '@/hooks/comparison/useComparison';
import { useValidateAddToComparison } from '@/hooks/comparison/useValidateAddToComparison';
import { usePdpShippingCost } from '@/hooks/product/usePdpShippingCost';
import { useProduct } from '@/hooks/product/useProduct';
import { useSession } from '@/hooks/session/useSession';
import { useSite } from '@/hooks/site/useSite';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useL10n } from '@/hooks/useL10n';
import { useWishlistAddWithAuth } from '@/hooks/wishlist/useWishlistAddWithAuth';
import { type ProductTemplateAttributeKey, type ProductVariantAttributeKey, dk } from '@/i18n/dynamic-key';
import { fetchProductAvailability } from '@/lib/client/availability';
import { fetchProductPrice } from '@/lib/client/prices';
import { isEnergyEfficiencyClass } from '@/lib/common/energy-efficiency';
import { PDP_TECHNICAL_INFORMATION_SECTION_ID, getPdpTechnicalInformationHref } from '@/lib/common/pdp-sections';
import { hasKeySpecifications, hasLocalizedHighlights, hasTechnicalInformation } from '@/lib/common/product-content';
import {
  isProductPriceDisplayableForPurchase,
  isPurchaseShopContextReady,
} from '@/lib/common/product-price-site-context';
import { getLogger } from '@/lib/logger/use-logger-client';
import { cn } from '@/lib/utils';
import type { StockAvailability } from '@/platform/services/model/common';
import type { ProductPrice } from '@/platform/services/model/price';
import type {
  GroupedSpecification,
  Product,
  ProductSpecification,
  ProductVariantAttribute,
} from '@/platform/services/model/product';
import type { ProductFetchOptions } from '@/platform/services/product';
import { MAX_COMPARISON_PRODUCTS } from '@/stores/comparison-store';
import Recommendations from '../cms/recommendations';
import { Button } from '../ui/button';
import { H1, H2, H5 } from '../ui/h';
import UiLink from '../ui/link';
import { RatingStarRow } from '../ui/rating';
import { Spinner } from '../ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import ProductAddToCart from './product-add-to-cart';
import ProductAddToCartBar from './product-add-to-cart-bar';
import { ProductDescription } from './product-description';
import { ProductPriceComponent, ProductPriceSkeleton, ProductPriceUnavailable } from './product-price';
import { ProductShippingInfo } from './product-shipping-info';
import ProductVariantSelector from './product-variant-selector';

export interface ProductDetailProps {
  product?: Product | string;
  options: ProductFetchOptions;
  className?: string;
}

export default function ProductDetail({ product: initialProduct, options, className }: ProductDetailProps) {
  const { ready: shopContextReady } = useShopContextReady();
  const { product, loading, setAsCurrent } = useProduct(initialProduct, options);
  const { session } = useSession();
  const { site } = useSite();
  const [price, setPrice] = useState<ProductPrice | null | undefined>(product?.price);
  const [availability, setAvailability] = useState<StockAvailability | undefined>(product?.availability);
  const locale = useLocale();
  const { l10n, l10nOrEmpty } = useL10n(locale);
  const t = useTranslations('product');
  const logger = useLogger();
  const isAboveMediumScreen = useBreakpoint('md');
  const { isInComparison, toggleProduct, isFull } = useComparison();
  const { disabled: compareDisabled, tooltip: compareTooltip } = useValidateAddToComparison(product);
  const addToCartButton = useRef<HTMLDivElement>(null);
  const addToCartBar = useRef<HTMLDivElement>(null);
  const { addToWishlist, isAdding: isAddingToWishlist, loginDialog } = useWishlistAddWithAuth();
  const { disabled: wishlistDisabled, tooltip: wishlistTooltip } = useValidateAddToCart(
    product ?? undefined,
    price,
    'wishlist',
  );
  const [quantity, setQuantity] = useState(1);
  const { shippingCost, postalCode: shippingPostalCode } = usePdpShippingCost(price, quantity);
  const handleAddToWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!product) return;
    addToWishlist(product.id, quantity);
  };
  const priceSyncGenerationRef = useRef(0);
  const availabilitySyncGenerationRef = useRef(0);
  const availabilityShopContextRef = useRef('');
  const [opacity, setOpacity] = React.useState(false);
  //   const { recommendations, loading: recLoading } = useRecommendations(product?.id);
  useEffect(() => {
    if (product) {
      setAsCurrent();
    }
    return () => {
      setAsCurrent(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  // Price: keep aligned with session site/currency (store cache can hold another site's price until useProduct refetches).
  useEffect(() => {
    const syncGeneration = ++priceSyncGenerationRef.current;
    let cancelled = false;

    // Whole body runs off the effect's synchronous path so the setPrice calls below never
    // cascade inside this commit.
    const syncPrice = async () => {
      if (!product?.id) {
        setPrice(undefined);
        return;
      }

      if (!session?.currency || !session?.siteCode || !isPurchaseShopContextReady(session, site)) {
        setPrice(undefined);
        return;
      }

      const embedded = product.price;
      if (
        embedded !== undefined &&
        embedded !== null &&
        embedded.currency &&
        isProductPriceDisplayableForPurchase(embedded.currency, session, site)
      ) {
        setPrice(embedded);
        return;
      }

      const nextPrice = await fetchProductPrice(product.id, undefined, undefined, session.currency);
      if (cancelled || syncGeneration !== priceSyncGenerationRef.current) {
        return;
      }
      if (nextPrice?.currency && !isProductPriceDisplayableForPurchase(nextPrice.currency, session, site)) {
        getLogger().warn(
          {
            productId: product.id,
            currency: nextPrice.currency,
            sessionCurrency: session.currency,
            siteCode: site?.code,
          },
          'Rejected product price API response — currency not allowed for current shop context',
        );
        setPrice(null);
        return;
      }
      setPrice(nextPrice);
    };

    const cancelStart = startEffectTask(syncPrice);

    return () => {
      cancelled = true;
      cancelStart();
    };
  }, [product, session, site]);

  // Stock / delivery context is site+session scoped — refetch when shop context changes (do not reuse another site's row).
  useEffect(() => {
    const syncGeneration = ++availabilitySyncGenerationRef.current;
    let cancelled = false;

    // Whole body runs off the effect's synchronous path so the setAvailability calls below
    // never cascade inside this commit.
    const syncAvailability = async () => {
      if (!product?.id) {
        setAvailability(undefined);
        return;
      }

      if (!session?.currency || !session?.siteCode || !isPurchaseShopContextReady(session, site)) {
        setAvailability(undefined);
        return;
      }

      const shopSyncKey = `${session.siteCode}|${session.currency}|${site?.code ?? ''}|${product.id}`;
      availabilityShopContextRef.current = shopSyncKey;

      setAvailability(undefined);

      try {
        const nextAvailability = await fetchProductAvailability(product.id);
        if (cancelled || syncGeneration !== availabilitySyncGenerationRef.current) {
          return;
        }
        setAvailability(nextAvailability);
      } catch {
        if (cancelled || syncGeneration !== availabilitySyncGenerationRef.current) {
          return;
        }
        setAvailability(undefined);
      }
    };

    const cancelStart = startEffectTask(syncAvailability);

    return () => {
      cancelled = true;
      cancelStart();
    };
  }, [product?.id, session, site]);

  useEffect(() => {
    if (addToCartButton.current !== null && isAboveMediumScreen) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setOpacity(false);
            } else {
              setOpacity(true);
            }
          });
        },
        {
          root: null,
          rootMargin: '0px',
          threshold: 1.0,
        },
      );

      // Observe an element
      observer.observe(addToCartButton.current);
    }
  });

  const handleCompareClick = () => {
    if (!product) return;
    if (isInComparison(product.id)) {
      toggleProduct(product.id);
      notify({ title: t('removedFromComparison', { name: l10n(product.name) }), type: ToastType.Info });
    } else if (isFull) {
      notify({ title: t('comparisonFull', { max: MAX_COMPARISON_PRODUCTS }), type: ToastType.Warning });
    } else {
      toggleProduct(product.id);
      notify({ title: t('addedToComparison', { name: l10n(product.name) }), type: ToastType.Success });
    }
  };

  if (!shopContextReady || loading) {
    return (
      <div className={cn('flex justify-center items-center min-h-[400px] mb-6', className)}>
        <Spinner variant="lg" />
      </div>
    );
  }

  if (product === null) {
    return notFound();
  }

  const flaggedKeySpecs = product.specifications?.filter((spec: ProductSpecification) => spec.highlight === true) ?? [];
  const technicalInfoGroups = product.groupedSpecifications ?? [];
  const fewTechnicalInfoGroups = technicalInfoGroups.length > 0 && technicalInfoGroups.length < 4;

  const renderKeySpecValue = (spec: ProductSpecification): React.ReactNode => {
    const rawValue = l10n(spec.value);
    const unit = spec.unit ? l10n(spec.unit) : undefined;

    if (isEnergyEfficiencyClass(rawValue)) {
      return (
        <span className="flex items-center gap-1.5">
          <EnergyBadge rating={rawValue} />
          {unit ? <span className="font-normal text-base">{unit}</span> : null}
        </span>
      );
    }

    return unit ? `${rawValue} ${unit}` : rawValue;
  };

  const handleCopyItemNumber = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(product.id);
      notify({
        title: t('itemNumberCopied'),
        type: ToastType.Success,
        duration: 300,
      });
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error), productId: product.id },
        'Failed to copy item number to clipboard',
      );
    }
  };

  return (
    <>
      {/*
        PDP Top Area grid (Figma 12830:188844 / tablet 12823:84626 / mobile 12823:74032):
        - md+: two independent columns via contents→flex wrappers (left: gallery → key specs → highlights;
          right: tags+toolbar → title → price/ATC/shipping)
        - below md: `contents` flattens children into the parent grid; order-* matches mobile/tablet stack:
          title → tags+toolbar → gallery → price → key specs → highlights
      */}
      <div className={cn('grid grid-cols-1 gap-x-4 md:gap-x-12 lg:gap-x-20 md:grid-cols-2 mb-6', className)}>
        <div className="contents md:flex md:flex-col md:gap-6">
          <Card variant="gray" rounded="lg" className="order-3 md:order-0 p-6 md:p-8 mb-6 md:mb-0">
            <CardContent className="px-0">
              <div className="overflow-hidden">
                {product.images && product.images.length > 0 ? (
                  product.images.length === 1 ? (
                    <div className="relative aspect-square">
                      <Image
                        src={product.images[0].url}
                        alt={
                          product.images[0].altText
                            ? l10nOrEmpty(product.images[0].altText) ||
                              l10nOrEmpty(product.name) ||
                              t('primaryImageAltUnlabeled', { id: product.id })
                            : l10nOrEmpty(product.name) || t('primaryImageAltUnlabeled', { id: product.id })
                        }
                        fill
                        className="object-contain object-center"
                      />
                    </div>
                  ) : (
                    <ProductCarousel images={product.images} />
                  )
                ) : (
                  <div className="bg-surface-image-background flex items-center justify-center">
                    <Image
                      src={'/images/no_image_alt.png'}
                      alt={l10nOrEmpty(product.name) || ''}
                      width={90}
                      height={90}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {hasKeySpecifications(product) ? (
            <Card
              variant="primary"
              rounded="lg"
              className="order-5 md:order-0 p-4 md:px-8 md:pb-8 md:pt-6 mb-10 md:mb-0"
            >
              <CardContent className="p-0">
                <div className="flex flex-col gap-6">
                  <H2 variant="h4" className="text-text-on-action">
                    {t('keySpecs')}
                  </H2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-y-6 gap-x-12">
                    {flaggedKeySpecs.length > 0 ? (
                      flaggedKeySpecs.map((spec: ProductSpecification) => (
                        <BulletPoint
                          key={spec.key}
                          label={l10n(spec.label)}
                          labelClassName="font-headlines text-2xl font-bold"
                          variant="white"
                          iconColor="white"
                          iconSize="lg"
                          value={renderKeySpecValue(spec)}
                          valueClassName="font-normal"
                        />
                      ))
                    ) : (
                      <>
                        {product.variantAttributes?.map((attribute: ProductVariantAttribute) => (
                          <BulletPoint
                            key={attribute.key}
                            label={l10n(
                              t(
                                dk<ProductVariantAttributeKey>(
                                  `filters.mixins.productVariantAttributes.${attribute.key}`,
                                ),
                                {
                                  defaultValue: attribute.key,
                                },
                              ),
                            )}
                            labelClassName="font-headlines text-2xl font-bold"
                            variant="white"
                            iconColor="white"
                            iconSize="lg"
                            value={l10n(product.variantAttributeValues?.[attribute.key] ?? '')}
                            valueClassName="font-normal"
                          />
                        ))}
                        {Object.keys(product.templateAttributes || {}).map((attribute: string) => (
                          <BulletPoint
                            key={attribute}
                            label={t(
                              dk<ProductTemplateAttributeKey>(`filters.mixins.productTemplateAttributes.${attribute}`),
                              {
                                defaultValue: attribute,
                              },
                            )}
                            labelClassName="font-headlines text-2xl font-bold"
                            variant="white"
                            iconColor="white"
                            iconSize="lg"
                            value={l10n(product.templateAttributes?.[attribute] ?? '')}
                            valueClassName="font-normal"
                          />
                        ))}
                      </>
                    )}
                  </div>

                  {/* D6 (COP-6020): keep "More product features" despite newest Figma Specs List Area omitting it */}
                  {hasTechnicalInformation(product) && (
                    <div className="flex items-center mt-2">
                      <UiLink
                        type="A"
                        href={getPdpTechnicalInformationHref()}
                        variant="textBold"
                        size="m"
                        iconAfter={<ArrowDown aria-hidden="true" />}
                      >
                        {t('more')}
                      </UiLink>
                    </div>
                  )}

                  <div className="flex items-center mt-2">
                    <span className="text-text-on-action font-bold">{t('itemNumber')}:</span>
                    <span className="text-text-action ml-2 bg-surface-page py-2 px-3 rounded flex items-center gap-3">
                      <p>{product.id}</p>
                      <button
                        type="button"
                        onClick={() => {
                          void handleCopyItemNumber();
                        }}
                        aria-label={t('copy')}
                        className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-text-action outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1"
                      >
                        <Copy aria-hidden="true" className="size-6" />
                      </button>
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {hasLocalizedHighlights(product, locale) ? (
            <div className="order-6 md:order-0 mt-8 md:mt-10">
              <H2 variant="h3" className="text-text-action mb-8">
                {t('productHighlights')}
              </H2>
              <div className="mb-10 md:mb-0">
                {(product.highlights?.[locale] ?? []).map((highlight) => (
                  <BulletPoint
                    key={highlight}
                    label={highlight}
                    iconColor="primary"
                    variant="default"
                    size="lg"
                    icon={Sun}
                    className="mb-6 gap-4"
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="contents md:flex md:flex-col">
          {/* Single Compare/Wishlist/Share toolbar at every breakpoint (Figma Tag & Toolbar Row) */}
          <div
            className={cn(
              'order-2 md:order-0 flex flex-col gap-2 sm:flex-row sm:items-start mb-4 md:mb-0',
              product.labels && product.labels.length > 0 ? 'sm:justify-between' : 'sm:justify-end',
            )}
          >
            {product.labels && product.labels.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {product.labels.map((label) => (
                  <Badge key={label.id} variant="info" rounded="roundedRight" className="h-7">
                    {label.name}
                  </Badge>
                ))}
              </div>
            ) : null}
            <div className="flex gap-2">
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      size="icon"
                      variant={isInComparison(product.id) ? 'primary' : 'secondary'}
                      aria-label={t('compare')}
                      aria-pressed={isInComparison(product.id)}
                      onClick={handleCompareClick}
                      disabled={compareDisabled}
                    >
                      <FlipHorizontal2 />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {compareTooltip ?? (isInComparison(product.id) ? t('compareTooltipRemove') : t('compareTooltipAdd'))}
                </TooltipContent>
              </Tooltip>
              <WishlistPinButton
                disabled={wishlistDisabled}
                disabledTooltip={wishlistTooltip}
                isAdding={isAddingToWishlist}
                onClick={handleAddToWishlist}
              />
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="secondary" aria-label={t('share')}>
                    <Share2 />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('shareTooltip')}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="order-1 md:order-0 flex flex-col gap-2">
            {product.brand && (
              <div className="flex items-center gap-2">
                {product.brand.logo?.url && (
                  <Image
                    src={product.brand.logo.url}
                    alt={product.brand.name ? l10nOrEmpty(product.brand.name) : ''}
                    height={70}
                    width={70}
                  />
                )}
                {product.brand.name ? (
                  // TODO: Dedicated brand-listing route missing — brand-filtered PLP
                  // `/browse?filters[brand.name][]=…` probe returned 0 hits for Victron Energy
                  // (2026-08-06); keep non-interactive H5 to avoid a dead empty-result link (D10).
                  <H5 className="text-text-action">{l10n(product.brand.name)}</H5>
                ) : null}
              </div>
            )}
            <H1>{l10n(product.name)}</H1>
            {product.description ? <ProductDescription html={l10n(product.description)} /> : null}
            <div className="mb-6 md:mb-0 flex gap-2 items-center">
              <p className="text-text-on-disabled font-bold">4.6</p>
              <RatingStarRow starsCount={5} filledCount={4} className="py-2" />
              <p className="text-text-on-disabled text-sm">(114)</p>
            </div>
          </div>

          <div className="order-4 md:order-0">
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 md:grid-cols-3 lg:grid-cols-4"
              ref={addToCartButton}
            >
              <div className="col-start-1 sm:row-start-1 md:col-end-4 xl-col-end-5">
                {price === undefined ? (
                  <ProductPriceSkeleton />
                ) : price === null ? (
                  <ProductPriceUnavailable />
                ) : (
                  <ProductPriceComponent price={price} />
                )}
              </div>
            </div>
            <ProductAddToCart
              product={product}
              price={price}
              availability={availability}
              availabilityLoading={availability === undefined}
              quantity={quantity}
              onQuantityChange={setQuantity}
              className="mt-6"
            />
            {/* COP-4811: empty ProductVariantSelector mount left as-is */}
            {product.variantAttributes && <ProductVariantSelector product={product} className="mt-6" />}
            <ProductShippingInfo
              currency={price?.currency ?? session?.currency}
              shippingCost={shippingCost}
              postalCode={shippingPostalCode}
              deliveryDays={
                availability?.isAvailable
                  ? [0, 0]
                  : [availability?.availableInDays || 1, (availability?.availableInDays || 1) + 2]
              }
            />
          </div>
        </div>
      </div>
      <div
        className={cn(opacity ? 'opacity-100' : 'opacity-0', 'transition-opacity ease-in-out delay-150 duration-300')}
        ref={addToCartBar}
      >
        <ProductAddToCartBar
          product={product}
          price={price}
          availability={availability}
          availabilityLoading={availability === undefined}
        />
      </div>
      {hasTechnicalInformation(product) ? (
        <div id={PDP_TECHNICAL_INFORMATION_SECTION_ID} className={cn(className)}>
          <H2 variant="h3" className="my-6">
            {' '}
            {t('technicalInformation')}
          </H2>
          <div
            className={cn(
              'mb-16 gap-x-6 gap-y-6 md:gap-y-16 grid grid-cols-1 md:grid-cols-2',
              // D4: 1–3 groups fill the row equally at lg; 4+ keep four-per-row grid.
              fewTechnicalInfoGroups ? 'lg:flex lg:flex-row' : 'lg:grid-cols-4',
            )}
          >
            {technicalInfoGroups.map((spec: GroupedSpecification, index) => {
              return (
                <div className={cn('flex flex-col', fewTechnicalInfoGroups && 'lg:min-w-0 lg:flex-1')} key={index}>
                  <p className="font-bold font-headlines font-sm p-4 border-b border-border-primary">
                    {l10n(spec.groupName)}
                  </p>
                  {spec.item.map((i) => (
                    <div className="font-sm p-4 border-b border-border-primary flex gap-4" key={l10n(i.label)}>
                      <p className="w-1/2">{l10n(i.label)}</p>
                      <p className="w-1/2">
                        {l10n(i.value)} {l10n(i.unit)}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <Recommendations
        productId={product.id}
        locale={locale}
        overline={t('productRecommendations.overline')}
        headline={t('productRecommendations.headline')}
      />
      {loginDialog}
    </>
  );
}
