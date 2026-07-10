'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Minus, Package, Plus } from 'lucide-react';
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
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/ui/useToast';
import { getReorderableItems } from '@/lib/common/orders/reorder';
import { getLogger } from '@/lib/logger/use-logger-client';
import { cn, formatCurrency } from '@/lib/utils';
import type { Order, OrderItem } from '@/platform/services/model/order/order';

interface ReorderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  addItem: (productId: string, quantity: number) => Promise<unknown>;
}

interface RowState {
  selected: boolean;
  quantity: number;
}

const MAX_QUANTITY = 999;

/**
 * Reorder dialog — lets the customer pick which products (and quantities) from a
 * past order to add back to the cart, instead of re-adding everything blindly.
 * Layout mirrors the account product tables (square vignettes, shared currency
 * formatting).
 */
export function ReorderDialog({ open, onOpenChange, order, addItem }: ReorderDialogProps) {
  const t = useTranslations('orders');
  const tDialog = useTranslations('orders.reorderDialog');
  const { toast } = useToast();

  const items = useMemo(() => getReorderableItems(order), [order]);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      const initial: Record<string, RowState> = {};
      for (const item of items) {
        initial[item.id] = { selected: true, quantity: item.quantity > 0 ? item.quantity : 1 };
      }
      setRows(initial);
    }
  }, [open, items]);

  const selectedItems = items.filter((item) => rows[item.id]?.selected && (rows[item.id]?.quantity ?? 0) > 0);
  const allSelected = items.length > 0 && selectedItems.length === items.length;
  const selectedCurrency = selectedItems.find((item) => item.price?.currency)?.price?.currency;
  const selectedTotal = selectedCurrency
    ? selectedItems.reduce((sum, item) => sum + (item.price?.value ?? 0) * (rows[item.id]?.quantity ?? 0), 0)
    : undefined;

  const toggleAll = (checked: boolean) => {
    setRows((prev) => {
      const next: Record<string, RowState> = {};
      for (const item of items) {
        next[item.id] = { selected: checked, quantity: prev[item.id]?.quantity ?? item.quantity };
      }
      return next;
    });
  };

  const toggleItem = (itemId: string, checked: boolean) => {
    setRows((prev) => ({ ...prev, [itemId]: { ...prev[itemId], selected: checked } }));
  };

  const setQuantity = (itemId: string, quantity: number) => {
    const clamped = Math.max(1, Math.min(quantity, MAX_QUANTITY));
    setRows((prev) => ({ ...prev, [itemId]: { ...prev[itemId], quantity: clamped } }));
  };

  const handleConfirm = async () => {
    if (selectedItems.length === 0) return;
    setLoading(true);
    const logger = getLogger();
    const failed: OrderItem[] = [];

    for (const item of selectedItems) {
      try {
        await addItem(item.productId, rows[item.id].quantity);
      } catch {
        failed.push(item);
        logger.error({ productId: item.productId, orderId: order.id }, 'Failed to reorder item');
      }
    }

    setLoading(false);

    if (failed.length === 0) {
      toast({ title: t('reorderAddedToCart'), variant: 'success' });
      onOpenChange(false);
    } else if (failed.length < selectedItems.length) {
      toast({ title: t('reorderPartialFailure', { failed: failed.length }), variant: 'destructive', persistent: true });
      onOpenChange(false);
    } else {
      toast({ title: t('reorderFailed'), variant: 'destructive', persistent: true });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[calc(100vw-32px)] max-w-[860px] flex-col gap-0 overflow-hidden p-0 sm:p-0">
        <DialogHeader className="shrink-0 p-4 pr-12 sm:p-6 sm:pr-12">
          <DialogTitle className="text-2xl font-bold md:text-3xl">{tDialog('title')}</DialogTitle>
          <DialogDescription>{tDialog('description', { orderId: `#${order.id}` })}</DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 items-center gap-3 border-y border-border-primary bg-surface-image-background/40 px-4 py-3 sm:px-6">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(checked) => toggleAll(Boolean(checked))}
            disabled={loading}
            aria-label={tDialog('selectAll')}
          />
          <span className="text-sm font-bold text-text-headings">{tDialog('selectAll')}</span>
          <span className="ml-auto text-sm tabular-nums text-text-placeholders">
            {selectedItems.length} / {items.length}
          </span>
        </div>

        <div className="min-h-0 flex-1 divide-y divide-border-primary overflow-y-auto">
          {items.map((item) => {
            const row = rows[item.id] ?? { selected: false, quantity: item.quantity };
            const imageUrl = item.images?.[0];
            const unitPrice = item.price?.value;
            const currency = item.price?.currency;
            const lineTotal = unitPrice != null ? unitPrice * row.quantity : undefined;

            return (
              <div key={item.id} className={cn('px-4 py-4 sm:px-6', !row.selected && 'opacity-55')}>
                {/* Name + SKU: full width, above everything */}
                <div className="min-w-0">
                  <p className="line-clamp-2 font-medium text-text-headings" title={item.name || item.productId}>
                    {item.name || item.productId}
                  </p>
                  {item.sku ? (
                    <p className="truncate text-xs text-text-placeholders" title={item.sku}>
                      SKU: {item.sku}
                    </p>
                  ) : null}
                </div>

                {/* Controls: checkbox + vignette on the left, stepper + price on the right */}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
                  <Checkbox
                    checked={row.selected}
                    onCheckedChange={(checked) => toggleItem(item.id, Boolean(checked))}
                    disabled={loading}
                    aria-label={item.name || item.productId}
                  />
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border border-border-primary bg-surface-image-background">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={item.name || ''}
                        width={48}
                        height={48}
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Package className="h-5 w-5 text-icon-secondary opacity-40" aria-hidden="true" />
                    )}
                  </span>

                  <div className="ml-auto flex items-center gap-4">
                    <div className="flex items-center border border-border-primary">
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="h-9 w-9 rounded-none border-none"
                        onClick={() => setQuantity(item.id, row.quantity - 1)}
                        disabled={loading || !row.selected || row.quantity <= 1}
                        aria-label={tDialog('decrease')}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="flex h-9 w-12 items-center justify-center border-x border-border-primary bg-surface-page text-sm font-medium tabular-nums">
                        {row.quantity}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="h-9 w-9 rounded-none border-none"
                        onClick={() => setQuantity(item.id, row.quantity + 1)}
                        disabled={loading || !row.selected || row.quantity >= MAX_QUANTITY}
                        aria-label={tDialog('increase')}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="w-28 text-right sm:w-32">
                      <p className="font-bold tabular-nums text-text-headings">
                        {lineTotal != null && currency ? formatCurrency(lineTotal, currency) : '–'}
                      </p>
                      {unitPrice != null && currency ? (
                        <p className="text-xs tabular-nums text-text-placeholders">
                          {row.quantity} × {formatCurrency(unitPrice, currency)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex w-full min-w-0 shrink-0 flex-col-reverse gap-4 border-t border-border-primary p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex gap-3">
            <DialogClose asChild>
              <Button variant="secondary" disabled={loading}>
                {tDialog('cancel')}
              </Button>
            </DialogClose>
            <Button variant="primary" onClick={handleConfirm} disabled={selectedItems.length === 0 || loading}>
              {loading ? <Spinner variant="sm" className="mr-2" /> : null}
              {tDialog('confirm', { count: selectedItems.length })}
            </Button>
          </div>
          {selectedTotal != null && selectedCurrency ? (
            <div className="flex items-baseline gap-2 sm:flex-col sm:items-end sm:gap-0.5">
              <span className="text-sm text-text-placeholders">{t('total')}</span>
              <span className="text-lg font-bold tabular-nums text-text-headings">
                {formatCurrency(selectedTotal, selectedCurrency)}
              </span>
            </div>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ReorderDialog;
