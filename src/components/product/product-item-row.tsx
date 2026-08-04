import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { formatCurrency } from '@/lib/utils';
import type { ProductListItem, ProductListPresentationConfig } from './product-list';

interface ProductItemRowProps {
  readonly item: ProductListItem;
  readonly locale?: string;
  readonly presentationConfig?: ProductListPresentationConfig;
  readonly showGrossUnderNet?: boolean;
}

export function ProductItemRow({ item, locale, presentationConfig, showGrossUnderNet = false }: ProductItemRowProps) {
  const t = useTranslations('cart');
  const tOrders = useTranslations('orders');
  const netPrice = item.netUnitPrice ?? item.unitPrice;
  const showGrossSecondary = presentationConfig?.showGrossSecondary ?? showGrossUnderNet;
  // Missing gross is rendered as a literal '-' secondary value; it is never derived from net/unit price.
  const grossPriceLabel =
    item.grossUnitPrice === undefined ? '-' : formatCurrency(item.grossUnitPrice, item.currency, locale);
  const mobileMetadataSlots = presentationConfig?.mobileMetadataSlots ?? [];
  const inlineMetadataSlots = presentationConfig?.inlineMetadataSlots ?? [];
  const hasTrailingDesktopAmount = Boolean(
    presentationConfig?.showTrailingDesktopAmount && presentationConfig?.trailingDesktopAmount,
  );

  const productImage = (
    <div
      className="flex h-[78px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-tl-lg rounded-br-lg bg-surface-image-background"
      data-testid={`product-image-wrapper-${item.id}`}
    >
      {item.imageUrl ? (
        <Image
          width={120}
          height={78}
          src={String(item.imageUrl)}
          alt={String(item.name)}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="h-full w-full bg-surface-image-background" />
      )}
    </div>
  );

  const productName = item.href ? (
    <Link href={item.href} className="break-words text-2xl font-bold font-headlines text-text-headings hover:underline">
      {item.name}
    </Link>
  ) : (
    <p className="break-words text-2xl font-bold font-headlines text-text-headings">{item.name}</p>
  );

  return (
    <div className="py-6 first:pt-4" data-testid={`product-item-row-${item.id}`}>
      {/* Smallest-mobile: brand/name render above the thumbnail; the thumbnail sits beside a
          value stack (price, item number, quantity) and the Quantity label is omitted. */}
      <div className="flex flex-col gap-3 sm:hidden" data-testid={`product-item-mobile-${item.id}`}>
        <div className="flex min-w-0 flex-col gap-1">
          {item.brand && <p className="text-base font-body text-text-body">{item.brand}</p>}
          {productName}
        </div>
        <div className="flex items-start gap-4">
          {productImage}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-bold font-headlines text-text-headings">
                {formatCurrency(netPrice, item.currency, locale)}
              </span>
              {showGrossSecondary && (
                <span className="text-sm font-body text-text-placeholders">
                  {t('gross').trim()}: {grossPriceLabel}
                </span>
              )}
            </div>
            {item.itemNumber && (
              <p className="text-sm text-text-placeholders">
                {tOrders('itemNumber')}: {item.itemNumber}
              </p>
            )}
            <span className="text-base font-body">{item.quantity}</span>
            {mobileMetadataSlots.map((slot) => {
              const rendered = slot.render(item);
              return rendered == null ? null : <div key={slot.key}>{rendered}</div>;
            })}
          </div>
        </div>
      </div>

      {/* Desktop: three-column grid; Quantity stays left-aligned and price is net-first with
          gross as a secondary line. */}
      <div
        className={
          hasTrailingDesktopAmount
            ? 'hidden sm:grid sm:grid-cols-[minmax(280px,1.6fr)_100px_minmax(140px,1fr)_minmax(140px,1fr)] sm:items-center sm:gap-6'
            : 'hidden sm:grid sm:grid-cols-[minmax(280px,1.6fr)_100px_minmax(140px,1fr)] sm:items-center sm:gap-6'
        }
        data-testid={`product-item-desktop-${item.id}`}
      >
        <div className="flex min-w-0 items-start gap-4">
          {productImage}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {item.brand && <p className="text-base font-body text-text-body">{item.brand}</p>}
            {productName}
            {item.itemNumber && (
              <p className="text-sm text-text-placeholders">
                {tOrders('itemNumber')}: {item.itemNumber}
              </p>
            )}
          </div>
        </div>

        <div className="text-left" data-testid={`product-quantity-cell-${item.id}`}>
          <span className="text-base font-body">{item.quantity}</span>
        </div>

        <div className="text-right">
          <div className="flex flex-col sm:items-end">
            <span className="text-2xl font-bold font-headlines text-text-headings">
              {formatCurrency(netPrice, item.currency, locale)}
            </span>
            {showGrossSecondary && (
              <span className="text-sm font-body text-text-placeholders">
                {t('gross').trim()}: {grossPriceLabel}
              </span>
            )}
            {inlineMetadataSlots.map((slot) => {
              const rendered = slot.render(item);
              return rendered == null ? null : <div key={slot.key}>{rendered}</div>;
            })}
          </div>
        </div>
        {hasTrailingDesktopAmount && (
          <div className="text-right">{presentationConfig?.trailingDesktopAmount?.(item)}</div>
        )}
      </div>
    </div>
  );
}
