import React from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Circle, DropletOff, Globe, LucideIcon, MapPin, Pin, Shield, ShoppingCart, Trees, Truck } from 'lucide-react';
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
import { Link } from '@/i18n/navigation';
import { formatCurrency, imageSizes } from '@/lib/utils';
import { Product } from '@/platform/services/model/product';
import { ToastType, notify } from '../ui/toast-notification';

interface ProductTileProps {
  product: Product;
  locale?: string;
}

export function ProductTile({ product, locale = 'en' }: ProductTileProps) {
  const t = useTranslations('product');
  const { l10n } = useL10n(locale);
  const { addItem, loading: cartLoading } = useCart();
  const horizontalScrollRef = useHorizontalScroll();

  // Get available variant values for the first variant attribute
  const firstAttributeKey = product.variantAttributes?.[0]?.key;
  const { values: availableValues, loading: variantLoading } = useAvailableVariantValues(product, firstAttributeKey);

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
      console.error('Error adding to cart:', error);
      notify({
        title: error instanceof Error ? error.message : String(error),
        type: ToastType.Error,
      });
    }
  };

  function getIcon(icon: string): LucideIcon {
    if (icon.includes('years')) {
      return Shield;
    } else if (icon === 'worldwide') {
      return Globe;
    } else if (icon === 'waterproof') {
      return DropletOff;
    } else if (icon === 'sustainable') {
      return Trees;
    }

    return Circle;
  }

  return (
    <Link href={`/product/${product.id}`} className="h-full block">
      <Card shadow="default" rounded="md" className="border-0 gap-4 h-full flex flex-col hover:shadow-xl transition">
        <CardHeader className="flex-shrink-0 no-underline">
          <CardDescription className="font-medium text-base text-text-body h-6">
            {l10n(
              product.brand?.name || product.specifications?.find((spec) => spec.key === 'manufacturer')?.value || '',
            )}
          </CardDescription>
          <CardTitle className="flex gap-2 justify-between">
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

        <CardContent className="flex flex-col gap-4 flex-grow">
          <div className="relative bg-surface-image-background p-4">
            <div className="relative aspect-square rounded-ss-md rounded-ee-md p-4">
              {product.primaryImage ? (
                <div className="relative w-full h-full">
                  <Image
                    src={product.primaryImage.url}
                    alt={product.primaryImage.altText ? l10n(product.primaryImage.altText) : l10n(product.name)}
                    fill
                    sizes={imageSizes}
                    className="object-contain object-center"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Image src={'/images/no_image_alt.png'} alt={l10n(product.name)} width={220} height={220} />
                </div>
              )}
            </div>

            <div className="absolute right-4 bottom-4 flex flex-row gap-2 justify-end">
              {!variantLoading && availableValues.length > 0 && (
                <>
                  {availableValues.slice(0, 3).map((value) => {
                    const firstAttribute = product.variantAttributes![0];
                    const isColorAttribute = firstAttribute.key === 'color' || firstAttribute.key === 'farbe';

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
                        unit={firstAttribute.name ? l10n(firstAttribute.name) : firstAttribute.key}
                      />
                    );
                  })}
                  {availableValues.length > 3 && (
                    <div className="flex items-center justify-center w-8 h-8 bg-surface-disabled text-text-on-disabled text-sm font-medium rounded">
                      +{availableValues.length - 3}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col gap-2 absolute top-4 -left-6">
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
                        {t(`filters.mixins.productTemplateAttributes.${key}`, {
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
            <div ref={horizontalScrollRef} className="flex gap-2 max-w-full overflow-x-scroll hide-scrollbar">
              {product.usps?.map((usp) => (
                <ProductTag icon={getIcon(usp.icon)} text={l10n(usp.description)} key={l10n(usp.description)} />
              ))}
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <div className="flex flex-col gap-1 w-full">
            <div className="flex gap-2 text-text-success text-sm items-center">
              {/* Todo: read availability from product */}
              <Truck />
              <p>{t('shipping.onlineAvailable')}</p>
            </div>
            <div className="flex gap-2 text-text-success text-sm items-center">
              {/* Todo: read pickup availability from product */}
              <MapPin />
              <p>{t('shipping.canBeReservedExample')}</p>
            </div>
            <div className="flex justify-between items-end">
              <div className="flex flex-col gap-1">
                {product.price ? (
                  product.price.originalAmount && product.price.originalAmount !== product.price.amount ? (
                    <>
                      <p className="line-through">
                        {formatCurrency(product.price.originalAmount, product.price.currency)}
                      </p>
                      <p className="text-lg text-text-error font-bold">
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
