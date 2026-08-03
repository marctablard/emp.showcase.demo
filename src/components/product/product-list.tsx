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
    trailingDesktopAmount: presentationConfig?.trailingDesktopAmount,
    mobileMetadataSlots: presentationConfig?.mobileMetadataSlots ?? [],
    inlineMetadataSlots: presentationConfig?.inlineMetadataSlots ?? [],
  } satisfies ProductListPresentationConfig;

  const desktopGridClassName = resolvedPresentationConfig.showTrailingDesktopAmount
    ? 'hidden sm:grid sm:grid-cols-[minmax(280px,1.6fr)_100px_minmax(140px,1fr)_minmax(140px,1fr)] items-start gap-6'
    : 'hidden sm:grid sm:grid-cols-[minmax(280px,1.6fr)_100px_minmax(140px,1fr)] items-start gap-6';

  return (
    <Card className={`border border-border-primary shadow-sm ${className || ''}`}>
      <CardContent className="p-6">
        <div className={`${desktopGridClassName} border-b border-border-primary pb-4`}>
          <H6 className="text-sm font-bold text-text-headings">{resolvedPresentationConfig.labels.product}</H6>
          <H6 className="text-left text-sm font-bold text-text-headings">
            {resolvedPresentationConfig.labels.quantity}
          </H6>
          <H6 className="text-right text-sm font-bold text-text-headings">
            {resolvedPresentationConfig.labels.unitPrice}
          </H6>
          {resolvedPresentationConfig.showTrailingDesktopAmount && (
            <H6 className="text-right text-sm font-bold text-text-headings">
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
