'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { QuantityStepper } from '@/components/ui/molecules/quantity-stepper';
import { useAvailability } from '@/hooks/product/useAvailability';
import { useL10n } from '@/hooks/useL10n';
import { Link } from '@/i18n/navigation';
import { formatCurrency } from '@/lib/utils';
import type { Product } from '@/platform/services/model/product';
import { HighlightedText } from './highlighted-text';

interface QuickOrderProductCardProps {
  product: Product;
  quantity: number;
  onRemove: () => void;
  onUpdateQuantity: (quantity: number) => void;
}

export function QuickOrderProductCard({ product, quantity, onRemove, onUpdateQuantity }: QuickOrderProductCardProps) {
  const { l10n } = useL10n();
  const tCart = useTranslations('cart');
  const tA11y = useTranslations('quick-order.accessibility');
  const { availability } = useAvailability(product.id);
  const image = product.images?.[0];
  const brandName = l10n(product.brand?.name || '');
  const productName = l10n(product.name) || '';
  const itemNumber = product.sku || product.id;

  return (
    <div className="py-4 border-b border-border-primary first:border-t-0" data-testid={`product-card-${product.id}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-[100px] h-[65px] rounded-ss-md rounded-ee-md overflow-hidden bg-surface-image-background flex items-center justify-center">
          {image?.url ? (
            <Image
              src={image.url}
              alt={l10n(image.altText || '') || productName}
              width={100}
              height={65}
              className="object-contain w-[100px] h-[65px]"
            />
          ) : (
            <Image
              src="/images/no_image_alt.png"
              alt={productName}
              width={100}
              height={65}
              className="object-contain"
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {brandName && (
            <p className="text-sm text-text-placeholders">
              <HighlightedText text={brandName} />
            </p>
          )}
          <Link
            href={`/product/${product.id}`}
            className="text-sm font-headlines font-bold text-text-body hover:underline line-clamp-2"
          >
            <HighlightedText text={productName} />
          </Link>
          <p className="text-sm text-text-placeholders">{itemNumber}</p>

          {product.price && (
            <div className="mt-1">
              {product.price.originalAmount && product.price.originalAmount > product.price.amount && (
                <p className="text-sm text-text-placeholders line-through">
                  {formatCurrency(product.price.originalAmount, product.price.currency)}
                </p>
              )}
              <p className="text-base font-bold font-headlines">
                {formatCurrency(product.price.tax?.netValue ?? product.price.amount, product.price.currency)}
              </p>
              {product.price.tax?.netValue != null && (
                <span className="text-sm text-text-on-disabled">
                  {tCart('gross')}
                  {formatCurrency(product.price.tax.grossValue, product.price.currency)}
                </span>
              )}
            </div>
          )}

          <div className="mt-2 w-fit">
            <QuantityStepper
              value={quantity}
              onChange={onUpdateQuantity}
              size="sm"
              max={availability?.availableQuantity}
              onDelete={onRemove}
              decrementLabel={tA11y('decreaseQuantity')}
              incrementLabel={tA11y('increaseQuantity')}
              inputLabel={tA11y('quantity')}
              deleteLabel={tA11y('removeProduct')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
