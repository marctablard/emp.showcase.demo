import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { H5, H6 } from '@/components/ui/h';
import { cn } from '@/lib/utils';
import { ProductItemRow } from './product-item-row';

/** Column headers: Mobile/heading/h5 below desktop, Desktop/heading/h6 from `md` up (both 16px). */
function ProductListColumnHeading({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <div className={cn('min-w-0', className)}>
      <H5 className="md:hidden">{children}</H5>
      <H6 className="hidden md:block">{children}</H6>
    </div>
  );
}

export interface ProductListMetadataSlot {
  readonly key: string;
  readonly render: (item: ProductListItem) => ReactNode;
}

export interface ProductListPresentationConfig {
  readonly labels?: {
    readonly product?: string;
    readonly quantity?: string;
    readonly unitPrice?: string;
    readonly amount?: string;
    readonly baseNetUnitPrice?: string;
    readonly discount?: string;
  };
  readonly showGrossSecondary?: boolean;
  readonly showTrailingDesktopAmount?: boolean;
  /** When true, mobile omits the core unit-price block (Return); Quote/Approval leave this unset. */
  readonly omitMobileUnitPrice?: boolean;
  /**
   * When true, insert Base Net Unit Price + Discount columns between Quantity and Unit Price
   * (Quote/Approval when any line has discount > 0).
   */
  readonly showDiscountColumns?: boolean;
  readonly trailingDesktopAmount?: (item: ProductListItem) => ReactNode;
  /** Rendered in the product column under item number (e.g. Return reason + details). */
  readonly productColumnMetadataSlots?: ProductListMetadataSlot[];
  readonly mobileMetadataSlots?: ProductListMetadataSlot[];
  /** Rendered under the unit-price stack on desktop (legacy; prefer productColumnMetadataSlots for product details). */
  readonly inlineMetadataSlots?: ProductListMetadataSlot[];
}

export interface ProductListItem {
  id: string;
  name: string;
  brand?: string;
  itemNumber?: string; // product code / SKU
  quantity: number;
  unitPrice: number;
  currency: string;
  grossUnitPrice?: number;
  netUnitPrice?: number;
  /** Pre-discount net unit price (`unitPrice` from quote/approval API). */
  baseNetUnitPrice?: number;
  /** Discount percentage (e.g. 35 for 35%). */
  discountPercent?: number;
  imageUrl?: string | null;
  href?: string; // optional product link
}

/**
 * Desktop track templates shared by ProductList header and ProductItemRow.
 * Table layout starts at `md` (768px); below that the stacked mobile cards are used
 * (no horizontal scroll). Four-column (trailing amount / Return) uses shrinkable mins
 * so Refund Amount stays inside the card at ~1024–1150px account layouts with a sidebar.
 */
export const PRODUCT_DESKTOP_GRID_COLS = 'md:grid-cols-[minmax(280px,1.6fr)_100px_minmax(140px,1fr)]';
export const PRODUCT_DESKTOP_GRID_COLS_WITH_AMOUNT =
  'md:grid-cols-[minmax(0,1.6fr)_minmax(4rem,100px)_minmax(0,1fr)_minmax(0,1fr)]';
/** Product | Quantity | Base Net Unit Price | Discount | Unit Price */
export const PRODUCT_DESKTOP_GRID_COLS_WITH_DISCOUNT =
  'md:grid-cols-[minmax(200px,1.4fr)_minmax(4rem,80px)_minmax(0,1fr)_minmax(4rem,72px)_minmax(0,1fr)]';

interface ProductListProps {
  readonly items: ProductListItem[];
  readonly className?: string;
  readonly locale?: string;
  readonly presentationConfig?: ProductListPresentationConfig;
  readonly showGrossUnderNet?: boolean;
}

export function resolveProductDesktopGridCols(
  presentationConfig?: ProductListPresentationConfig,
):
  | typeof PRODUCT_DESKTOP_GRID_COLS
  | typeof PRODUCT_DESKTOP_GRID_COLS_WITH_AMOUNT
  | typeof PRODUCT_DESKTOP_GRID_COLS_WITH_DISCOUNT {
  if (presentationConfig?.showTrailingDesktopAmount && presentationConfig?.trailingDesktopAmount) {
    return PRODUCT_DESKTOP_GRID_COLS_WITH_AMOUNT;
  }
  if (presentationConfig?.showDiscountColumns) {
    return PRODUCT_DESKTOP_GRID_COLS_WITH_DISCOUNT;
  }
  return PRODUCT_DESKTOP_GRID_COLS;
}

export function ProductList({
  items,
  className,
  locale,
  presentationConfig,
  showGrossUnderNet = false,
}: ProductListProps) {
  const tCart = useTranslations('cart');
  const tQuoteDetails = useTranslations('account.quoteDetails');
  const resolvedPresentationConfig = {
    labels: {
      product: presentationConfig?.labels?.product ?? tCart('product'),
      quantity: presentationConfig?.labels?.quantity ?? tQuoteDetails('quantity'),
      unitPrice: presentationConfig?.labels?.unitPrice ?? tQuoteDetails('unitPrice'),
      amount: presentationConfig?.labels?.amount,
      baseNetUnitPrice: presentationConfig?.labels?.baseNetUnitPrice ?? tQuoteDetails('baseNetUnitPrice'),
      discount: presentationConfig?.labels?.discount ?? tQuoteDetails('discount'),
    },
    showGrossSecondary: presentationConfig?.showGrossSecondary ?? showGrossUnderNet,
    showTrailingDesktopAmount: presentationConfig?.showTrailingDesktopAmount ?? false,
    showDiscountColumns: presentationConfig?.showDiscountColumns ?? false,
    omitMobileUnitPrice: presentationConfig?.omitMobileUnitPrice ?? false,
    trailingDesktopAmount: presentationConfig?.trailingDesktopAmount,
    productColumnMetadataSlots: presentationConfig?.productColumnMetadataSlots ?? [],
    mobileMetadataSlots: presentationConfig?.mobileMetadataSlots ?? [],
    inlineMetadataSlots: presentationConfig?.inlineMetadataSlots ?? [],
  } satisfies ProductListPresentationConfig;

  const hasTrailingDesktopAmount = Boolean(
    resolvedPresentationConfig.showTrailingDesktopAmount && resolvedPresentationConfig.trailingDesktopAmount,
  );
  const showDiscountColumns = Boolean(resolvedPresentationConfig.showDiscountColumns);
  const desktopGridCols = resolveProductDesktopGridCols(resolvedPresentationConfig);
  const desktopGridClassName = hasTrailingDesktopAmount
    ? `hidden min-w-0 md:grid ${desktopGridCols} items-start gap-4 lg:gap-6`
    : `hidden md:grid ${desktopGridCols} items-start gap-6`;

  return (
    <Card
      className={`min-w-0 max-w-full gap-0 overflow-hidden border border-border-primary py-0 shadow-sm ${className || ''}`}
      data-testid="product-list-card"
    >
      {/* Mobile Figma Products frame: single spacing/4 inset. Card default py-6 must stay off
          so it does not stack with CardContent padding (Jira #14a / #19 gap).
          Stacked cards below md; no horizontal scroll when the table would not fit. */}
      <CardContent className="min-w-0 p-4 md:p-6" data-testid="product-list-content">
        <div className={`${desktopGridClassName} border-b border-border-primary pb-4`}>
          <ProductListColumnHeading className="min-w-0">
            {resolvedPresentationConfig.labels.product}
          </ProductListColumnHeading>
          <ProductListColumnHeading className="text-left">
            {resolvedPresentationConfig.labels.quantity}
          </ProductListColumnHeading>
          {showDiscountColumns ? (
            <>
              <ProductListColumnHeading className="min-w-0 text-right">
                {resolvedPresentationConfig.labels.baseNetUnitPrice}
              </ProductListColumnHeading>
              <ProductListColumnHeading className="min-w-0 text-right">
                {resolvedPresentationConfig.labels.discount}
              </ProductListColumnHeading>
            </>
          ) : null}
          <ProductListColumnHeading className="min-w-0 text-right">
            {resolvedPresentationConfig.labels.unitPrice}
          </ProductListColumnHeading>
          {hasTrailingDesktopAmount && (
            <ProductListColumnHeading className="min-w-0 text-right">
              {resolvedPresentationConfig.labels.amount}
            </ProductListColumnHeading>
          )}
        </div>
        <div className="divide-y divide-border-primary">
          {items.map((item) => (
            <ProductItemRow
              key={item.id}
              item={item}
              locale={locale}
              presentationConfig={resolvedPresentationConfig}
              showGrossUnderNet={showGrossUnderNet}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
