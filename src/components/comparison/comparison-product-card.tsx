'use client';

import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { FlipHorizontal2, MapPin, ShoppingCart, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { H3 } from '@/components/ui/h';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { WishlistPinButton } from '@/components/wishlist/wishlist-pin-button';
import { useCart } from '@/hooks/cart/useCart';
import { useValidateAddToCart } from '@/hooks/cart/useValidateAddToCart';
import type { ComparisonCardVariant } from '@/hooks/comparison/useComparisonScroller';
import { useL10n } from '@/hooks/useL10n';
import { useWishlistAddWithAuth } from '@/hooks/wishlist/useWishlistAddWithAuth';
import { Link } from '@/i18n/navigation';
import { getLogger } from '@/lib/logger/use-logger-client';
import { cn, formatCurrency, imageSizes } from '@/lib/utils';
import type { Product } from '@/platform/services/model/product';

interface ComparisonProductCardProps {
  product: Product;
  onRemove: (id: string) => void;
  /**
   * How much room the column offers. Beside the price the buttons are left with barely a third of
   * the column, where they crowd the amount — so below the width the card was drawn for, they move
   * underneath it. A narrower column shortens the image area on top of that.
   */
  variant?: ComparisonCardVariant;
  /** Drawn only between two visible products — see `useComparisonScroller`. */
  separator?: boolean;
}

export function ComparisonProductCard({
  product,
  onRemove,
  variant = 'roomy',
  separator = false,
}: ComparisonProductCardProps) {
  const compact = variant === 'compact';
  const stackedActions = variant !== 'roomy';
  const locale = useLocale();
  const { l10n } = useL10n(locale);
  const t = useTranslations('comparison');
  const tProduct = useTranslations('product');
  const { addItem, loading: cartLoading } = useCart();
  const { disabled: cartDisabled, tooltip: cartTooltip } = useValidateAddToCart(product);
  const { disabled: wishlistDisabled, tooltip: wishlistTooltip } = useValidateAddToCart(product, undefined, 'wishlist');
  const { addToWishlist, isAdding: isAddingToWishlist, loginDialog } = useWishlistAddWithAuth();

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

  const handleAddToWishlist = () => {
    addToWishlist(product.id, 1);
  };

  return (
    // `snap-start`: the scroller snaps to column starts, so a card is never left half cut off.
    <div
      className={cn(
        'flex min-w-0 snap-start flex-col py-4',
        compact ? 'px-3' : 'px-4',
        separator && 'border-l border-border-primary',
      )}
    >
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

      {/* Image area — fixed height, so the rows below it line up across the cards */}
      <div
        className={cn(
          'mt-3 flex w-full items-center justify-center rounded-2xl bg-surface-image-background',
          compact ? 'h-[140px] p-3' : 'h-[232px] p-6',
        )}
      >
        <div className={cn('relative w-full', compact ? 'h-[116px]' : 'h-[200px]')}>
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

      {/* Name — the row's heading under "Products". Fixed height for the two lines it clamps to,
          so the rows below stay aligned across the cards. */}
      <div className="mt-1 h-12">
        <H3 variant="h5">
          <Link href={`/product/${product.id}`} className="line-clamp-2 hover:underline">
            {l10n(product.name)}
          </Link>
        </H3>
      </div>

      {/* Item number — fixed height */}
      <div className="mt-1 h-5">
        <p data-testid="comparison-card-item-number" className="text-sm text-text-placeholders truncate">
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

      {/* Price & CTA. A minimum rather than a fixed height: at four products the columns get narrow
          enough for the price to wrap, and a clipped amount is worse than two cards ending at
          slightly different heights. */}
      <div
        data-testid="comparison-card-actions"
        className={cn('mt-3 flex min-h-[50px] gap-4', stackedActions ? 'flex-col gap-3' : 'items-center')}
      >
        <div data-testid="comparison-card-price" className="flex flex-1 min-w-0 flex-col justify-center">
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
          <WishlistPinButton
            disabled={wishlistDisabled}
            disabledTooltip={wishlistTooltip}
            isAdding={isAddingToWishlist}
            onClick={handleAddToWishlist}
            className="h-[50px] w-[50px]"
            itemName={l10n(product.name)}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  size="icon"
                  className="h-[50px] w-[50px]"
                  onClick={handleAddToCart}
                  disabled={cartLoading || cartDisabled}
                  title={tProduct('addToCart')}
                  // The comparison shows one of these per column; without the article they are four
                  // buttons with the same name. The tooltip keeps the short wording.
                  aria-label={`${tProduct('addToCart')} ${l10n(product.name)}`}
                >
                  <ShoppingCart className="h-6 w-6" />
                </Button>
              </span>
            </TooltipTrigger>
            {cartTooltip && <TooltipContent>{cartTooltip}</TooltipContent>}
          </Tooltip>
        </div>
      </div>
      {loginDialog}
    </div>
  );
}
