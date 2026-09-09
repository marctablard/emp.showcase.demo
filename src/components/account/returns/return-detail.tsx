'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { CircleAlert, Minus, Plus, ReceiptText, Trash2 } from 'lucide-react';
import { detailTaxRateSuffix, shouldDisplayTaxLine } from '@/components/account/shared/detail-tax-line';
import { ProductList, type ProductListItem } from '@/components/product/product-list';
import { coalesceBrandLabel, resolveProductBrandLabel } from '@/components/product/resolve-product-brand';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { H1, H4, H5 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { SummaryField } from '@/components/ui/summary-card';
import { Textarea } from '@/components/ui/textarea';
import { useProducts } from '@/hooks/product/useProducts';
import { useReturn } from '@/hooks/return/useReturn';
import { useL10n } from '@/hooks/useL10n';
import { Link } from '@/i18n/navigation';
import type { Return } from '@/platform/services/model/return';
import { formatReturnCurrency } from './helpers';
import { RETURN_REASON_LABEL_KEYS, renderReturnReasonLabel } from './reason-labels';
import { ReturnStatusBadge } from './return-status-badge';
import { useReturnErrorMessage } from './use-return-error-message';

const MAX_DESCRIPTION_CHARACTERS = 500;

interface ExtendedReturnItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice?: { value: number; currency: string };
  grossUnitPrice?: { value: number; currency: string };
  total?: { value: number; currency: string };
  netPrice?: { value: number; currency: string };
  calculatedUnitPrice?: {
    netValue: number;
    grossValue: number;
    taxValue: number;
    taxCode?: string;
    taxRate?: number;
    valid?: boolean;
    currency?: string;
  };
  calculatedPrice?: {
    finalPrice: {
      netValue: number;
      grossValue: number;
      taxValue: number;
      taxCode?: string;
      taxRate?: number;
      valid?: boolean;
      currency?: string;
    };
  };
  reason?: { code?: string; details?: string };
  images?: string[];
  brand?: string;
  vendorName?: string;
  itemNumber?: string;
  productId?: string;
}

interface ExtendedReturn extends Omit<Return, 'orders'> {
  orders: {
    id: string;
    items: ExtendedReturnItem[];
  }[];
}

const claimReasonValues = Object.keys(RETURN_REASON_LABEL_KEYS) as (keyof typeof RETURN_REASON_LABEL_KEYS)[];

interface ReturnDetailProps {
  readonly returnId: string;
  readonly initialReturn?: Return | null;
}

interface ProductDetailCardProps {
  readonly item: ExtendedReturnItem;
  readonly locale: string;
  readonly t: ReturnType<typeof useTranslations<'account.returns'>>;
}

interface ReturnOverviewProps {
  readonly returnItem: ExtendedReturn;
  readonly locale: string;
  readonly t: ReturnType<typeof useTranslations<'account.returns'>>;
}

interface ReturnItemsListProps {
  readonly items: ExtendedReturnItem[];
  readonly locale: string;
  readonly t: ReturnType<typeof useTranslations<'account.returns'>>;
}

type ReturnProductListItem = ProductListItem & {
  readonly __returnItem?: ExtendedReturnItem;
};

interface ReturnReasonMetadataProps {
  readonly reasonCode?: string;
  readonly reasonDetails?: string;
  readonly t: ReturnType<typeof useTranslations<'account.returns'>>;
  readonly reasonBadgeClassName: string;
  readonly containerClassName: string;
}

interface ReturnTrailingDesktopAmountProps {
  readonly refundNetValue?: number;
  readonly refundNetCurrency?: string;
  readonly refundGrossValue?: number;
  readonly refundGrossCurrency?: string;
  readonly locale: string;
  readonly grossLabel: string;
}

function ReturnReasonMetadata({
  reasonCode,
  reasonDetails,
  t,
  reasonBadgeClassName,
  containerClassName,
}: ReturnReasonMetadataProps) {
  if (reasonCode != null || reasonDetails != null) {
    return (
      <div className={containerClassName}>
        {reasonCode && <Badge className={reasonBadgeClassName}>{renderReturnReasonLabel(t, reasonCode)}</Badge>}
        {reasonDetails && <p className="text-sm font-body text-text-body">{reasonDetails}</p>}
      </div>
    );
  }

  return null;
}

function ReturnTrailingDesktopAmount({
  refundNetValue,
  refundNetCurrency,
  refundGrossValue,
  refundGrossCurrency,
  locale,
  grossLabel,
}: ReturnTrailingDesktopAmountProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1 sm:items-end">
      <span className="break-words text-2xl font-bold font-headlines text-text-headings">
        {formatReturnCurrency(refundNetValue, refundNetCurrency, locale)}
      </span>
      {refundGrossValue !== undefined && (
        <span className="break-words text-sm font-body text-text-on-disabled">
          {grossLabel} {formatReturnCurrency(refundGrossValue, refundGrossCurrency, locale)}
        </span>
      )}
    </div>
  );
}

function isReturnProductListItem(productItem: ProductListItem): productItem is ReturnProductListItem {
  return '__returnItem' in productItem;
}

function getReturnItemRefund(item: ExtendedReturnItem): { value?: number; currency?: string } {
  if (item.calculatedPrice?.finalPrice?.grossValue !== undefined) {
    return {
      value: item.calculatedPrice.finalPrice.grossValue,
      currency: item.calculatedPrice.finalPrice.currency ?? item.total?.currency ?? item.unitPrice?.currency,
    };
  }
  if (item.grossUnitPrice?.value !== undefined && item.grossUnitPrice?.currency) {
    return { value: item.grossUnitPrice.value * item.quantity, currency: item.grossUnitPrice.currency };
  }
  if (item.unitPrice?.value !== undefined && item.unitPrice?.currency) {
    return { value: item.unitPrice.value * item.quantity, currency: item.unitPrice.currency };
  }
  if (item.total?.value !== undefined && item.total?.currency) {
    return { value: item.total.value, currency: item.total.currency };
  }
  return { value: undefined, currency: undefined };
}

function getReturnItemUnitPrice(item: ExtendedReturnItem): {
  grossValue?: number;
  netValue?: number;
  currency?: string;
} {
  return {
    grossValue: item.calculatedUnitPrice?.grossValue ?? item.grossUnitPrice?.value ?? item.unitPrice?.value,
    netValue: item.calculatedUnitPrice?.netValue ?? item.netPrice?.value ?? item.unitPrice?.value,
    currency:
      item.calculatedUnitPrice?.currency ??
      item.grossUnitPrice?.currency ??
      item.netPrice?.currency ??
      item.unitPrice?.currency,
  };
}

function getReturnItemRefundNet(item: ExtendedReturnItem): { value?: number; currency?: string } {
  if (item.calculatedPrice?.finalPrice?.netValue !== undefined) {
    return {
      value: item.calculatedPrice.finalPrice.netValue,
      currency: item.calculatedPrice.finalPrice.currency ?? item.total?.currency ?? item.unitPrice?.currency,
    };
  }

  return {
    value: (item.netPrice?.value ?? item.unitPrice?.value ?? 0) * item.quantity,
    currency: item.netPrice?.currency ?? item.unitPrice?.currency,
  };
}

function renderTrailingDesktopAmount(
  productItem: ProductListItem,
  { locale, grossLabel }: { locale: string; grossLabel: string },
): React.ReactNode {
  const returnItem = isReturnProductListItem(productItem) ? productItem.__returnItem : undefined;
  if (returnItem == null) {
    return null;
  }

  const refund = getReturnItemRefund(returnItem);
  const refundNet = getReturnItemRefundNet(returnItem);

  return (
    <ReturnTrailingDesktopAmount
      refundNetValue={refundNet.value}
      refundNetCurrency={refundNet.currency}
      refundGrossValue={refund.value}
      refundGrossCurrency={refund.currency}
      locale={locale}
      grossLabel={grossLabel}
    />
  );
}

function ReturnOverview({ returnItem, locale, t }: ReturnOverviewProps) {
  const tCommon = useTranslations('common');
  // Total return value: single gross amount (finalPrice.grossValue). No Gross prefix.
  // When gross is absent, show '-' (do not invent a total from net or helpers).
  const finalPrice = returnItem.calculatedPrice?.finalPrice;
  const totalGrossValue = finalPrice?.grossValue;
  const totalNetValue = finalPrice?.netValue ?? returnItem.total?.value;
  const totalCurrency = finalPrice?.currency ?? returnItem.total?.currency;
  const taxLine = {
    taxRate: finalPrice?.taxRate,
    taxAmount: finalPrice?.taxValue,
    netAmount: finalPrice?.netValue,
  };
  const showTaxLine = shouldDisplayTaxLine(taxLine);

  return (
    <div className="rounded-md bg-surface-action-hover-2 p-6 shadow-sm">
      <div className="flex flex-col gap-4 rounded-md bg-surface-primary p-4">
        <div className="flex items-center gap-2">
          <ReceiptText className="h-8 w-8 shrink-0 text-text-action" />
          <H4>{t('returnOverview')}</H4>
        </div>
        <div className="flex items-start justify-between gap-4 border-b border-border-primary pb-4">
          <H5>{t('netValueOfGoods')}</H5>
          <H5 className="text-right">{formatReturnCurrency(totalNetValue, totalCurrency, locale)}</H5>
        </div>
        {showTaxLine && (
          <div className="flex items-start justify-between gap-4 pt-2">
            <span className="text-base font-body text-text-body">
              {tCommon('tax')}
              {detailTaxRateSuffix(taxLine)}
            </span>
            <span className="text-base font-body text-text-body text-right">
              {formatReturnCurrency(finalPrice?.taxValue, totalCurrency, locale)}
            </span>
          </div>
        )}
        <div className="flex items-start justify-between gap-4 pt-2">
          <H5>{t('totalReturnValue')}</H5>
          <H5 className="text-right">
            {totalGrossValue === undefined ? '-' : formatReturnCurrency(totalGrossValue, totalCurrency, locale)}
          </H5>
        </div>
      </div>
    </div>
  );
}

function ReturnItemsList({ items, locale, t }: ReturnItemsListProps) {
  const reasonBadgeClassName =
    'inline-flex !rounded-sm !border-border-primary !bg-surface-disabled !p-1 !text-sm !font-bold normal-case !tracking-normal text-text-headings font-body';
  const grossLabel = t('gross');
  const { l10n } = useL10n();
  const productIds = items.map((item) => item.productId).filter((id): id is string => Boolean(id));
  const { products } = useProducts(productIds);
  const productById = Object.fromEntries((products || []).map((product) => [product.id, product]));

  const mappedItems: ReturnProductListItem[] = items.map((item) => {
    const unitPrice = getReturnItemUnitPrice(item);
    const primaryUnitPriceValue = unitPrice.netValue ?? unitPrice.grossValue;
    const catalogProduct = item.productId ? productById[item.productId] : undefined;

    return {
      id: item.id,
      name: item.name,
      brand: coalesceBrandLabel(item.brand ?? item.vendorName, resolveProductBrandLabel(catalogProduct, l10n)),
      itemNumber: item.itemNumber,
      quantity: item.quantity,
      unitPrice: primaryUnitPriceValue ?? 0,
      currency: unitPrice.currency ?? '',
      netUnitPrice: unitPrice.netValue,
      grossUnitPrice: unitPrice.grossValue,
      imageUrl: item.images?.[0] ?? catalogProduct?.images?.[0]?.url,
      href: item.productId ? `/product/${item.productId}` : undefined,
      __returnItem: item,
    };
  });

  return (
    <ProductList
      items={mappedItems}
      locale={locale}
      presentationConfig={{
        labels: {
          product: t('product'),
          quantity: t('quantity'),
          unitPrice: t('price'),
          amount: t('refundAmount'),
        },
        showGrossSecondary: true,
        showTrailingDesktopAmount: true,
        omitMobileUnitPrice: true,
        trailingDesktopAmount: (productItem) => renderTrailingDesktopAmount(productItem, { locale, grossLabel }),
        mobileMetadataSlots: [
          {
            key: 'reason-badge',
            render: (productItem) => {
              const returnItem = isReturnProductListItem(productItem) ? productItem.__returnItem : undefined;
              return (
                <ReturnReasonMetadata
                  reasonCode={returnItem?.reason?.code}
                  reasonDetails={returnItem?.reason?.details}
                  t={t}
                  reasonBadgeClassName={reasonBadgeClassName}
                  containerClassName="flex flex-col gap-2"
                />
              );
            },
          },
        ],
        // Figma Image-Details: reason badge + description sit under item number in the product column.
        productColumnMetadataSlots: [
          {
            key: 'reason-badge',
            render: (productItem) => {
              const returnItem = isReturnProductListItem(productItem) ? productItem.__returnItem : undefined;
              return (
                <ReturnReasonMetadata
                  reasonCode={returnItem?.reason?.code}
                  reasonDetails={returnItem?.reason?.details}
                  t={t}
                  reasonBadgeClassName={reasonBadgeClassName}
                  containerClassName="flex flex-col gap-2"
                />
              );
            },
          },
        ],
      }}
    />
  );
}

function ProductDetailCard({ item, locale: _locale, t }: ProductDetailCardProps) {
  const [quantity, setQuantity] = useState(item.quantity);
  const [itemName, setItemName] = useState(item.name);
  const [claimReason, setClaimReason] = useState(item.reason?.code || '');
  const [description, setDescription] = useState(item.reason?.details || '');

  const images = item.images || [];

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <h2 className="text-4xl font-bold mb-6">{t('productDetails')}</h2>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-[45%]">
            <Label className="text-base font-bold mb-3 block">{t('photos')}</Label>
            <div className="grid grid-cols-2 gap-3">
              {images.slice(0, 3).map((imageUrl, index) => (
                <div
                  key={`${item.id}-${imageUrl ?? index}`}
                  className="aspect-[3/2] relative bg-surface-muted overflow-hidden"
                >
                  <Image
                    src={imageUrl}
                    alt={`${item.name} - ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                </div>
              ))}

              <div className="aspect-[3/2] relative bg-surface-page rounded-lg border border-action flex flex-col items-center justify-center cursor-pointer hover:bg-surface-muted transition-colors">
                <Plus className="w-6 h-6 text-action mb-1" />
                <span className="text-sm text-action font-bold underline">{t('uploadPhotos')}</span>
              </div>
            </div>
          </div>

          <div className="lg:w-[55%] space-y-4">
            <div className="flex gap-4">
              <div className="w-40 flex items-end">
                <div className="flex items-center border rounded-md">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-12 w-12 rounded-r-none border-r"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    data-testid={`return-detail-decrease-${item.id}`}
                  >
                    {quantity === 1 ? <Trash2 className="h-4 w-4 text-action" /> : <Minus className="h-4 w-4" />}
                  </Button>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number.parseInt(e.target.value) || 1))}
                    className="h-12 w-15 text-center border-0 rounded-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    data-testid={`return-detail-quantity-${item.id}`}
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-12 w-12 rounded-l-none border-l"
                    onClick={() => setQuantity(quantity + 1)}
                    data-testid={`return-detail-increase-${item.id}`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1">
                <Label htmlFor={`itemName-${item.id}`} className="text-base font-bold text-text-headings mb-1 block">
                  {t('itemName')}
                </Label>
                <Input
                  id={`itemName-${item.id}`}
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="h-12"
                  placeholder={t('itemName')}
                  data-testid={`return-detail-itemName-${item.id}`}
                />
              </div>
            </div>

            <div>
              <Label htmlFor={`claimReason-${item.id}`} className="text-sm font-bold text-text-headings mb-1 block">
                {t('claimReason')}
              </Label>
              <Select value={claimReason} onValueChange={setClaimReason}>
                <SelectTrigger className="h-12" data-testid={`return-detail-reason-${item.id}`}>
                  <SelectValue placeholder={t('selectReason')} />
                </SelectTrigger>
                <SelectContent>
                  {claimReasonValues.map((value) => (
                    <SelectItem key={value} value={value} data-testid={`return-detail-reason-${item.id}-${value}`}>
                      {t(RETURN_REASON_LABEL_KEYS[value])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor={`description-${item.id}`} className="text-sm font-bold text-text-headings mb-1 block">
                {t('descriptionLabel')}
              </Label>
              <Textarea
                id={`description-${item.id}`}
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION_CHARACTERS))}
                className="min-h-[120px] resize-none"
                placeholder={t('descriptionPlaceholder')}
                maxLength={MAX_DESCRIPTION_CHARACTERS}
                data-testid={`return-detail-description-${item.id}`}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" className="uppercase" data-testid="return-detail-cancelButton">
            {t('cancel')}
          </Button>
          <Button className="uppercase" data-testid="return-detail-saveButton">
            {t('save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReturnDetail({ returnId, initialReturn }: ReturnDetailProps) {
  const t = useTranslations('account.returns');
  const returnErrorMessage = useReturnErrorMessage();
  const locale = useLocale();
  const { returnItem: apiReturnItem, loading, error, refreshReturn } = useReturn(returnId, initialReturn);

  const returnItem: ExtendedReturn | null = (apiReturnItem as ExtendedReturn) || null;

  // H1 identity: returnDetails / returnLabel + id (not list title "Returns & Claims").
  // Match Order Details pattern (short label + id) using returnLabel; keep status badge.
  const returnHeading = (id: string) => (
    <H1 variant="h3">
      {t('returnLabel')}: {id}
    </H1>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">{returnHeading(returnId)}</div>
        <Card>
          <CardContent className="flex justify-center py-12">
            <div className="flex flex-col items-center space-y-2">
              <Spinner color="primary" variant="md" />
              <div className="text-text-placeholders">{t('loading')}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !returnItem) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">{returnHeading(returnId)}</div>
        <Alert variant="destructive">
          <CircleAlert className="h-4 w-4" />
          <AlertTitle>{t('error')}</AlertTitle>
          <AlertDescription>{error ? returnErrorMessage(error) : t('returnNotFound')}</AlertDescription>
        </Alert>
        <div className="flex gap-4">
          <Button onClick={() => refreshReturn()} data-testid="return-detail-retryButton">
            {t('tryAgain')}
          </Button>
          <Link href="/account/returns" passHref>
            <Button variant="secondary" data-testid="return-detail-backButton">
              {t('backToList')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const allItems: ExtendedReturnItem[] = returnItem.orders.flatMap((order) => order.items);
  const editMode = false;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        {returnHeading(returnItem.id)}
        <ReturnStatusBadge status={returnItem.status} isExpired={returnItem.isExpired} />
      </div>

      <div className="rounded-md bg-surface-primary shadow-sm p-6">
        <div className="flex flex-col items-start gap-6">
          <H4>{t('returnDetails')}</H4>
          <div className="grid w-full grid-cols-1 gap-2 pb-1 sm:grid-cols-[200px_minmax(0,1fr)]">
            <div className="flex flex-col gap-2">
              <H5>{t('reasonLabel')}</H5>
              {returnItem.reason?.code ? (
                <Badge className="inline-flex w-fit !rounded-sm !border-border-primary !bg-surface-disabled !p-1 !text-sm !font-bold normal-case !tracking-normal text-text-headings font-body">
                  {renderReturnReasonLabel(t, returnItem.reason.code)}
                </Badge>
              ) : (
                <span className="text-sm font-body text-text-body">-</span>
              )}
            </div>
            <SummaryField label={t('reasonDetails')} valueClassName="text-sm">
              {returnItem.reason?.details || '-'}
            </SummaryField>
          </div>
        </div>
      </div>

      <ReturnOverview returnItem={returnItem} locale={locale} t={t} />
      <ReturnItemsList items={allItems} locale={locale} t={t} />

      {editMode && allItems.map((item) => <ProductDetailCard key={item.id} item={item} locale={locale} t={t} />)}
    </div>
  );
}
