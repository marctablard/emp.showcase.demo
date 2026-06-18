'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { AlertCircle, Minus, Plus, ReceiptText, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { H1, H4, H5 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useReturn } from '@/hooks/return/useReturn';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Link } from '@/i18n/navigation';
import type { Return } from '@/platform/services/model/return';
import { formatReturnCurrency } from './helpers';
import { RETURN_REASON_LABEL_KEYS, getReturnReasonLabel, getReturnReasonTranslationKey } from './reason-labels';
import { ReturnStatusBadge } from './return-status-badge';

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
  returnId: string;
  initialReturn?: Return | null;
}

interface ProductDetailCardProps {
  item: ExtendedReturnItem;
  locale: string;
  t: ReturnType<typeof useTranslations<'account.returns'>>;
}

interface ReturnOverviewProps {
  returnItem: ExtendedReturn;
  locale: string;
  t: ReturnType<typeof useTranslations<'account.returns'>>;
}

interface ReturnItemsListProps {
  items: ExtendedReturnItem[];
  locale: string;
  t: ReturnType<typeof useTranslations<'account.returns'>>;
  generalReasonCode?: string;
}

function renderReturnReasonLabel(t: ReturnType<typeof useTranslations<'account.returns'>>, code: string): string {
  const translationKey = getReturnReasonTranslationKey(code);
  if (translationKey) {
    return t(translationKey);
  }

  return getReturnReasonLabel(code);
}

function ReturnOverview({ returnItem, locale, t }: ReturnOverviewProps) {
  const totalGrossValue = returnItem.calculatedPrice?.finalPrice?.grossValue;
  const totalNetValue = returnItem.calculatedPrice?.finalPrice?.netValue ?? returnItem.total?.value;
  const totalCurrency = returnItem.calculatedPrice?.finalPrice?.currency ?? returnItem.total?.currency;

  return (
    <div className="bg-surface-action-hover-2 p-6 rounded-lg shadow-sm">
      <div className="bg-surface-page p-4 rounded-lg space-y-4">
        <div className="flex items-center gap-2">
          <ReceiptText className="h-6 w-6 shrink-0 text-text-action" />
          <H4 variant="h5" className="text-[20px] leading-[24px] lg:text-[28px] lg:leading-[36px] font-bold">
            {t('returnOverview')}
          </H4>
        </div>
        <div className="flex items-start gap-4">
          <H5 className="flex-1 text-text-body">{t('totalReturnValue')}</H5>
          <H5 className="flex-1 text-right text-text-body">
            {totalGrossValue !== undefined ? formatReturnCurrency(totalGrossValue, totalCurrency, locale) : '-'}
          </H5>
        </div>
        <div className="flex items-start gap-4">
          <span className="flex-1 text-[12px] leading-[20px] lg:text-[14px] lg:leading-[20px] font-medium text-text-on-disabled font-secondary">
            {t('net')}
          </span>
          <span className="flex-1 text-right text-[12px] leading-[20px] lg:text-[14px] lg:leading-[20px] text-text-on-disabled font-secondary">
            {formatReturnCurrency(totalNetValue, totalCurrency, locale)}
          </span>
        </div>
      </div>
    </div>
  );
}

function ReturnItemsList({ items, locale, t, generalReasonCode }: ReturnItemsListProps) {
  const isTabletUp = useBreakpoint('sm');
  const reasonBadgeClassName =
    'inline-flex h-7 !p-1 !text-[12px] !leading-[20px] font-bold normal-case !tracking-normal rounded-[4px] text-text-headings border bg-surface-warning border-border-warning font-secondary';
  const generalReasonBadgeClassName =
    'inline-flex h-7 !p-1 !text-[12px] !leading-[20px] font-bold normal-case !tracking-normal rounded-[4px] text-text-headings border bg-surface-disabled border-border-primary font-secondary';

  const getItemRefund = (item: ExtendedReturnItem) => {
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
  };

  const getItemUnitPrice = (item: ExtendedReturnItem) => ({
    grossValue: item.calculatedUnitPrice?.grossValue ?? item.grossUnitPrice?.value ?? item.unitPrice?.value,
    netValue: item.calculatedUnitPrice?.netValue ?? item.netPrice?.value ?? item.unitPrice?.value,
    currency:
      item.calculatedUnitPrice?.currency ??
      item.grossUnitPrice?.currency ??
      item.netPrice?.currency ??
      item.unitPrice?.currency,
  });

  const getItemRefundNet = (item: ExtendedReturnItem) => {
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
  };

  return (
    <Card className="border border-border-primary shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-border-primary">
          <H4 variant="h5" className="text-[32px] leading-[40px] font-bold text-text-headings font-primary">
            {t('returnedProducts')}
          </H4>
          {generalReasonCode && (
            <Badge className={generalReasonBadgeClassName}>{renderReturnReasonLabel(t, generalReasonCode)}</Badge>
          )}
        </div>

        {isTabletUp && (
          <div className="overflow-x-auto">
            <div className="grid grid-cols-[minmax(280px,1.6fr)_minmax(120px,1fr)_80px_minmax(140px,1fr)] gap-6 items-start pt-4 pb-4 border-b border-border-primary text-[16px] leading-[20px] font-bold text-text-headings font-primary min-w-[760px]">
              <div>{t('product')}</div>
              <div>{t('price')}</div>
              <div>{t('quantity')}</div>
              <div className="text-right">{t('refundAmount')}</div>
            </div>

            {items.map((item) => {
              const refund = getItemRefund(item);
              const refundNet = getItemRefundNet(item);
              const unitPrice = getItemUnitPrice(item);
              const firstImage = item.images?.[0];
              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[minmax(280px,1.6fr)_minmax(120px,1fr)_80px_minmax(140px,1fr)] gap-6 items-center pb-6 pt-6 border-b border-border-primary last:border-b-0 min-w-[760px]"
                >
                  <div className="flex gap-4 items-start min-w-0">
                    <div className="bg-surface-image-background w-[80px] h-[52px] shrink-0 rounded-tl-lg rounded-br-lg overflow-hidden flex items-center justify-center">
                      {firstImage ? (
                        <Image
                          src={firstImage}
                          alt={item.name}
                          width={80}
                          height={52}
                          className="object-contain w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-surface-image-background" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-2 justify-center">
                      <div className="flex flex-col gap-1">
                        {item.vendorName && (
                          <span className="text-[12px] leading-[20px] text-text-body font-secondary">
                            {item.vendorName}
                          </span>
                        )}
                        {item.productId ? (
                          <Link
                            href={`/product/${item.productId}`}
                            className="text-[16px] leading-[20px] font-bold text-text-headings hover:underline font-primary break-words"
                          >
                            {item.name}
                          </Link>
                        ) : (
                          <span className="text-[16px] leading-[20px] font-bold text-text-headings font-primary break-words">
                            {item.name}
                          </span>
                        )}
                      </div>
                      {item.itemNumber && (
                        <span className="text-[12px] leading-[20px] text-text-body font-secondary">
                          {t('itemNumberLabel')}: {item.itemNumber}
                        </span>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {item.reason?.code && (
                          <Badge className={reasonBadgeClassName}>{renderReturnReasonLabel(t, item.reason.code)}</Badge>
                        )}
                      </div>
                      {item.reason?.details && (
                        <p className="text-[12px] leading-[20px] text-text-body font-secondary">
                          {item.reason.details}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0 flex flex-col gap-1">
                    <span className="text-[16px] leading-[20px] font-bold text-text-headings font-primary">
                      {formatReturnCurrency(unitPrice.grossValue, unitPrice.currency, locale)}
                    </span>
                    {unitPrice.netValue !== undefined && (
                      <span className="text-[12px] leading-[20px] text-text-on-disabled font-secondary">
                        {t('net')} {formatReturnCurrency(unitPrice.netValue, unitPrice.currency, locale)}
                      </span>
                    )}
                  </div>
                  <div className="text-[16px] leading-[24px] text-text-body font-secondary">{item.quantity}</div>
                  <div className="min-w-0 flex flex-col gap-1 items-end text-right">
                    <span className="text-[16px] leading-[20px] font-bold text-text-headings font-primary">
                      {formatReturnCurrency(refund.value, refund.currency, locale)}
                    </span>
                    {(item.calculatedPrice?.finalPrice?.netValue !== undefined || item.netPrice || item.unitPrice) && (
                      <span className="text-[12px] leading-[20px] text-text-on-disabled font-secondary">
                        {t('net')} {formatReturnCurrency(refundNet.value, refundNet.currency, locale)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isTabletUp && (
          <div className="space-y-4">
            {items.map((item) => {
              const refund = getItemRefund(item);
              const refundNet = getItemRefundNet(item);
              const firstImage = item.images?.[0];
              return (
                <div key={item.id} className="border-b border-border-primary pb-4 last:border-b-0">
                  <div className="flex gap-3 items-start">
                    <div className="bg-surface-image-background w-[64px] h-[42px] shrink-0 rounded-tl-lg rounded-br-lg overflow-hidden flex items-center justify-center">
                      {firstImage ? (
                        <Image
                          src={firstImage}
                          alt={item.name}
                          width={64}
                          height={42}
                          className="object-contain w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-surface-image-background" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {item.vendorName && (
                        <span className="text-[12px] leading-[20px] text-text-body font-secondary block">
                          {item.vendorName}
                        </span>
                      )}
                      {item.productId ? (
                        <Link
                          href={`/product/${item.productId}`}
                          className="text-[14px] leading-[18px] font-bold text-text-headings hover:underline font-primary break-words"
                        >
                          {item.name}
                        </Link>
                      ) : (
                        <span className="text-[14px] leading-[18px] font-bold text-text-headings font-primary break-words">
                          {item.name}
                        </span>
                      )}
                      {item.itemNumber && (
                        <span className="text-[12px] leading-[20px] text-text-body font-secondary block mt-1">
                          {t('itemNumberLabel')}: {item.itemNumber}
                        </span>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {item.reason?.code && (
                          <Badge className={reasonBadgeClassName}>{renderReturnReasonLabel(t, item.reason.code)}</Badge>
                        )}
                      </div>
                      {item.reason?.details && (
                        <p className="mt-1 text-[12px] leading-[20px] text-text-body font-secondary">
                          {t('reason')}: {item.reason.details}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <div className="text-text-body">
                      <span className="font-semibold">{t('quantity')}:</span> {item.quantity}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-text-headings">
                        {formatReturnCurrency(refund.value, refund.currency, locale)}
                      </div>
                      {(item.calculatedPrice?.finalPrice?.netValue !== undefined ||
                        item.netPrice ||
                        item.unitPrice) && (
                        <div className="text-[12px] text-text-on-disabled">
                          {t('net')} {formatReturnCurrency(refundNet.value, refundNet.currency, locale)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
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
                <div key={index} className="aspect-[3/2] relative bg-surface-muted overflow-hidden">
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
                  >
                    {quantity === 1 ? <Trash2 className="h-4 w-4 text-action" /> : <Minus className="h-4 w-4" />}
                  </Button>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-12 w-15 text-center border-0 rounded-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-12 w-12 rounded-l-none border-l"
                    onClick={() => setQuantity(quantity + 1)}
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
                />
              </div>
            </div>

            <div>
              <Label htmlFor={`claimReason-${item.id}`} className="text-sm font-bold text-text-headings mb-1 block">
                {t('claimReason')}
              </Label>
              <Select value={claimReason} onValueChange={setClaimReason}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder={t('selectReason')} />
                </SelectTrigger>
                <SelectContent>
                  {claimReasonValues.map((value) => (
                    <SelectItem key={value} value={value}>
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
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" className="uppercase">
            {t('cancel')}
          </Button>
          <Button className="uppercase">{t('save')}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReturnDetail({ returnId, initialReturn }: ReturnDetailProps) {
  const t = useTranslations('account.returns');
  const locale = useLocale();
  const { returnItem: apiReturnItem, loading, error, refreshReturn } = useReturn(returnId, initialReturn);

  const returnItem: ExtendedReturn | null = (apiReturnItem as ExtendedReturn) || null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <H1 variant="h3">
            {t('title')}: {returnId}
          </H1>
        </div>
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
        <div className="flex items-center gap-4">
          <H1 variant="h3">
            {t('title')}: {returnId}
          </H1>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('error')}</AlertTitle>
          <AlertDescription>{error?.message || t('returnNotFound')}</AlertDescription>
        </Alert>
        <div className="flex gap-4">
          <Button onClick={() => refreshReturn()}>{t('tryAgain')}</Button>
          <Link href="/account/returns" passHref>
            <Button variant="secondary">{t('backToList')}</Button>
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
        <H1 variant="h3">
          {t('title')}: {returnItem.id}
        </H1>
        <ReturnStatusBadge status={returnItem.status} isExpired={returnItem.isExpired} />
      </div>

      <div className="grid gap-6 min-[1920px]:grid-cols-[minmax(0,1fr)_444px]">
        <div className="space-y-6 order-1">
          <ReturnItemsList items={allItems} locale={locale} t={t} generalReasonCode={returnItem.reason?.code} />

          {editMode && allItems.map((item) => <ProductDetailCard key={item.id} item={item} locale={locale} t={t} />)}
        </div>
        <div className="order-2 min-[1920px]:sticky min-[1920px]:top-6 h-fit">
          <ReturnOverview returnItem={returnItem} locale={locale} t={t} />
        </div>
      </div>
    </div>
  );
}
