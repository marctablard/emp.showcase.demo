import React from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import type { LucideIcon } from 'lucide-react';
import { Circle, DropletOff, Globe, MapPin, Pin, Shield, ShoppingCart, Trees, Truck } from 'lucide-react';
import { ProductCharacteristic } from '@/components/product/product-characteristic';
import { ProductColorTile } from '@/components/product/product-color-tile';
import { ProductTag } from '@/components/product/product-tag';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Heading } from '@/components/ui/h';
import { useCart } from '@/hooks/cart/useCart';
import { useAvailableVariantValues } from '@/hooks/useAvailableVariantValues';
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll';
import { useL10n } from '@/hooks/useL10n';
import { type ProductTemplateAttributeKey, dk } from '@/i18n/dynamic-key';
import { Link } from '@/i18n/navigation';
import { getPublicDefaultLanguage } from '@/lib/common/public-default-env';
import { getLogger } from '@/lib/logger/use-logger-client';
import { formatCurrency, imageSizes } from '@/lib/utils';
import type { Product } from '@/platform/services/model/product';
import { ToastType, notify } from '../ui/toast-notification';

interface ProductTileProps {
  product: Product;
  locale?: string;
  skipVariantFetch?: boolean;
}

export function ProductTile({ product, locale, skipVariantFetch = false }: ProductTileProps) {
  const t = useTranslations('product');
  const effectiveLocale = locale ?? getPublicDefaultLanguage();
  const { l10n } = useL10n(effectiveLocale);
  const { addItem, loading: cartLoading } = useCart();
  const horizontalScrollRef = useHorizontalScroll();

  const firstAttribute = product.variantAttributes?.[0];
  const { values: fetchedValues, loading: fetchedLoading } = useAvailableVariantValues(
    product,
    skipVariantFetch ? undefined : firstAttribute?.key,
  );
  const availableValues = skipVariantFetch ? (firstAttribute?.values ?? []) : fetchedValues;
  const variantLoading = skipVariantFetch ? false : fetchedLoading;

  const handleAddToCart = async (e: any) => {
    try {
      e.stopPropagation();
      e.preventDefault();

      if (!product) return;

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

  function getIcon(icon: unknown): LucideIcon {
    const s = typeof icon === 'string' ? icon : icon != null ? String(icon) : '';
    if (s.includes('years')) {
      return Shield;
    } else if (s === 'worldwide') {
      return Globe;
    } else if (s === 'waterproof') {
      return DropletOff;
    } else if (s === 'sustainable') {
      return Trees;
    }

    return Circle;
  }

  return (
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
            <Button
              variant="secondary"
              size="icon"
              title={t('addToWishlist')}
              className="h-[50px] w-[50px] flex-shrink-0"
            >
              <Pin width="24" height="24" />
            </Button>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-grow flex-col gap-4">
          <div className="bg-surface-image-background relative p-4">
            <div className="relative aspect-square rounded-ss-md rounded-ee-md p-4">
              {product.primaryImage ? (
                <div className="relative h-full w-full">
                  <Image
                    src={product.primaryImage.url}
                    alt={product.primaryImage.altText ? l10n(product.primaryImage.altText) : l10n(product.name)}
                    fill
                    sizes={imageSizes}
                    className="object-contain object-center"
                  />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Image src={'/images/no_image_alt.png'} alt={l10n(product.name)} width={220} height={220} />
                </div>
              )}
            </div>

            <div className="absolute right-4 bottom-4 flex flex-row justify-end gap-2">
              {!variantLoading && availableValues.length > 0 && (
                <>
                  {availableValues.slice(0, 3).map((value) => {
                    const isColorAttribute = firstAttribute!.key === 'color' || firstAttribute!.key === 'farbe';

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
                        unit={firstAttribute!.name ? l10n(firstAttribute!.name) : firstAttribute!.key}
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

            <div className="absolute top-4 -left-6 flex flex-col gap-2">
              {product.labels?.map((label) => (
                <Badge key={label.id} variant="info" rounded="roundedRight">
                  {label.name}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {product.templateAttributes && (
              <div className="w-full">
                {/* Dynamically display all template attributes */}
                {product.templateAttributes &&
                  Object.entries(product.templateAttributes).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <p className="text-sm">
                        {t(dk<ProductTemplateAttributeKey>(`filters.mixins.productTemplateAttributes.${key}`), {
                          defaultValue: key,
                        })}
                      </p>
                      <p className="text-sm font-bold capitalize">
                        {value}
                        {/* Todo: get unit from product */}
                        {key === 'length' || key === 'width' || key === 'height' ? 'cm' : ''}
                      </p>
                    </div>
                  ))}
              </div>
            )}
            <div ref={horizontalScrollRef} className="hide-scrollbar flex max-w-full gap-2 overflow-x-scroll">
              {product.usps?.map((usp) => (
                <ProductTag icon={getIcon(usp.icon)} text={l10n(usp.description)} key={l10n(usp.description)} />
              ))}
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <div className="flex w-full flex-col gap-1">
            <div className="text-text-success flex items-center gap-2 text-sm">
              {/* Todo: read availability from product */}
              <Truck />
              <p>{t('shipping.onlineAvailable')}</p>
            </div>
            <div className="text-text-success flex items-center gap-2 text-sm">
              {/* Todo: read pickup availability from product */}
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
                    <p className="text-lg font-bold">{formatCurrency(product.price.amount, product.price.currency)}</p>
                  )
                ) : (
                  <p className="text-lg font-bold">{t('price.priceNotAvailable')}</p>
                )}
              </div>
              <Button
                size="icon"
                className="h-[50px] w-[50px] self-end"
                onClick={(e) => handleAddToCart(e)}
                title={t('addToCart')}
                disabled={cartLoading}
              >
                <ShoppingCart width="24" height="24" />
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
