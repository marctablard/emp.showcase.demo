import React from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import type { LucideIcon } from 'lucide-react';
import { Circle, DropletOff, FlipHorizontal2, Globe, MapPin, Shield, ShoppingCart, Trees, Truck } from 'lucide-react';
import { ProductCharacteristic } from '@/components/product/product-characteristic';
import { ProductColorTile } from '@/components/product/product-color-tile';
import { ProductLabels } from '@/components/product/product-labels';
import { ProductTag } from '@/components/product/product-tag';
import { TemplateAttributeValue } from '@/components/product/template-attribute-value';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Heading } from '@/components/ui/h';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { WishlistPinButton } from '@/components/wishlist/wishlist-pin-button';
import { useCart } from '@/hooks/cart/useCart';
import { useValidateAddToCart } from '@/hooks/cart/useValidateAddToCart';
import { useComparison } from '@/hooks/comparison/useComparison';
import { useValidateAddToComparison } from '@/hooks/comparison/useValidateAddToComparison';
import { useAvailableVariantValues } from '@/hooks/useAvailableVariantValues';
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll';
import { useL10n } from '@/hooks/useL10n';
import { useWishlistAddWithAuth } from '@/hooks/wishlist/useWishlistAddWithAuth';
import { type ProductVariantAttributeKey, dk } from '@/i18n/dynamic-key';
import { Link } from '@/i18n/navigation';
import {
  orderedTemplateAttributeEntries,
  resolveTemplateAttributeLabel,
} from '@/lib/common/product-template-attributes';
import { getLogger } from '@/lib/logger/use-logger-client';
import { formatCurrency, imageSizes } from '@/lib/utils';
import type { Product, ProductUSP } from '@/platform/services/model/product';
import { MAX_COMPARISON_PRODUCTS } from '@/stores/comparison-store';
import { ToastType, notify } from '../ui/toast-notification';

interface ProductTileProps {
  product: Product;
  locale?: string;
  skipVariantFetch?: boolean;
  showParentVariantBadge?: boolean;
}

function getProductUspKey(usp: ProductUSP, index: number): string {
  const descriptionKey =
    typeof usp.description === 'string'
      ? usp.description
      : Object.entries(usp.description ?? {})
          .sort(([leftLocale], [rightLocale]) => leftLocale.localeCompare(rightLocale))
          .map(([locale, value]) => `${locale}:${value}`)
          .join('|');

  return `${usp.icon}:${descriptionKey}:${index}`;
}

export function ProductTile({
  product,
  locale,
  skipVariantFetch = false,
  showParentVariantBadge = false,
}: ProductTileProps) {
  const t = useTranslations('product');
  const { l10n, l10nOrEmpty } = useL10n(locale);
  const { addItem, loading: cartLoading } = useCart();
  const { isInComparison, toggleProduct, isFull } = useComparison();
  const { disabled: cartDisabled, tooltip: cartTooltip } = useValidateAddToCart(product);
  const { disabled: wishlistDisabled, tooltip: wishlistTooltip } = useValidateAddToCart(product, undefined, 'wishlist');
  const { disabled: compareDisabled, tooltip: compareTooltip } = useValidateAddToComparison(product);
  const { addToWishlist, isAdding: isAddingToWishlist, loginDialog } = useWishlistAddWithAuth();
  const horizontalScrollRef = useHorizontalScroll();

  const firstAttribute = product.variantAttributes?.[0];
  const firstAttributeLabel = firstAttribute
    ? t(dk<ProductVariantAttributeKey>(`filters.mixins.productVariantAttributes.${firstAttribute.key}`), {
        defaultValue: firstAttribute.name ? l10n(firstAttribute.name) : firstAttribute.key,
      })
    : '';
  const { values: fetchedValues, loading: fetchedLoading } = useAvailableVariantValues(
    product,
    skipVariantFetch ? undefined : firstAttribute?.key,
  );
  const availableValues = skipVariantFetch ? (firstAttribute?.values ?? []) : fetchedValues;
  const variantLoading = skipVariantFetch ? false : fetchedLoading;

  const handleAddToCart = async (e: React.MouseEvent) => {
    try {
      e.stopPropagation();
      e.preventDefault();

      await addItem(product.id, 1);

      notify({
        title: `${l10n(product.name)} ${t('addedToCartDescription')}`,
        type: ToastType.Success,
      });
    } catch (error) {
      getLogger().error({ err: error }, 'Error adding to cart');
      notify({
        title: error instanceof Error ? error.message : String(error),
        type: ToastType.Error,
      });
    }
  };

  const handleAddToWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    addToWishlist(product.id, 1);
  };

  function getIcon(icon: unknown): LucideIcon {
    const symbol = typeof icon === 'string' ? icon : icon != null ? String(icon) : '';

    if (symbol.includes('years')) {
      return Shield;
    }
    if (symbol === 'worldwide') {
      return Globe;
    }
    if (symbol === 'waterproof') {
      return DropletOff;
    }
    if (symbol === 'sustainable') {
      return Trees;
    }

    return Circle;
  }

  const handleCompareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isInComparison(product.id)) {
      toggleProduct(product.id);
      notify({ title: t('removedFromComparison', { name: l10n(product.name) }), type: ToastType.Info });
      return;
    }

    if (isFull) {
      notify({ title: t('comparisonFull', { max: MAX_COMPARISON_PRODUCTS }), type: ToastType.Warning });
      return;
    }

    toggleProduct(product.id);
    notify({ title: t('addedToComparison', { name: l10n(product.name) }), type: ToastType.Success });
  };

  return (
    <>
      <Link href={`/product/${product.id}`} className="block h-full">
        <Card shadow="default" rounded="md" className="flex h-full flex-col gap-4 border-0 transition hover:shadow-xl">
          <CardHeader className="flex-shrink-0 no-underline">
            <CardDescription className="text-text-body h-6 text-base font-medium">
              {l10n(
                product.brand?.name || product.specifications?.find((spec) => spec.key === 'manufacturer')?.value || '',
              )}
            </CardDescription>
            <CardTitle className="flex justify-between gap-2">
              <Heading variant="h5" as="div" className="md:hidden">
                <p className="line-clamp-3">{l10n(product.name)}</p>
              </Heading>
              <Heading variant="h6" as="div" className="hidden md:block">
                <p className="line-clamp-2">{l10n(product.name)}</p>
              </Heading>
              <div className="flex flex-shrink-0 gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        variant={isInComparison(product.id) ? 'primary' : 'secondary'}
                        size="icon"
                        aria-label={isInComparison(product.id) ? t('compareTooltipRemove') : t('compareTooltipAdd')}
                        aria-pressed={isInComparison(product.id)}
                        className="h-[50px] w-[50px]"
                        onClick={handleCompareClick}
                        disabled={compareDisabled}
                      >
                        <FlipHorizontal2 width="24" height="24" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {compareTooltip ??
                      (isInComparison(product.id) ? t('compareTooltipRemove') : t('compareTooltipAdd'))}
                  </TooltipContent>
                </Tooltip>
                <WishlistPinButton
                  disabled={wishlistDisabled}
                  disabledTooltip={wishlistTooltip}
                  isAdding={isAddingToWishlist}
                  onClick={handleAddToWishlist}
                  className="h-[50px] w-[50px]"
                />
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex flex-grow flex-col gap-4">
            <div className="bg-surface-image-background relative p-4">
              {showParentVariantBadge && product.isParentVariant && (product.variantCount ?? 0) > 0 && (
                <div className="absolute top-4 right-4 z-10">
                  <Badge data-testid="parent-variant-count-badge" variant="white" rounded="full">
                    {product.variantCount}
                  </Badge>
                </div>
              )}
              <div className="relative aspect-square rounded-ss-md rounded-ee-md p-4">
                {product.primaryImage ? (
                  <div className="relative h-full w-full">
                    <Image
                      src={product.primaryImage.url}
                      alt={
                        product.primaryImage.altText
                          ? l10nOrEmpty(product.primaryImage.altText) || l10nOrEmpty(product.name) || ''
                          : l10nOrEmpty(product.name) || ''
                      }
                      fill
                      sizes={imageSizes}
                      className="object-contain object-center"
                    />
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Image
                      src={'/images/no_image_alt.png'}
                      alt={l10nOrEmpty(product.name) || ''}
                      width={220}
                      height={220}
                    />
                  </div>
                )}
              </div>

              <div className="absolute right-4 bottom-4 flex max-w-full flex-wrap justify-end gap-2">
                {!variantLoading && availableValues.length > 0 && (
                  <>
                    {availableValues.slice(0, 3).map((value) => {
                      const isColorAttribute = firstAttribute?.key === 'color' || firstAttribute?.key === 'farbe';

                      return isColorAttribute ? (
                        <ProductColorTile
                          key={value.key}
                          attributeKey={value.key}
                          attributeName={value.name ? l10n(value.name) : value.key}
                          size="sm"
                          showCheckmark={false}
                        />
                      ) : (
                        <ProductCharacteristic
                          key={value.key}
                          value={value.name ? l10n(value.name) : value.key}
                          unit={firstAttribute?.name ? l10n(firstAttribute.name) : (firstAttribute?.key ?? '')}
                          attributeLabel={firstAttributeLabel}
                        />
                      );
                    })}
                    {availableValues.length > 3 && (
                      <div className="bg-surface-disabled text-text-on-disabled flex h-8 w-8 items-center justify-center rounded text-sm font-medium">
                        +{availableValues.length - 3}
                      </div>
                    )}
                  </>
                )}
              </div>

              {product.labels && product.labels.length > 0 ? (
                <ProductLabels labels={product.labels} className="absolute top-4 -left-6 flex-col" />
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              {product.templateAttributes && (
                <div className="w-full">
                  {orderedTemplateAttributeEntries(product.templateAttributes, product.templateAttributeOrder).map(
                    ([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <p className="text-sm">
                          {resolveTemplateAttributeLabel(key, product.templateAttributeLabels, l10n)}
                        </p>
                        <p className="flex items-center text-sm font-bold capitalize">
                          <TemplateAttributeValue
                            value={value}
                            type={product.templateAttributeTypes?.[key]}
                            locale={locale ?? 'en'}
                          />
                          {key === 'length' || key === 'width' || key === 'height' ? 'cm' : ''}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              )}
              <div ref={horizontalScrollRef} className="hide-scrollbar flex max-w-full gap-2 overflow-x-scroll">
                {product.usps?.map((usp, index) => (
                  <ProductTag
                    icon={getIcon(usp.icon)}
                    text={l10n(usp.description)}
                    key={getProductUspKey(usp, index)}
                  />
                ))}
              </div>
            </div>
          </CardContent>

          <CardFooter>
            <div className="flex w-full flex-col gap-1">
              <div className="text-text-success flex items-center gap-2 text-sm">
                <Truck />
                <p>{t('shipping.onlineAvailable')}</p>
              </div>
              <div className="text-text-success flex items-center gap-2 text-sm">
                <MapPin />
                <p>{t('shipping.canBeReservedExample')}</p>
              </div>
              <div className="flex items-end justify-between">
                <div className="flex flex-col gap-1">
                  {product.price ? (
                    product.price.originalAmount && product.price.originalAmount !== product.price.amount ? (
                      <>
                        <p className="line-through">
                          {formatCurrency(product.price.originalAmount, product.price.currency)}
                        </p>
                        <p className="text-text-error text-lg font-bold">
                          {formatCurrency(product.price.amount, product.price.currency)}
                        </p>
                      </>
                    ) : (
                      <p className="text-lg font-bold">
                        {formatCurrency(product.price.amount, product.price.currency)}
                      </p>
                    )
                  ) : (
                    <p className="text-lg font-bold">{t('price.priceNotAvailable')}</p>
                  )}
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex self-end">
                      <Button
                        size="icon"
                        className="h-[50px] w-[50px]"
                        onClick={handleAddToCart}
                        aria-label={t('addToCart')}
                        disabled={cartLoading || cartDisabled || !product.price}
                      >
                        <ShoppingCart width="24" height="24" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{cartTooltip ?? t('addToCart')}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardFooter>
        </Card>
      </Link>
      {loginDialog}
    </>
  );
}
