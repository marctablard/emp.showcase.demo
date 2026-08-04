import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { H6 } from '@/components/ui/h';
import { ProductItemRow } from './product-item-row';

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
  };
  readonly showGrossSecondary?: boolean;
  readonly showTrailingDesktopAmount?: boolean;
  /** When true, mobile omits the core unit-price block (Return); Quote/Approval leave this unset. */
  readonly omitMobileUnitPrice?: boolean;
  readonly trailingDesktopAmount?: (item: ProductListItem) => ReactNode;
  readonly mobileMetadataSlots?: ProductListMetadataSlot[];
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
  imageUrl?: string | null;
  href?: string; // optional product link
}

/**
 * Desktop track templates shared by ProductList header and ProductItemRow.
 * Four-column (trailing amount / Return) uses shrinkable mins so Refund Amount
 * stays inside the card at ~1024–1150px account layouts with a sidebar.
 */
export const PRODUCT_DESKTOP_GRID_COLS = 'sm:grid-cols-[minmax(280px,1.6fr)_100px_minmax(140px,1fr)]';
export const PRODUCT_DESKTOP_GRID_COLS_WITH_AMOUNT =
  'sm:grid-cols-[minmax(0,1.6fr)_minmax(4rem,100px)_minmax(0,1fr)_minmax(0,1fr)]';

interface ProductListProps {
  readonly items: ProductListItem[];
  readonly className?: string;
  readonly locale?: string;
  readonly presentationConfig?: ProductListPresentationConfig;
  readonly showGrossUnderNet?: boolean;
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
    },
    showGrossSecondary: presentationConfig?.showGrossSecondary ?? showGrossUnderNet,
    showTrailingDesktopAmount: presentationConfig?.showTrailingDesktopAmount ?? false,
    omitMobileUnitPrice: presentationConfig?.omitMobileUnitPrice ?? false,
    trailingDesktopAmount: presentationConfig?.trailingDesktopAmount,
    mobileMetadataSlots: presentationConfig?.mobileMetadataSlots ?? [],
    inlineMetadataSlots: presentationConfig?.inlineMetadataSlots ?? [],
  } satisfies ProductListPresentationConfig;

  const hasTrailingDesktopAmount = Boolean(
    resolvedPresentationConfig.showTrailingDesktopAmount && resolvedPresentationConfig.trailingDesktopAmount,
  );

  const desktopGridClassName = hasTrailingDesktopAmount
    ? `hidden min-w-0 sm:grid ${PRODUCT_DESKTOP_GRID_COLS_WITH_AMOUNT} items-start gap-4 lg:gap-6`
    : `hidden sm:grid ${PRODUCT_DESKTOP_GRID_COLS} items-start gap-6`;

  return (
    <Card
      className={`min-w-0 max-w-full gap-0 overflow-hidden border border-border-primary py-0 shadow-sm ${className || ''}`}
      data-testid="product-list-card"
    >
      {/* Mobile Figma Products frame: single spacing/4 inset. Card default py-6 must stay off
          so it does not stack with CardContent padding (Jira #14a / #19 gap). */}
      <CardContent className="min-w-0 overflow-x-auto p-4 sm:p-6" data-testid="product-list-scroll">
        <div className={`${desktopGridClassName} border-b border-border-primary pb-4`}>
          <H6 className="min-w-0 text-sm font-bold text-text-headings">{resolvedPresentationConfig.labels.product}</H6>
          <H6 className="text-left text-sm font-bold text-text-headings">
            {resolvedPresentationConfig.labels.quantity}
          </H6>
          <H6 className="min-w-0 text-right text-sm font-bold text-text-headings">
            {resolvedPresentationConfig.labels.unitPrice}
          </H6>
          {hasTrailingDesktopAmount && (
            <H6 className="min-w-0 text-right text-sm font-bold text-text-headings">
              {resolvedPresentationConfig.labels.amount}
            </H6>
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
