'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ReturnReasonCode } from '@/lib/client/returns';
import { formatCurrency } from '@/lib/utils';
import { OrderItem } from '@/platform/services/model/order/order';

export interface ItemQuantity {
  [itemId: string]: number;
}

export interface ReturnItemSelectorProps {
  items: OrderItem[];
  quantities: ItemQuantity;
  onUpdateQuantity: (itemId: string, newQty: number, maxQty: number) => void;
  loading: boolean;
  remainingQuantityMap?: Map<string, number>;
  reasonMode: 'single' | 'per-item';
  itemReasons: Record<string, ReturnReasonCode | ''>;
  onItemReasonChange: (itemId: string, reason: ReturnReasonCode | '') => void;
  itemReasonDetails: Record<string, string>;
  onItemReasonDetailsChange: (itemId: string, details: string) => void;
  reasonOptions: ReturnReasonCode[];
}

function getItemImage(item: OrderItem): string {
  if (item.images && item.images.length > 0) {
    return item.images[0];
  }
  return '/images/placeholder.png';
}

export function ReturnItemSelector({
  items,
  quantities,
  onUpdateQuantity,
  loading,
  remainingQuantityMap,
  reasonMode,
  itemReasons,
  onItemReasonChange,
  itemReasonDetails,
  onItemReasonDetailsChange,
  reasonOptions,
}: ReturnItemSelectorProps) {
  const MAX_DESCRIPTION_LENGTH = 500;
  const t = useTranslations('account.returns.createDialog');
  const tReturns = useTranslations('account.returns');

  return (
    <div className="py-4 w-full min-w-0">
      <div className="hidden md:grid grid-cols-[1fr_154px_100px] gap-4 pb-4 text-sm font-medium text-text-on-disabled">
        <div>{tReturns('productDetails')}</div>
        <div>{tReturns('quantity')}</div>
        <div className="text-right">{tReturns('unitPrice')}</div>
      </div>

      <div className="space-y-4 w-full min-w-0">
        {items.map((item) => {
          const currentQty = quantities[item.id] || 0;
          const maxQty = remainingQuantityMap ? (remainingQuantityMap.get(item.id) ?? item.quantity) : item.quantity;
          const unitNetValue = item.price?.netValue ?? item.price?.value;
          const unitGrossValue = item.price?.grossValue ?? unitNetValue;
          const totalGrossValue = unitGrossValue !== undefined ? unitGrossValue * currentQty : undefined;
          const totalNetValue = unitNetValue !== undefined ? unitNetValue * currentQty : undefined;
          const priceCurrency = item.price?.currency;

          return (
            <div key={item.id} className="py-4 border-b border-border-secondary w-full min-w-0">
              {/* Desktop Layout */}
              <div className="hidden md:grid grid-cols-[1fr_154px_100px] gap-4 items-start">
                <div className="flex gap-4">
                  <div className="w-20 h-13 relative flex-shrink-0 bg-surface-image-background rounded">
                    <Image src={getItemImage(item)} alt={item.name || ''} fill className="object-contain p-1" />
                  </div>
                  <div className="flex flex-col gap-1">
                    {item.sku && <span className="text-sm text-text-on-disabled">{item.sku}</span>}
                    <span className="font-medium">{item.name}</span>
                    <span className="text-sm text-text-on-disabled">
                      {t('itemNumber')}: {item.sku || item.productId || '-'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center">
                  <div className="flex border border-border-primary rounded overflow-hidden">
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="h-12 w-12 rounded-none border-none"
                      onClick={() => onUpdateQuantity(item.id, currentQty - 1, maxQty)}
                      disabled={currentQty <= 0 || loading}
                      aria-label={t('decrease')}
                      data-testid={`return-item-decrease-${item.id}`}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="w-15 h-12 flex items-center justify-center border-x border-border-primary bg-surface-page">
                      <span className="font-medium">{currentQty}</span>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="h-12 w-12 rounded-none border-none"
                      onClick={() => onUpdateQuantity(item.id, currentQty + 1, maxQty)}
                      disabled={currentQty >= maxQty || loading}
                      aria-label={t('increase')}
                      data-testid={`return-item-increase-${item.id}`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="text-right">
                  {priceCurrency && totalGrossValue !== undefined ? (
                    <>
                      <p className="font-medium">{formatCurrency(totalGrossValue, priceCurrency)}</p>
                      {totalNetValue !== undefined && (
                        <p className="text-sm text-text-on-disabled">
                          {tReturns('net')} {formatCurrency(totalNetValue, priceCurrency)}
                        </p>
                      )}
                    </>
                  ) : (
                    <span>-</span>
                  )}
                </div>
              </div>
              {reasonMode === 'per-item' && (
                <div className="hidden md:block mt-4 max-w-xs">
                  <label htmlFor={`item-reason-${item.id}`} className="block text-xs font-semibold text-text-body mb-2">
                    {t('returnReasonOptional' as any)}
                  </label>
                  <Select
                    value={itemReasons[item.id] || ''}
                    onValueChange={(value: string) => onItemReasonChange(item.id, value as ReturnReasonCode)}
                    disabled={loading || currentQty <= 0}
                  >
                    <SelectTrigger id={`item-reason-${item.id}`} className="w-full">
                      <SelectValue placeholder={t('selectReason')} />
                    </SelectTrigger>
                    <SelectContent>
                      {reasonOptions.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {t(`reasons.${reason}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label
                    htmlFor={`item-reason-description-${item.id}`}
                    className="mt-4 block text-xs font-semibold text-text-body mb-2"
                  >
                    {t('descriptionOptional' as any)}
                  </label>
                  <Textarea
                    id={`item-reason-description-${item.id}`}
                    value={itemReasonDetails[item.id] || ''}
                    onChange={(event) =>
                      onItemReasonDetailsChange(item.id, event.target.value.slice(0, MAX_DESCRIPTION_LENGTH))
                    }
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    disabled={loading || currentQty <= 0}
                    className="min-h-[144px] w-full resize-none"
                    placeholder={t('descriptionPlaceholder' as any)}
                  />
                  <p className="mt-2 text-xs text-text-on-disabled">
                    {(itemReasonDetails[item.id] || '').length}/{MAX_DESCRIPTION_LENGTH}
                  </p>
                </div>
              )}

              {/* Mobile Layout */}
              <div className="flex flex-col gap-4 md:hidden w-full min-w-0">
                <div className="flex flex-col gap-1">
                  {item.sku && <span className="text-xs text-text-body">{item.sku}</span>}
                  <span className="text-sm font-bold text-text-headings">{item.name}</span>
                </div>

                <div className="flex gap-4 w-full min-w-0">
                  <div className="w-[100px] h-[65px] relative flex-shrink-0 bg-surface-image-background rounded-tl-lg rounded-br-lg">
                    <Image src={getItemImage(item)} alt={item.name || ''} fill className="object-contain p-2" />
                  </div>

                  <div className="flex flex-col gap-3 flex-1 min-w-0">
                    <div className="flex flex-col gap-1">
                      {priceCurrency && totalGrossValue !== undefined ? (
                        <>
                          <p className="text-sm font-bold text-text-headings">
                            {formatCurrency(totalGrossValue, priceCurrency)}
                          </p>
                          {totalNetValue !== undefined && (
                            <p className="text-xs text-text-on-disabled">
                              {tReturns('net')} {formatCurrency(totalNetValue, priceCurrency)}
                            </p>
                          )}
                        </>
                      ) : (
                        <span>-</span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-text-body truncate">
                        {t('itemNumber')}: {item.sku || item.productId || '-'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-[48px_1fr_48px] border border-border-primary rounded w-full">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-12 w-full rounded-l rounded-r-none border-none"
                    onClick={() => onUpdateQuantity(item.id, currentQty - 1, maxQty)}
                    disabled={currentQty <= 0 || loading}
                    aria-label={t('decrease')}
                    data-testid={`return-item-decrease-mobile-${item.id}`}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="h-12 flex items-center justify-center border-x border-border-primary bg-surface-page">
                    <span className="font-medium">{currentQty}</span>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-12 w-full rounded-r rounded-l-none border-none"
                    onClick={() => onUpdateQuantity(item.id, currentQty + 1, maxQty)}
                    disabled={currentQty >= maxQty || loading}
                    aria-label={t('increase')}
                    data-testid={`return-item-increase-mobile-${item.id}`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {reasonMode === 'per-item' && (
                  <div>
                    <label
                      htmlFor={`item-reason-mobile-${item.id}`}
                      className="block text-xs font-semibold text-text-body mb-2"
                    >
                      {t('returnReasonOptional' as any)}
                    </label>
                    <Select
                      value={itemReasons[item.id] || ''}
                      onValueChange={(value: string) => onItemReasonChange(item.id, value as ReturnReasonCode)}
                      disabled={loading || currentQty <= 0}
                    >
                      <SelectTrigger id={`item-reason-mobile-${item.id}`} className="w-full">
                        <SelectValue placeholder={t('selectReason')} />
                      </SelectTrigger>
                      <SelectContent>
                        {reasonOptions.map((reason) => (
                          <SelectItem key={reason} value={reason}>
                            {t(`reasons.${reason}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label
                      htmlFor={`item-reason-description-mobile-${item.id}`}
                      className="mt-4 block text-xs font-semibold text-text-body mb-2"
                    >
                      {t('descriptionOptional' as any)}
                    </label>
                    <Textarea
                      id={`item-reason-description-mobile-${item.id}`}
                      value={itemReasonDetails[item.id] || ''}
                      onChange={(event) =>
                        onItemReasonDetailsChange(item.id, event.target.value.slice(0, MAX_DESCRIPTION_LENGTH))
                      }
                      maxLength={MAX_DESCRIPTION_LENGTH}
                      disabled={loading || currentQty <= 0}
                      className="min-h-[144px] w-full resize-none"
                      placeholder={t('descriptionPlaceholder' as any)}
                    />
                    <p className="mt-2 text-xs text-text-on-disabled">
                      {(itemReasonDetails[item.id] || '').length}/{MAX_DESCRIPTION_LENGTH}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
