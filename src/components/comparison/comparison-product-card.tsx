'use client';

import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { FlipHorizontal2, MapPin, Pin, ShoppingCart, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCart } from '@/hooks/cart/useCart';
import { useValidateAddToCart } from '@/hooks/cart/useValidateAddToCart';
import { useL10n } from '@/hooks/useL10n';
import { Link } from '@/i18n/navigation';
import { getLogger } from '@/lib/logger/use-logger-client';
import { formatCurrency, imageSizes } from '@/lib/utils';
import type { Product } from '@/platform/services/model/product';

interface ComparisonProductCardProps {
  product: Product;
  onRemove: (id: string) => void;
}

export function ComparisonProductCard({ product, onRemove }: ComparisonProductCardProps) {
  const locale = useLocale();
  const { l10n } = useL10n(locale);
  const t = useTranslations('comparison');
  const tProduct = useTranslations('product');
  const { addItem, loading: cartLoading } = useCart();
  const { disabled: cartDisabled, tooltip: cartTooltip } = useValidateAddToCart(product);

  const brand = l10n(
    product.brand?.name || product.specifications?.find((spec) => spec.key === 'manufacturer')?.value || '',
  );

  const handleAddToCart = async () => {
    try {
      await addItem(product.id, 1);
      notify({
        title: `${l10n(product.name)} ${tProduct('addedToCartDescription')}`,
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

  return (
    <div className="flex flex-1 min-w-0 flex-col border-l border-border-primary px-4 py-4">
      {/* Remove button — fixed height */}
      <div className="flex h-8 items-center justify-end">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="primary"
              className="h-8 w-8"
              onClick={() => onRemove(product.id)}
              aria-label={`${t('removeFromComparison')} ${l10n(product.name)}`}
            >
              <FlipHorizontal2 className="h-6 w-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('removeFromComparison')}</TooltipContent>
        </Tooltip>
      </div>

      {/* Image area — fixed height */}
      <div className="mt-3 flex w-full items-center justify-center rounded-2xl bg-surface-image-background p-6 h-[232px]">
        <div className="relative h-[200px] w-full">
          {product.primaryImage ? (
            <Image
              src={product.primaryImage.url}
              alt={product.primaryImage.altText ? l10n(product.primaryImage.altText) : l10n(product.name)}
              fill
              sizes={imageSizes}
              className="object-contain p-4"
            />
          ) : (
            <Image
              src="/images/no_image_alt.png"
              alt={l10n(product.name)}
              fill
              sizes={imageSizes}
              className="object-contain p-4"
            />
          )}
        </div>
      </div>

      {/* Brand — fixed height (single line or empty) */}
      <div className="mt-3 h-5">{brand && <p className="text-sm text-text-body truncate">{brand}</p>}</div>

      {/* Name — fixed height for 2 lines */}
      <div className="mt-1 h-12">
        <Link
          href={`/product/${product.id}`}
          className="font-headlines text-lg font-bold leading-6 text-text-headings hover:underline line-clamp-2"
        >
          {l10n(product.name)}
        </Link>
      </div>

      {/* Item number — fixed height */}
      <div className="mt-1 h-5">
        <p className="text-sm text-text-placeholders truncate">
          {t('itemNumber')}: {product.id}
        </p>
      </div>

      {/* Availability indicators — fixed height */}
      <div className="mt-2 flex h-11 flex-col justify-center gap-0.5">
        <div className="flex items-center gap-1.5 text-sm text-text-success">
          <Truck className="h-4 w-4 shrink-0" />
          <span>{t('onlineAvailable')}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-text-success">
          <MapPin className="h-4 w-4 shrink-0" />
          <span>{t('canBeReserved')}</span>
        </div>
      </div>

      {/* Price & CTA — fixed height */}
      <div className="mt-3 flex h-[50px] items-center gap-4">
        <div className="flex flex-1 min-w-0 flex-col justify-center">
          {product.price ? (
            product.price.originalAmount && product.price.originalAmount !== product.price.amount ? (
              <>
                <p className="text-sm font-normal line-through text-text-body">
                  {formatCurrency(product.price.originalAmount, product.price.currency)}
                </p>
                <p className="text-lg font-bold text-text-error">
                  {formatCurrency(product.price.amount, product.price.currency)}
                </p>
              </>
            ) : (
              <p className="text-xl font-bold text-text-headings">
                {formatCurrency(product.price.amount, product.price.currency)}
              </p>
            )
          ) : (
            <p className="text-sm text-text-body">{tProduct('price.priceNotAvailable')}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            size="icon"
            variant="secondary"
            className="h-[50px] w-[50px]"
            disabled
            title={t('addToWishlist')}
            aria-label={t('addToWishlist')}
          >
            <Pin className="h-6 w-6" />
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  size="icon"
                  className="h-[50px] w-[50px]"
                  onClick={handleAddToCart}
                  disabled={cartLoading || cartDisabled}
                  title={tProduct('addToCart')}
                >
                  <ShoppingCart className="h-6 w-6" />
                </Button>
              </span>
            </TooltipTrigger>
            {cartTooltip && <TooltipContent>{cartTooltip}</TooltipContent>}
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
