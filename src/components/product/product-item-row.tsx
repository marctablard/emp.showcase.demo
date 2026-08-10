import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { H5, H6 } from '@/components/ui/h';
import { Link } from '@/i18n/navigation';
import { formatCurrency } from '@/lib/utils';
import {
  type ProductListItem,
  type ProductListPresentationConfig,
  resolveProductDesktopGridCols,
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
  grossPrefix: string,
) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-2xl font-bold font-headlines text-text-headings">
        {formatCurrency(netPrice, currency, locale)}
      </span>
      {showGrossSecondary ? (
        <span className="text-sm font-body text-text-on-disabled">
          {grossPrefix.trim()} {grossPriceLabel}
        </span>
      ) : null}
    </div>
  );
}

function ProductNameHeading({
  item,
  variant,
}: {
  readonly item: ProductListItem;
  readonly variant: 'mobile' | 'desktop';
}) {
  // Mobile / smaller: H5 (text-3xl). Largest desktop: H6 (text-2xl) — Figma heading tokens.
  const Heading = variant === 'mobile' ? H5 : H6;
  const testId = `product-name-${variant}-${item.id}`;
  const nameContent = item.href ? (
    <Link href={item.href} className="hover:underline">
      {item.name}
    </Link>
  ) : (
    item.name
  );

  return (
    <Heading className="min-w-0 break-words font-bold" data-testid={testId}>
      {nameContent}
    </Heading>
  );
}

function formatDiscountPercent(discountPercent: number | undefined): string {
  if (typeof discountPercent !== 'number' || discountPercent <= 0) {
    return '—';
  }
  return `${discountPercent}%`;
}

function resolveDesktopItemsAlignClass(hasProductColumnMetadata: boolean): string {
  return hasProductColumnMetadata ? 'sm:items-start' : 'sm:items-center';
}

function resolveDesktopGridLayoutClass(desktopGridCols: string, hasProductColumnMetadata: boolean): string {
  const alignClass = resolveDesktopItemsAlignClass(hasProductColumnMetadata);
  return `hidden min-w-0 sm:grid ${desktopGridCols} ${alignClass} gap-4 lg:gap-6`;
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
  const productColumnMetadataSlots = presentationConfig?.productColumnMetadataSlots ?? [];
  const inlineMetadataSlots = presentationConfig?.inlineMetadataSlots ?? [];
  const omitMobileUnitPrice = presentationConfig?.omitMobileUnitPrice ?? false;
  const showDiscountColumns = Boolean(presentationConfig?.showDiscountColumns);
  const hasTrailingDesktopAmount = Boolean(
    presentationConfig?.showTrailingDesktopAmount && presentationConfig?.trailingDesktopAmount,
  );
  const desktopGridCols = resolveProductDesktopGridCols(presentationConfig);
  const baseNetLabel =
    typeof item.baseNetUnitPrice === 'number' ? formatCurrency(item.baseNetUnitPrice, item.currency, locale) : '—';
  const discountLabel = formatDiscountPercent(item.discountPercent);
  const hasProductColumnMetadata = productColumnMetadataSlots.length > 0;

  // Mobile keeps 120×78; from sm (table) match Figma 80×52 so narrow sidebar columns fit.
  const productImage = (
    <div
      className="flex h-[78px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-tl-lg rounded-br-lg bg-surface-image-background sm:h-[52px] sm:w-[80px]"
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

  return (
    // Figma mobile products: no extra top pad on first row (card p-4 is enough); subsequent
    // rows keep py-4. Table (sm+) keeps py-6 with first:pt-4 under the column header.
    <div className="py-4 first:pt-0 sm:py-6 sm:first:pt-4" data-testid={`product-item-row-${item.id}`}>
      {/* Stacked cards below sm (768px): brand/name above the thumbnail; thumbnail beside the
          value stack (price, item number, quantity); Quantity label omitted. */}
      <div className="flex flex-col gap-3 sm:hidden" data-testid={`product-item-mobile-${item.id}`}>
        <div className="flex min-w-0 flex-col gap-1">
          {item.brand && <p className="text-sm font-body text-text-body">{item.brand}</p>}
          <ProductNameHeading item={item} variant="mobile" />
        </div>
        <div className="flex items-start gap-4">
          {productImage}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {omitMobileUnitPrice
              ? renderOmittedMobileUnitPrice(item, hasTrailingDesktopAmount, presentationConfig)
              : renderMobileUnitPriceStack(
                  netPrice,
                  item.currency,
                  locale,
                  showGrossSecondary,
                  grossPriceLabel,
                  t('gross').trim(),
                )}
            {item.itemNumber && (
              <p className="break-all text-sm font-body text-text-body">
                {tOrders('itemNumber')}: {item.itemNumber}
              </p>
            )}
            {mobileMetadataSlots.map((slot) => {
              const rendered = slot.render(item);
              return rendered == null ? null : <div key={slot.key}>{rendered}</div>;
            })}
            <span className="text-base font-body">{item.quantity}</span>
            {showDiscountColumns ? (
              <>
                <p className="text-sm font-body text-text-body" data-testid={`product-base-net-mobile-${item.id}`}>
                  {presentationConfig?.labels?.baseNetUnitPrice}: {baseNetLabel}
                </p>
                <p className="text-sm font-body text-text-body" data-testid={`product-discount-mobile-${item.id}`}>
                  {presentationConfig?.labels?.discount}: {discountLabel}
                </p>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Table from sm (768px): product column holds brand/name/item number (+ optional return
          reason under SKU). Compact Quantity; prices net-first with gross secondary. */}
      <div
        className={resolveDesktopGridLayoutClass(desktopGridCols, hasProductColumnMetadata)}
        data-testid={`product-item-desktop-${item.id}`}
      >
        <div className="flex min-w-0 items-start gap-4">
          {productImage}
          {/* Figma 11936:190938 Details: gap-2; brand/name body/sm + heading/h6; item # body/sm. */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              {item.brand && <p className="truncate text-sm font-body text-text-body">{item.brand}</p>}
              <ProductNameHeading item={item} variant="desktop" />
            </div>
            {item.itemNumber && (
              <p className="break-all text-sm font-body text-text-body">
                {tOrders('itemNumber')}: {item.itemNumber}
              </p>
            )}
            {productColumnMetadataSlots.map((slot) => {
              const rendered = slot.render(item);
              return rendered == null ? null : (
                <div key={slot.key} className="min-w-0" data-testid={`product-column-meta-${slot.key}-${item.id}`}>
                  {rendered}
                </div>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 text-left" data-testid={`product-quantity-cell-${item.id}`}>
          <span className="text-base font-body tabular-nums">{item.quantity}</span>
        </div>

        {showDiscountColumns ? (
          <>
            <div className="min-w-0 text-right" data-testid={`product-base-net-cell-${item.id}`}>
              <span className="break-words text-base font-body text-text-body">{baseNetLabel}</span>
            </div>
            <div className="min-w-0 text-right" data-testid={`product-discount-cell-${item.id}`}>
              <span className="break-words text-base font-body text-text-body">{discountLabel}</span>
            </div>
          </>
        ) : null}

        <div className="min-w-0 text-right">
          <div className="flex min-w-0 flex-col sm:items-end">
            <span className="break-words text-2xl font-bold font-headlines text-text-headings">
              {formatCurrency(netPrice, item.currency, locale)}
            </span>
            {showGrossSecondary && (
              <span className="break-words text-sm font-body text-text-on-disabled">
                {/* Secondary price: "Gross $…" / "Brutto …" — space, no colon (Figma). */}
                {t('gross').trim()} {grossPriceLabel}
              </span>
            )}
            {inlineMetadataSlots.map((slot) => {
              const rendered = slot.render(item);
              return rendered == null ? null : <div key={slot.key}>{rendered}</div>;
            })}
          </div>
        </div>

        {hasTrailingDesktopAmount ? (
          <div className="min-w-0 text-right" data-testid={`product-trailing-amount-cell-${item.id}`}>
            {presentationConfig?.trailingDesktopAmount?.(item)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
