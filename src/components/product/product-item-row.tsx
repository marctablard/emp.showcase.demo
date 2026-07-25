import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { formatCurrency } from '@/lib/utils';
import type { ProductListItem } from './product-list';

interface ProductItemRowProps {
  readonly item: ProductListItem;
  readonly showNetUnderGross?: boolean;
}

export function ProductItemRow({ item, showNetUnderGross = false }: ProductItemRowProps) {
  const t = useTranslations('cart');
  const tOrders = useTranslations('orders');
  const netPrice = item.netUnitPrice ?? item.unitPrice;
  // Missing gross is rendered as a literal '-' secondary value; it is never derived from net/unit price.
  const grossPriceLabel = item.grossUnitPrice === undefined ? '-' : formatCurrency(item.grossUnitPrice, item.currency);

  const productImage = (
    <div className="flex h-[78px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-tl-lg rounded-br-lg bg-surface-image-background">
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
    <div className="py-6 first:pt-4">
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
                {formatCurrency(netPrice, item.currency)}
              </span>
              {showNetUnderGross && (
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
          </div>
        </div>
      </div>

      {/* Desktop: three-column grid; Quantity stays left-aligned and price is net-first with
          gross as a secondary line. */}
      <div
        className="hidden sm:grid sm:grid-cols-[minmax(280px,1.6fr)_100px_minmax(140px,1fr)] sm:items-center sm:gap-6"
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

        <div className="text-left">
          <span className="text-base font-body">{item.quantity}</span>
        </div>

        <div className="text-right">
          <div className="flex flex-col sm:items-end">
            <span className="text-2xl font-bold font-headlines text-text-headings">
              {formatCurrency(netPrice, item.currency)}
            </span>
            {showNetUnderGross && (
              <span className="text-sm font-body text-text-placeholders">
                {t('gross').trim()}: {grossPriceLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
