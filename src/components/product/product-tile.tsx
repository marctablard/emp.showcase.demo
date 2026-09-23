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
import { useComparisonToggle } from '@/hooks/comparison/useComparisonToggle';
import { useValidateAddToComparison } from '@/hooks/comparison/useValidateAddToComparison';
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll';
import { useL10n } from '@/hooks/useL10n';
import { useWishlistAddWithAuth } from '@/hooks/wishlist/useWishlistAddWithAuth';
import { Link } from '@/i18n/navigation';
import {
  formatTemplateAttributeValue,
  orderedTemplateAttributeEntries,
  resolveTemplateAttributeLabel,
  resolveVariantAttributeLabel,
  resolveVariantAttributeValueLabel,
} from '@/lib/common/product-template-attributes';
import {
  PARENT_VARIANT_LABEL_BADGE_LIMIT,
  VARIANT_ATTRIBUTE_PAIR_BADGE_LIMIT,
  type VariantAttributeDisplayPair,
  collectVariantAttributeKeys,
  getVariantAttributeDisplayPairs,
} from '@/lib/common/product-variant-attributes';
import { getLogger } from '@/lib/logger/use-logger-client';
import { formatCurrency, imageSizes } from '@/lib/utils';
import type { Product, ProductUSP, ProductVariantAttribute } from '@/platform/services/model/product';
import { ToastType, notify } from '../ui/toast-notification';

interface ProductTileProps {
  product: Product;
  locale?: string;
  /** Retained for PLP callers; chips now use payload attributes and no longer fetch. */
  skipVariantFetch?: boolean;
  showParentVariantBadge?: boolean;
}

type TileL10n = (value: string | NonNullable<Product['name']>) => string;

function getProductUspIcon(icon: string): LucideIcon {
  if (icon.includes('years')) {
    return Shield;
  }
  if (icon === 'worldwide') {
    return Globe;
  }
  if (icon === 'waterproof') {
    return DropletOff;
  }
  if (icon === 'sustainable') {
    return Trees;
  }

  return Circle;
}

/** Hidden until Battery Included parent-variant counts are investigated. */
function isParentVariantCountBadgeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SHOW_PARENT_VARIANT_COUNT_BADGE === 'true';
}

function shouldShowParentVariantCountBadge(showParentVariantBadge: boolean, product: Product): boolean {
  return (
    isParentVariantCountBadgeEnabled() &&
    showParentVariantBadge &&
    Boolean(product.isParentVariant) &&
    (product.variantCount ?? 0) > 0
  );
}

function ProductTileChipOverflow({ count }: Readonly<{ count: number }>) {
  if (count <= 0) {
    return null;
  }

  return (
    <div
      data-testid="product-tile-variant-overflow"
      className="bg-surface-disabled text-text-on-disabled flex h-8 w-8 shrink-0 items-center justify-center rounded text-sm font-medium"
    >
      +{count}
    </div>
  );
}

function ProductTileChipStack<T>({
  items,
  limit,
  getKey,
  renderItem,
}: Readonly<{
  items: readonly T[];
  limit: number;
  getKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
}>) {
  const visibleItems = items.slice(0, limit);
  const overflowCount = items.length - visibleItems.length;
  const leadingItems = visibleItems.slice(0, -1);
  const lastItem = visibleItems.at(-1);

  if (!lastItem) {
    return null;
  }

  return (
    <div data-testid="product-tile-variant-chips" className="absolute inset-x-4 bottom-4 flex flex-col items-end gap-2">
      {leadingItems.map((item) => (
        <React.Fragment key={getKey(item)}>{renderItem(item)}</React.Fragment>
      ))}
      <div
        data-testid="product-tile-variant-chips-last-row"
        className="flex w-full self-stretch items-end justify-end gap-2"
      >
        <ProductTileChipOverflow count={overflowCount} />
        {renderItem(lastItem)}
      </div>
    </div>
  );
}

function ProductTileLabelChip({ label }: Readonly<{ label: string }>) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          data-testid="product-tile-variant-label-chip"
          className="flex min-w-0 max-w-3/4 overflow-hidden rounded-sm border bg-transparent p-0 text-inherit"
        >
          <div className="min-w-0 truncate bg-surface-page px-1 py-0.5 text-center text-sm leading-tight">{label}</div>
        </button>
      </TooltipTrigger>
      <TooltipContent data-testid="product-characteristic-tooltip">{label}</TooltipContent>
    </Tooltip>
  );
}

function ProductTilePairChip({
  pair,
  product,
  locale,
  l10n,
}: Readonly<{
  pair: VariantAttributeDisplayPair;
  product: Product;
  locale?: string;
  l10n: TileL10n;
}>) {
  const label = resolveVariantAttributeLabel(pair.key, pair.name, product.templateAttributeLabels, l10n);
  const displayValue =
    resolveVariantAttributeValueLabel(pair.value, pair.valueName, l10n) ??
    formatTemplateAttributeValue(pair.value, product.templateAttributeTypes?.[pair.key], locale ?? 'en');
  const isColorAttribute = pair.key === 'color' || pair.key === 'farbe';

  if (isColorAttribute) {
    return <ProductColorTile attributeKey={pair.value} attributeName={displayValue} size="sm" showCheckmark={false} />;
  }

  return <ProductCharacteristic value={displayValue} unit={label} attributeLabel={label} className="max-w-3/4" />;
}

function ProductTilePrimaryImage({
  product,
  l10nOrEmpty,
}: Readonly<{
  product: Product;
  l10nOrEmpty: (value: unknown) => string;
}>) {
  const nameAlt = l10nOrEmpty(product.name);
  const image = product.primaryImage;

  if (!image) {
    return (
      <div className="flex h-full items-center justify-center">
        <Image src="/images/no_image_alt.png" alt={nameAlt} width={220} height={220} />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Image
        src={image.url}
        alt={l10nOrEmpty(image.altText) || nameAlt}
        fill
        sizes={imageSizes}
        className="object-contain object-center"
      />
    </div>
  );
}

function ProductTilePrice({
  price,
  unavailableLabel,
}: Readonly<{
  price?: Product['price'];
  unavailableLabel: string;
}>) {
  if (!price) {
    return <p className="text-lg font-bold">{unavailableLabel}</p>;
  }

  if (price.originalAmount && price.originalAmount !== price.amount) {
    return (
      <>
        <p className="line-through">{formatCurrency(price.originalAmount, price.currency)}</p>
        <p className="text-text-error text-lg font-bold">{formatCurrency(price.amount, price.currency)}</p>
      </>
    );
  }

  return <p className="text-lg font-bold">{formatCurrency(price.amount, price.currency)}</p>;
}

function isDimensionTemplateAttribute(key: string): boolean {
  return key === 'length' || key === 'width' || key === 'height';
}

function ProductTileTemplateAttributes({
  product,
  locale,
  l10n,
}: Readonly<{
  product: Product;
  locale?: string;
  l10n: TileL10n;
}>) {
  if (!product.templateAttributes) {
    return null;
  }

  return (
    <div className="w-full">
      {orderedTemplateAttributeEntries(product.templateAttributes, product.templateAttributeOrder).map(
        ([key, value]) => (
          <div key={key} className="flex justify-between">
            <p className="text-sm">{resolveTemplateAttributeLabel(key, product.templateAttributeLabels, l10n)}</p>
            <p className="flex items-center text-sm font-bold capitalize">
              <TemplateAttributeValue
                value={value}
                type={product.templateAttributeTypes?.[key]}
                locale={locale ?? 'en'}
              />
              {isDimensionTemplateAttribute(key) ? 'cm' : ''}
            </p>
          </div>
        ),
      )}
    </div>
  );
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

function findVariantAttributeName(product: Product, key: string): ProductVariantAttribute['name'] | undefined {
  const fromProduct = product.variantAttributes?.find((attribute) => attribute.key === key)?.name;
  if (fromProduct != null) {
    return fromProduct;
  }
  for (const variant of product.variants ?? []) {
    const fromChild = variant.variantAttributes?.find((attribute) => attribute.key === key)?.name;
    if (fromChild != null) {
      return fromChild;
    }
  }
  return undefined;
}

export function ProductTile({
  product,
  locale,
  skipVariantFetch: _skipVariantFetch = false,
  showParentVariantBadge = false,
}: Readonly<ProductTileProps>) {
  const t = useTranslations('product');
  const { l10n, l10nOrEmpty } = useL10n(locale);
  const { addItem, loading: cartLoading } = useCart();
  const { isInComparison, toggle: toggleComparison } = useComparisonToggle();
  const { disabled: cartDisabled, tooltip: cartTooltip } = useValidateAddToCart(product);
  const { disabled: wishlistDisabled, tooltip: wishlistTooltip } = useValidateAddToCart(product, undefined, 'wishlist');
  const { disabled: compareDisabled, tooltip: compareTooltip } = useValidateAddToComparison(product);
  const { addToWishlist, isAdding: isAddingToWishlist, loginDialog } = useWishlistAddWithAuth();
  const horizontalScrollRef = useHorizontalScroll();

  const parentLabelKeys = product.isParentVariant ? collectVariantAttributeKeys(product, product.variants ?? []) : [];
  const variantPairs = product.isParentVariant ? [] : getVariantAttributeDisplayPairs(product);

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

  const handleCompareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toggleComparison(product.id, l10n(product.name));
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
              {shouldShowParentVariantCountBadge(showParentVariantBadge, product) && (
                <div className="absolute top-4 right-4 z-10">
                  <Badge data-testid="parent-variant-count-badge" variant="white" rounded="full">
                    {product.variantCount}
                  </Badge>
                </div>
              )}
              <div className="relative aspect-square rounded-ss-md rounded-ee-md p-4">
                <ProductTilePrimaryImage product={product} l10nOrEmpty={l10nOrEmpty} />
              </div>

              {product.isParentVariant ? (
                <ProductTileChipStack
                  items={parentLabelKeys}
                  limit={PARENT_VARIANT_LABEL_BADGE_LIMIT}
                  getKey={(key) => key}
                  renderItem={(key) => (
                    <ProductTileLabelChip
                      label={resolveVariantAttributeLabel(
                        key,
                        findVariantAttributeName(product, key),
                        product.templateAttributeLabels,
                        l10n,
                      )}
                    />
                  )}
                />
              ) : (
                <ProductTileChipStack
                  items={variantPairs}
                  limit={VARIANT_ATTRIBUTE_PAIR_BADGE_LIMIT}
                  getKey={(pair) => pair.key}
                  renderItem={(pair) => (
                    <ProductTilePairChip pair={pair} product={product} locale={locale} l10n={l10n} />
                  )}
                />
              )}

              {product.labels && product.labels.length > 0 ? (
                <ProductLabels labels={product.labels} className="absolute top-4 -left-6 flex-col" />
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <ProductTileTemplateAttributes product={product} locale={locale} l10n={l10n} />
              <div ref={horizontalScrollRef} className="hide-scrollbar flex max-w-full gap-2 overflow-x-scroll">
                {product.usps?.map((usp, index) => (
                  <ProductTag
                    icon={getProductUspIcon(usp.icon)}
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
                  <ProductTilePrice price={product.price} unavailableLabel={t('price.priceNotAvailable')} />
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
