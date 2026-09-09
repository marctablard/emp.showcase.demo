'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatReturnDate } from '@/components/account/returns/helpers';
import { type ItemQuantity, ReturnItemSelector } from '@/components/account/returns/return-item-selector';
import { useReturnErrorMessage } from '@/components/account/returns/use-return-error-message';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { useRouter } from '@/i18n/navigation';
import type { CreateReturnItem, ReturnReasonCode } from '@/lib/client/returns';
import { RETURN_REASON_CODES, createReturn } from '@/lib/client/returns';
import { type OrderReturnability, buildRemainingQuantityMap } from '@/lib/common/returns/returnability';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Order } from '@/platform/services/model/order/order';

interface CreateReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  returnability?: OrderReturnability;
}

/**
 * Dialog for creating a return request for an order
 * Displays order details and allows selecting quantities to return
 */
export function CreateReturnDialog({ open, onOpenChange, order, returnability }: CreateReturnDialogProps) {
  const MAX_DESCRIPTION_LENGTH = 500;
  const t = useTranslations('account.returns.createDialog');
  const tReturns = useTranslations('account.returns');
  const locale = useLocale();
  const returnErrorMessage = useReturnErrorMessage();
  const router = useRouter();
  const [quantities, setQuantities] = useState<ItemQuantity>({});
  const [reasonCode, setReasonCode] = useState<ReturnReasonCode | ''>('');
  const [reasonDetails, setReasonDetails] = useState('');
  const [provideAdditionalPerItemDetails, setProvideAdditionalPerItemDetails] = useState(false);
  const [itemReasons, setItemReasons] = useState<Record<string, ReturnReasonCode | ''>>({});
  const [itemReasonDetails, setItemReasonDetails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const detailsPerItemId = `return-details-per-item-${order.id}`;
  const globalReasonSelectId = `return-reason-global-${order.id}`;
  const globalReasonDescriptionId = `return-reason-description-global-${order.id}`;
  const reasonMode: 'single' | 'per-item' = provideAdditionalPerItemDetails ? 'per-item' : 'single';

  const remainingMap = returnability ? buildRemainingQuantityMap(returnability) : null;
  const returnableItems = remainingMap
    ? order.items.filter((item) => (remainingMap.get(item.id) ?? item.quantity) > 0)
    : order.items;

  const totalSelectedItems = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);

  const updateQuantity = (itemId: string, newQty: number, maxQty: number): void => {
    const clampedQty = Math.max(0, Math.min(newQty, maxQty));
    setQuantities((prev) => ({
      ...prev,
      [itemId]: clampedQty,
    }));
    if (clampedQty === 0) {
      setItemReasons((prev) => ({
        ...prev,
        [itemId]: '',
      }));
      setItemReasonDetails((prev) => ({
        ...prev,
        [itemId]: '',
      }));
    }
  };

  const setItemReason = (itemId: string, reason: ReturnReasonCode | '') => {
    setItemReasons((prev) => ({
      ...prev,
      [itemId]: reason,
    }));
  };

  const setItemReasonDescription = (itemId: string, details: string) => {
    setItemReasonDetails((prev) => ({
      ...prev,
      [itemId]: details,
    }));
  };

  const handleSubmit = async (): Promise<void> => {
    setLoading(true);

    try {
      const selectedItems = Object.entries(quantities).filter(([, qty]) => qty > 0);
      const items: CreateReturnItem[] = selectedItems.map(([id, quantity]) => ({
        id,
        quantity,
        reasonCode: provideAdditionalPerItemDetails ? itemReasons[id] || undefined : undefined,
        reasonDetails: provideAdditionalPerItemDetails ? itemReasonDetails[id]?.trim() || undefined : undefined,
      }));

      if (items.length === 0) {
        notify({
          title: t('noItemsSelected'),
          type: ToastType.Error,
        });
        return;
      }

      if (!reasonCode) {
        notify({
          title: t('reasonRequired'),
          type: ToastType.Error,
        });
        return;
      }

      const response = await createReturn(order.id, items, reasonCode, reasonDetails.trim() || undefined);

      onOpenChange(false);
      router.push(`/account/returns/${response.id}`);
    } catch (err) {
      // The server's English text goes to the log; the shopper sees the translated code.
      getLogger().error(
        { err, orderId: order.id, selectedItems: Object.keys(quantities).length },
        'Failed to create return',
      );
      notify({
        title: returnErrorMessage(err),
        type: ToastType.Error,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean): void => {
    if (!newOpen) {
      setQuantities({});
      setReasonCode('');
      setReasonDetails('');
      setProvideAdditionalPerItemDetails(false);
      setItemReasons({});
      setItemReasonDetails({});
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-full max-w-none sm:max-w-[736px] md:max-w-[790px] lg:max-w-[1224px] max-h-[90vh] overflow-y-auto overflow-x-hidden"
        data-testid="return-dialog"
        closeTestId="return-closeButton"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl md:text-3xl lg:text-4xl font-bold">{t('title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('description')}</DialogDescription>
        </DialogHeader>

        {/* Order Details */}
        <div className="flex gap-6 md:gap-8 py-4 border-b border-border-primary">
          <div>
            <p className="text-sm font-semibold text-text-body">{t('orderNumber')}</p>
            <p className="font-normal">{order.id}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-text-body">{t('deliveryDate')}</p>
            <p className="font-normal">{formatReturnDate(order.lastStatusChange, locale)}</p>
          </div>
        </div>

        {/* Return Reason */}
        <div className="py-4 border-b border-border-primary">
          <div>
            <label htmlFor={globalReasonSelectId} className="block text-sm font-semibold text-text-body mb-2">
              {t('returnReason')} <span className="text-text-error">*</span>
            </label>
            <Select
              value={reasonCode}
              onValueChange={(value: string) => setReasonCode(value as ReturnReasonCode)}
              disabled={loading}
            >
              <SelectTrigger
                id={globalReasonSelectId}
                className="w-full md:max-w-[420px]"
                data-testid="return-reasonSelect"
              >
                <SelectValue placeholder={t('selectReason')} />
              </SelectTrigger>
              <SelectContent>
                {RETURN_REASON_CODES.map((code) => (
                  <SelectItem key={code} value={code} data-testid={`return-reason-${code}`}>
                    {t(`reasons.${code}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4">
            <label htmlFor={globalReasonDescriptionId} className="block text-sm font-semibold text-text-body mb-2">
              {t('descriptionLabel')}
            </label>
            <Textarea
              id={globalReasonDescriptionId}
              value={reasonDetails}
              onChange={(event) => setReasonDetails(event.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
              maxLength={MAX_DESCRIPTION_LENGTH}
              disabled={loading}
              className="min-h-[144px] w-full md:max-w-[438px] resize-none"
              placeholder={t('descriptionPlaceholder')}
              data-testid="return-description"
            />
            <p className="mt-2 text-xs text-text-on-disabled">
              {reasonDetails.length}/{MAX_DESCRIPTION_LENGTH}
            </p>
          </div>

          <div className="flex items-start gap-3 mt-4">
            <Checkbox
              id={detailsPerItemId}
              checked={provideAdditionalPerItemDetails}
              onCheckedChange={(checked) => setProvideAdditionalPerItemDetails(Boolean(checked))}
              disabled={loading}
              data-testid="return-detailsPerItem"
            />
            <label htmlFor={detailsPerItemId} className="text-sm font-semibold text-text-body">
              {t('provideAdditionalPerItemDetails')}
            </label>
          </div>
        </div>

        <ReturnItemSelector
          items={returnableItems}
          quantities={quantities}
          onUpdateQuantity={updateQuantity}
          loading={loading}
          remainingQuantityMap={remainingMap ?? undefined}
          reasonMode={reasonMode}
          itemReasons={itemReasons}
          onItemReasonChange={setItemReason}
          itemReasonDetails={itemReasonDetails}
          onItemReasonDetailsChange={setItemReasonDescription}
          reasonOptions={RETURN_REASON_CODES}
        />

        {/* Footer */}
        <DialogFooter className="!justify-start flex flex-row gap-6 pt-4">
          <DialogClose asChild>
            <Button variant="secondary" size="default" disabled={loading} data-testid="return-cancelButton">
              {tReturns('cancel')}
            </Button>
          </DialogClose>
          <Button
            variant="primary"
            size="default"
            onClick={handleSubmit}
            disabled={totalSelectedItems === 0 || !reasonCode || loading}
            data-testid="return-submitButton"
          >
            {loading ? t('submitting') : t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
