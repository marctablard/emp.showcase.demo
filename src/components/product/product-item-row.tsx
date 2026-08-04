import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { formatCurrency } from '@/lib/utils';
import {
  PRODUCT_DESKTOP_GRID_COLS,
  PRODUCT_DESKTOP_GRID_COLS_WITH_AMOUNT,
  type ProductListItem,
  type ProductListPresentationConfig,
} from './product-list';

interface ProductItemRowProps {
  readonly item: ProductListItem;
  readonly locale?: string;
  readonly presentationConfig?: ProductListPresentationConfig;
  readonly showGrossUnderNet?: boolean;
}

function renderOmittedMobileUnitPrice(
  item: ProductListItem,
  hasTrailingDesktopAmount: boolean,
  presentationConfig?: ProductListPresentationConfig,
) {
  if (!hasTrailingDesktopAmount) {
    return null;
  }
  return presentationConfig?.trailingDesktopAmount?.(item) ?? null;
}

function renderMobileUnitPriceStack(
  netPrice: number,
  currency: string,
  locale: string | undefined,
  showGrossSecondary: boolean,
  grossPriceLabel: string,
  t: (key: string) => string,
) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-2xl font-bold font-headlines text-text-headings">
        {formatCurrency(netPrice, currency, locale)}
      </span>
      {showGrossSecondary ? (
        <span className="text-sm font-body text-text-placeholders">
          {t('gross').trim()}: {grossPriceLabel}
        </span>
      ) : null}
    </div>
  );
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
  const omitMobileUnitPrice = presentationConfig?.omitMobileUnitPrice ?? false;
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

  // Mobile uses H5 token (text-3xl); desktop keeps H6 (text-2xl). Split like brand so sizes
  // do not depend on the 1024px token media query vs Tailwind `sm`.
  const mobileProductName = item.href ? (
    <Link
      href={item.href}
      className="break-words text-3xl font-bold font-headlines text-text-headings hover:underline"
      data-testid={`product-name-mobile-${item.id}`}
    >
      {item.name}
    </Link>
  ) : (
    <p
      className="break-words text-3xl font-bold font-headlines text-text-headings"
      data-testid={`product-name-mobile-${item.id}`}
    >
      {item.name}
    </p>
  );

  const desktopProductName = item.href ? (
    <Link
      href={item.href}
      className="break-words text-2xl font-bold font-headlines text-text-headings hover:underline"
      data-testid={`product-name-desktop-${item.id}`}
    >
      {item.name}
    </Link>
  ) : (
    <p
      className="break-words text-2xl font-bold font-headlines text-text-headings"
      data-testid={`product-name-desktop-${item.id}`}
    >
      {item.name}
    </p>
  );

  return (
    // Figma mobile products: no extra top pad on first row (card p-4 is enough); subsequent
    // rows keep py-4. Desktop keeps py-6 with first:pt-4 under the column header.
    <div className="py-4 first:pt-0 sm:py-6 sm:first:pt-4" data-testid={`product-item-row-${item.id}`}>
      {/* Smallest-mobile: brand/name render above the thumbnail; the thumbnail sits beside a
          value stack (price, item number, quantity) and the Quantity label is omitted. */}
      <div className="flex flex-col gap-3 sm:hidden" data-testid={`product-item-mobile-${item.id}`}>
        <div className="flex min-w-0 flex-col gap-1">
          {item.brand && <p className="text-sm font-body text-text-body">{item.brand}</p>}
          {mobileProductName}
        </div>
        <div className="flex items-start gap-4">
          {productImage}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {omitMobileUnitPrice
              ? renderOmittedMobileUnitPrice(item, hasTrailingDesktopAmount, presentationConfig)
              : renderMobileUnitPriceStack(netPrice, item.currency, locale, showGrossSecondary, grossPriceLabel, t)}
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
          gross as a secondary line. Four-column (Return refund) uses shrinkable tracks. */}
      <div
        className={
          hasTrailingDesktopAmount
            ? `hidden min-w-0 sm:grid ${PRODUCT_DESKTOP_GRID_COLS_WITH_AMOUNT} sm:items-center gap-4 lg:gap-6`
            : `hidden sm:grid ${PRODUCT_DESKTOP_GRID_COLS} sm:items-center sm:gap-6`
        }
        data-testid={`product-item-desktop-${item.id}`}
      >
        <div className="flex min-w-0 items-start gap-4">
          {productImage}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {item.brand && <p className="text-base font-body text-text-body">{item.brand}</p>}
            {desktopProductName}
            {item.itemNumber && (
              <p className="text-sm text-text-placeholders">
                {tOrders('itemNumber')}: {item.itemNumber}
              </p>
            )}
          </div>
        </div>

        <div className="min-w-0 text-left" data-testid={`product-quantity-cell-${item.id}`}>
          <span className="text-base font-body">{item.quantity}</span>
        </div>

        <div className="min-w-0 text-right">
          <div className="flex min-w-0 flex-col sm:items-end">
            <span className="break-words text-2xl font-bold font-headlines text-text-headings">
              {formatCurrency(netPrice, item.currency, locale)}
            </span>
            {showGrossSecondary && (
              <span className="break-words text-sm font-body text-text-placeholders">
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
          <div className="min-w-0 text-right" data-testid={`product-trailing-amount-cell-${item.id}`}>
            {presentationConfig?.trailingDesktopAmount?.(item)}
          </div>
        )}
      </div>
    </div>
  );
}
