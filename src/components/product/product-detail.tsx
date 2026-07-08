'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Copy, FlipHorizontal2, Share2, Sun } from 'lucide-react';
import { ProductCarousel } from '@/components/product/product-carousel';
import { Badge } from '@/components/ui/badge';
import { BulletPoint } from '@/components/ui/bullet-point';
import { Card, CardContent } from '@/components/ui/card';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { WishlistPinButton } from '@/components/wishlist/wishlist-pin-button';
import { useValidateAddToCart } from '@/hooks/cart/useValidateAddToCart';
import { useShopContextReady } from '@/hooks/common/useShopContextReady';
import { useComparison } from '@/hooks/comparison/useComparison';
import { useValidateAddToComparison } from '@/hooks/comparison/useValidateAddToComparison';
import { useProduct } from '@/hooks/product/useProduct';
import { useSession } from '@/hooks/session/useSession';
import { useSite } from '@/hooks/site/useSite';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useL10n } from '@/hooks/useL10n';
import { useWishlistAddWithAuth } from '@/hooks/wishlist/useWishlistAddWithAuth';
import { fetchProductAvailability } from '@/lib/client/availability';
import { fetchProductPrice } from '@/lib/client/prices';
import {
  isProductPriceDisplayableForPurchase,
  isPurchaseShopContextReady,
} from '@/lib/common/product-price-site-context';
import { getLogger } from '@/lib/logger/use-logger-client';
import { isVariantConfiguratorProduct } from '@/lib/product/variant-configurator';
import { cn } from '@/lib/utils';
import type { StockAvailability } from '@/platform/services/model/common';
import type { ProductPrice } from '@/platform/services/model/price';
import type { GroupedSpecification, Product } from '@/platform/services/model/product';
import type { ProductFetchOptions } from '@/platform/services/product';
import { MAX_COMPARISON_PRODUCTS } from '@/stores/comparison-store';
import { Button } from '../ui/button';
import { H1, H2, Overline } from '../ui/h';
import { Spinner } from '../ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import ProductAddToCart from './product-add-to-cart';
import ProductAddToCartBar from './product-add-to-cart-bar';
import { ProductDescription } from './product-description';
import { ProductDetailRecommendations } from './product-detail-recommendations';
import { ProductKeySpecs } from './product-key-specs';
import { ProductPriceComponent, ProductPriceSkeleton, ProductPriceUnavailable } from './product-price';
import { ProductShippingInfo } from './product-shipping-info';
import ProductVariantSelector from './product-variant-selector';
import { RelatedMaterials } from './related-materials';

export interface ProductDetailProps {
  product?: Product | string;
  options: ProductFetchOptions;
  className?: string;
}

export default function ProductDetail({ product: initialProduct, options, className }: ProductDetailProps) {
  const { ready: shopContextReady } = useShopContextReady();
  const { product, loading, setAsCurrent } = useProduct(initialProduct, options);
  const initialProductObject = initialProduct && typeof initialProduct === 'object' ? initialProduct : undefined;
  const relatedItems =
    product?.relatedItems && product.relatedItems.length > 0
      ? product.relatedItems
      : initialProductObject?.relatedItems;
  const { session } = useSession();
  const { site } = useSite();
  const [price, setPrice] = useState<ProductPrice | null | undefined>(product?.price);
  const [availability, setAvailability] = useState<StockAvailability | undefined>(product?.availability);
  const locale = useLocale();
  const { l10n } = useL10n(locale);
  const t = useTranslations('product');
  const isAboveMediumScreen = useBreakpoint('md');
  const { isInComparison, toggleProduct, isFull } = useComparison();
  const { disabled: compareDisabled, tooltip: compareTooltip } = useValidateAddToComparison(product);
  const addToCartButton = useRef<HTMLDivElement>(null);
  const addToCartBar = useRef<HTMLDivElement>(null);
  const technicalInfoRef = useRef<HTMLDivElement>(null);
  const { addToWishlist, isAdding: isAddingToWishlist, loginDialog } = useWishlistAddWithAuth();
  const { disabled: wishlistDisabled, tooltip: wishlistTooltip } = useValidateAddToCart(
    product ?? undefined,
    price,
    'wishlist',
  );
  const [quantity, setQuantity] = useState(1);
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

    if (!product?.id) {
      setPrice(undefined);
      return () => {
        cancelled = true;
      };
    }

    if (!session?.currency || !session?.siteCode || !isPurchaseShopContextReady(session, site)) {
      setPrice(undefined);
      return () => {
        cancelled = true;
      };
    }

    const embedded = product.price;
    if (
      embedded !== undefined &&
      embedded !== null &&
      embedded.currency &&
      isProductPriceDisplayableForPurchase(embedded.currency, session, site)
    ) {
      setPrice(embedded);
    } else {
      const syncPrice = async () => {
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
      void syncPrice();
    }

    return () => {
      cancelled = true;
    };
  }, [product, session, site]);

  // Stock / delivery context is site+session scoped — refetch when shop context changes (do not reuse another site's row).
  useEffect(() => {
    const syncGeneration = ++availabilitySyncGenerationRef.current;
    let cancelled = false;

    if (!product?.id) {
      setAvailability(undefined);
      return () => {
        cancelled = true;
      };
    }

    if (!session?.currency || !session?.siteCode || !isPurchaseShopContextReady(session, site)) {
      setAvailability(undefined);
      return () => {
        cancelled = true;
      };
    }

    const shopSyncKey = `${session.siteCode}|${session.currency}|${site?.code ?? ''}|${product.id}`;
    if (availabilityShopContextRef.current !== '' && availabilityShopContextRef.current !== shopSyncKey) {
      setAvailability(undefined);
    }
    availabilityShopContextRef.current = shopSyncKey;

    setAvailability(undefined);
    const syncAvailability = async () => {
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
    void syncAvailability();

    return () => {
      cancelled = true;
    };
  }, [product?.id, session, site]);

  useEffect(() => {
    if (!product || isVariantConfiguratorProduct(product)) {
      setOpacity(false);
      return;
    }

    if (addToCartButton.current === null || !isAboveMediumScreen) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setOpacity(!entry.isIntersecting);
        });
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 1.0,
      },
    );

    observer.observe(addToCartButton.current);

    return () => {
      observer.disconnect();
    };
  }, [product, isAboveMediumScreen]);

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

  const showVariantConfigurator = isVariantConfiguratorProduct(product);
  const descriptionHtml = l10n(product.description);

  const scrollToTechnicalInfo = () => {
    technicalInfoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <div className={cn('grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-x-10 lg:gap-x-16 mb-10', className)}>
        <div className="flex flex-col gap-6">
          <Card variant="gray" rounded="lg" className="p-4 md:p-6">
            <CardContent className="px-0">
              <div className="overflow-hidden">
                {product.images && product.images.length > 0 ? (
                  product.images.length === 1 ? (
                    <div className="relative aspect-square">
                      <Image
                        src={product.images[0].url}
                        alt={product.images[0].altText ? l10n(product.images[0].altText) : l10n(product.name)}
                        fill
                        className="object-contain object-center"
                      />
                    </div>
                  ) : (
                    <ProductCarousel images={product.images} />
                  )
                ) : (
                  <div className="bg-surface-image-background flex aspect-square items-center justify-center">
                    <Image src={'/images/no_image_alt.png'} alt={l10n(product.name)} width={90} height={90} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <ProductKeySpecs product={product} onScrollToTechnicalInfo={scrollToTechnicalInfo} />
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {product.labels?.map((label) => (
                <Badge key={label.id} variant="info" rounded="roundedRight" className="h-7">
                  {label.name}
                </Badge>
              ))}
            </div>
            <div className="hidden shrink-0 gap-2 md:flex">
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

          {product.brand && (
            <Overline className="flex items-center gap-2 text-sm">
              {product.brand.logo?.url && (
                <Image
                  src={product.brand.logo?.url}
                  alt={product.brand.name ? l10n(product.brand.name) : ''}
                  height={32}
                  width={32}
                  className="object-contain"
                />
              )}
              <span>{product.brand.name ? l10n(product.brand.name) : ''}</span>
            </Overline>
          )}

          <div>
            <H1 className="text-2xl md:text-3xl lg:text-4xl">{l10n(product.name)}</H1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-placeholders">
              <span>
                <span className="uppercase tracking-wide">{t('sku')}</span>:{' '}
                <span className="font-medium text-text-headings">{product.sku || product.id}</span>
              </span>
              <span className="hidden sm:inline text-border-primary">|</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="uppercase tracking-wide">{t('itemNumber')}</span>:{' '}
                <span className="font-medium text-text-headings">{product.id}</span>
                <Copy className="h-3.5 w-3.5" aria-label={t('copy')} />
              </span>
            </div>
          </div>

          <div ref={addToCartButton}>
            {price === undefined ? (
              <ProductPriceSkeleton />
            ) : price === null ? (
              <ProductPriceUnavailable />
            ) : (
              <ProductPriceComponent price={price} />
            )}
          </div>

          {!showVariantConfigurator && (
            <ProductAddToCart
              product={product}
              price={price}
              availability={availability}
              availabilityLoading={availability === undefined}
              quantity={quantity}
              onQuantityChange={setQuantity}
            />
          )}

          <div className="flex justify-center gap-2 md:hidden">
            <Tooltip>
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
            <Button size="icon" variant="secondary" aria-label={t('share')}>
              <Share2 />
            </Button>
          </div>

          {!showVariantConfigurator && product.variantAttributes && <ProductVariantSelector product={product} />}

          <ProductShippingInfo
            className="mt-0"
            currency={price?.currency ?? session?.currency}
            deliveryDays={
              availability?.isAvailable
                ? [0, 0]
                : [availability?.availableInDays || 1, (availability?.availableInDays || 1) + 2]
            }
          />

          {descriptionHtml && (
            <div className="border-t border-border-primary pt-6">
              <Overline className="mb-4 text-sm">{t('tabs.description')}</Overline>
              <ProductDescription html={descriptionHtml} />
            </div>
          )}

          {product.highlights?.[locale]?.length ? (
            <div className="border-t border-border-primary pt-6">
              <H2 variant="h6" className="mb-4 text-base font-headlines text-text-action">
                {t('productHighlights')}
              </H2>
              <div className="space-y-3">
                {product.highlights[locale].map((highlight) => (
                  <BulletPoint
                    key={highlight}
                    label={highlight}
                    iconColor="primary"
                    variant="default"
                    size="lg"
                    icon={Sun}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {!showVariantConfigurator && (
          <div
            className={cn(
              'md:col-span-2',
              opacity ? 'opacity-100' : 'opacity-0',
              'transition-opacity ease-in-out delay-150 duration-300',
            )}
            ref={addToCartBar}
          >
            <ProductAddToCartBar
              product={product}
              price={price}
              availability={availability}
              availabilityLoading={availability === undefined}
            />
          </div>
        )}
      </div>
      {showVariantConfigurator ? (
        <ProductVariantSelector
          product={product}
          className={cn(className, 'mb-12 border-t border-border-primary pt-10')}
        />
      ) : null}
      {product?.groupedSpecifications?.length ? (
        <div ref={technicalInfoRef} className={cn(className, 'mb-12')}>
          <Overline className="mb-6 text-sm">{t('technicalInformation')}</Overline>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {product.groupedSpecifications.map((spec: GroupedSpecification, index) => {
              return (
                <Card
                  key={index}
                  variant="default"
                  rounded="lg"
                  shadow="none"
                  className="gap-0 overflow-hidden border border-border-primary p-0"
                >
                  <p className="border-b border-border-primary bg-surface-disabled px-4 py-3 text-sm font-headlines font-bold">
                    {l10n(spec.groupName)}
                  </p>
                  <dl>
                    {spec.item.map((i) => (
                      <div
                        className="grid grid-cols-2 gap-3 border-b border-border-primary px-4 py-3 text-sm last:border-b-0"
                        key={l10n(i.label)}
                      >
                        <dt className="text-text-placeholders">{l10n(i.label)}</dt>
                        <dd className="font-medium text-text-headings">
                          {l10n(i.value)} {l10n(i.unit)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}

      <RelatedMaterials relatedItems={relatedItems} locale={locale} className={cn(className)} />

      <ProductDetailRecommendations productId={product.id} locale={locale} />
      {loginDialog}
    </>
  );
}
