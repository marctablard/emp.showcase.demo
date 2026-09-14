'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { BadgePercent, Ban, CreditCard, ReceiptText, RotateCcw, Truck } from 'lucide-react';
import { detailTaxRateSuffix, shouldDisplayTaxLine } from '@/components/account/shared/detail-tax-line';
import { formatShippingFeeDisplay } from '@/components/account/shared/format-shipping-fee';
import { ProductListResolver } from '@/components/product/product-list-resolver';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { H3, H4, H5 } from '@/components/ui/h';
import UiLink from '@/components/ui/link';
import { Skeleton } from '@/components/ui/skeleton';
import { SummaryCard, SummaryField } from '@/components/ui/summary-card';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useOrder } from '@/hooks/order/useOrder';
import { type PaymentModeKey, dk } from '@/i18n/dynamic-key';
import { isOrderAccessDeniedError } from '@/lib/client/orders';
import { fetchReturnsForOrder } from '@/lib/client/returns';
import { ORDER_CUSTOMER_DECLINE_NOT_ALLOWED_MESSAGE } from '@/lib/common/order-customer-decline-not-allowed';
import { buildOrderOverviewBreakdown } from '@/lib/common/order-overview-summary';
import { type OrderReturnability, computeOrderReturnability } from '@/lib/common/returns/returnability';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Address } from '@/platform/services/model/common';
import type { OrderDiscount } from '@/platform/services/model/order/order';
import type { Order, OrderStatus } from '@/platform/services/model/order/order';
import { ORDER_STATUS } from '@/platform/services/model/order/order-status';
import { CreateReturnDialog } from './create-return-dialog';
import { OrderStatusBadge } from './order-status-badge';

const TRACKING_ELIGIBLE_STATUSES: Set<OrderStatus> = new Set([
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.READY_FOR_SHIPPING,
  ORDER_STATUS.READY_FOR_PICKUP,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.COMPLETED,
]);

function shouldShowCancelButton(status: OrderStatus, transitions: string[]): boolean {
  return status === ORDER_STATUS.CREATED && transitions.includes('DECLINED');
}

function shouldShowReturnButton(status: OrderStatus): boolean {
  return status === ORDER_STATUS.COMPLETED;
}

function shouldShowTrackShipmentControl(status: OrderStatus): boolean {
  return TRACKING_ELIGIBLE_STATUSES.has(status);
}

function renderAddress(address: Address) {
  return (
    <p>
      {address.contactName}
      <br />
      {address.street} {address.streetNumber || ''}
      <br />
      {address.zipCode} {address.city}
      <br />
      {address.country}
    </p>
  );
}

function formatOverviewAmount(amount: number, currency: string): string {
  return `${amount} ${currency}`;
}

function formatOverviewSignedAmount(amount: number, currency: string): string {
  return `-${Math.abs(amount)} ${currency}`;
}

function OrderAppliedPromoList({ discounts }: { readonly discounts: OrderDiscount[] }) {
  return (
    <ul className="flex w-full flex-col gap-3 rounded-md border border-border-success bg-surface-success px-4 py-2">
      {discounts.map((discount, index) => (
        <li
          key={`${discount.code}-${index}`}
          className="flex w-full flex-col gap-0.5"
          data-testid={`order-appliedPromo-${discount.code}`}
        >
          <div className="flex items-center gap-1">
            <BadgePercent className="size-[18px] shrink-0 text-icon-success" aria-hidden />
            <p className="min-w-0 flex-1 text-xs leading-5 text-text-body">{discount.code}</p>
          </div>
          {(discount.description || typeof discount.value === 'number') && (
            <div className="flex items-start justify-between gap-2 text-xs leading-5 text-text-body">
              {discount.description ? <p className="min-w-0 font-bold">{discount.description}</p> : <span />}
              <p className="shrink-0 text-right font-bold">
                {formatOverviewSignedAmount(discount.value, discount.currency)}
              </p>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function OrderSavingsBadge({ amount, currency }: { readonly amount: number; readonly currency: string }) {
  const tOrder = useTranslations('orders');
  return (
    <div className="flex justify-end">
      <div
        className="rounded-sm bg-surface-success px-2 py-1 text-xs leading-5 text-text-body"
        data-testid="order-yourSavings"
      >
        <span>{tOrder('yourSavings')} </span>
        <span className="font-bold">{formatOverviewSignedAmount(amount, currency)}</span>
      </div>
    </div>
  );
}

function OrderOverviewTotals({ order }: { readonly order: Order }) {
  const tOrder = useTranslations('orders');
  const tCommon = useTranslations('common');
  if (!order.price) {
    return null;
  }

  const breakdown = buildOrderOverviewBreakdown(order);
  const currency = breakdown.currency || order.price.subtotal.currency;
  const hasAppliedCoupons = Boolean(breakdown.hasAppliedCoupons);
  const isGrossApplied = hasAppliedCoupons && breakdown.couponApplyBasis === 'gross';
  const goodsTaxInput = {
    taxRate: order.price.subtotal.taxRate,
    taxAmount: isGrossApplied ? (breakdown.originalGoodsVat ?? 0) : breakdown.goodsVat,
    netAmount: isGrossApplied ? (breakdown.originalGoodsNet ?? breakdown.goodsNet) : breakdown.goodsNet,
  };
  const showGoodsVat = shouldDisplayTaxLine(goodsTaxInput);
  const goodsVatAmount = isGrossApplied ? (breakdown.originalGoodsVat ?? 0) : breakdown.goodsVat;
  const savingsBadge =
    typeof breakdown.savingsTotal === 'number' ? (
      <OrderSavingsBadge amount={breakdown.savingsTotal} currency={currency} />
    ) : null;

  let goodsTotals: ReactNode;
  if (isGrossApplied) {
    goodsTotals = (
      <>
        <div className="flex justify-between items-start gap-4">
          <span>{tOrder('valueOfGoods')}</span>
          <span className="text-right font-normal">
            {formatOverviewAmount(breakdown.originalGoodsNet ?? breakdown.goodsNet, currency)}
          </span>
        </div>
        {showGoodsVat && (
          <div className="flex justify-between gap-4 pt-2">
            <span>
              {tCommon('tax')}
              {detailTaxRateSuffix(goodsTaxInput)}
            </span>
            <span>{formatOverviewAmount(goodsVatAmount, currency)}</span>
          </div>
        )}
        <div className="flex flex-col gap-2 border-t border-border-primary pt-4">
          <div className="flex justify-between gap-4" data-testid="order-originalGrossValue">
            <span>{tOrder('originalGrossValue')}</span>
            <span className="line-through">
              {formatOverviewAmount(breakdown.originalGoodsGross ?? order.price.subtotal.gross, currency)}
            </span>
          </div>
          {savingsBadge}
          <div className="flex justify-between gap-4" data-testid="order-grossValueOfGoods">
            <span>{tOrder('grossValueOfGoods')}</span>
            <span className="font-bold">{formatOverviewAmount(breakdown.goodsDiscountedGross ?? 0, currency)}</span>
          </div>
        </div>
      </>
    );
  } else if (hasAppliedCoupons) {
    goodsTotals = (
      <>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-start gap-4" data-testid="order-originalValueOfGoods">
            <span>{tOrder('originalValueOfGoods')}</span>
            <span className="text-right font-normal line-through">
              {formatOverviewAmount(breakdown.originalGoodsNet ?? breakdown.goodsNet, currency)}
            </span>
          </div>
          {savingsBadge}
        </div>
        <div className="flex justify-between items-start gap-4 border-t border-border-primary pt-4">
          <span>{tOrder('netValueOfGoods')}</span>
          <span className="text-right font-bold">{formatOverviewAmount(breakdown.goodsNet, currency)}</span>
        </div>
      </>
    );
  } else {
    goodsTotals = (
      <div className="flex justify-between items-start gap-4 border-b border-border-primary pb-4">
        <span>{tOrder('netValueOfGoods')}</span>
        <span className="text-right font-normal">{formatOverviewAmount(breakdown.goodsNet, currency)}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-base font-body text-text-body">
      {breakdown.discounts && breakdown.discounts.length > 0 ? (
        <OrderAppliedPromoList discounts={breakdown.discounts} />
      ) : null}
      {goodsTotals}
      {!isGrossApplied && showGoodsVat && (
        <div className="flex justify-between gap-4 pt-2">
          <span>
            {tCommon('tax')}
            {detailTaxRateSuffix(goodsTaxInput)}
          </span>
          <span>{formatOverviewAmount(goodsVatAmount, currency)}</span>
        </div>
      )}

      {order.shipping && (
        <div className="flex justify-between gap-4 pt-2">
          <span>{tOrder('shippingFee')}</span>
          <span>
            {formatShippingFeeDisplay(
              order.shipping.total.value,
              (amount) => formatOverviewAmount(amount, order.shipping!.total.currency),
              tOrder('free'),
            )}
          </span>
        </div>
      )}

      {breakdown.showShippingVat && order.shipping?.total.tax !== undefined && (
        <div className="flex justify-between gap-4 pt-2">
          <span>
            {tOrder('shippingVat')}
            {detailTaxRateSuffix({
              taxRate: order.shipping.total.taxRate,
              taxAmount: order.shipping.total.tax,
            })}
          </span>
          <span>{formatOverviewAmount(order.shipping.total.tax, order.shipping.total.currency)}</span>
        </div>
      )}

      <div className="flex justify-between items-start gap-4 pt-2">
        <H5>{tOrder('totalValue')}</H5>
        <H5>{formatOverviewAmount(breakdown.total, order.price.total.currency)}</H5>
      </div>
    </div>
  );
}

/**
 * Order Detail component
 * Displays detailed information for a single order
 */
export function OrderDetail({
  orderId,
  initialOrder,
}: {
  readonly orderId: string;
  readonly initialOrder?: Order | null;
}) {
  const tOrder = useTranslations('orders');
  const tPaymentModes = useTranslations('checkout.PaymentModes');
  const locale = useLocale();
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [returnability, setReturnability] = useState<OrderReturnability | null>(null);

  const { order, loading, error, cancelOrder, statusTransitions } = useOrder({ orderId, initialOrder });
  const orderErrorMessage =
    error && isOrderAccessDeniedError(error) ? tOrder('orderAccessDenied') : tOrder('errorFetchingOrder');

  useEffect(() => {
    if (!order || order.status !== ORDER_STATUS.COMPLETED) return;
    let cancelled = false;
    const syncReturnability = async () => {
      try {
        const existingReturns = await fetchReturnsForOrder(order.id);
        if (cancelled) return;
        setReturnability(computeOrderReturnability(order.id, order.items, existingReturns));
      } catch (_error) {
        if (!cancelled) setReturnability(null);
      }
    };
    void syncReturnability();
    return () => {
      cancelled = true;
    };
  }, [order]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-8 w-64" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-48" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !order) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-text-error">{orderErrorMessage}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const shippingMethodName = order.shipping?.methods?.[0]?.name;
  const showTransportCard = Boolean(shippingMethodName || order.expectedDeliveryDate || order.shippingAddress);
  const showPaymentCard = Boolean((order.payments && order.payments.length > 0) || order.billingAddress);
  const showCancelButton = shouldShowCancelButton(order.status, statusTransitions);
  const showReturnButton = shouldShowReturnButton(order.status);
  const showTrackShipmentControl = shouldShowTrackShipmentControl(order.status);
  const hasHeaderActions = showCancelButton || showReturnButton || showTrackShipmentControl;
  const productItems = order.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    name: item.name || item.productId,
    brand: item.vendorName,
    itemNumber: item.sku,
    quantity: item.quantity,
    unitPrice: item.price?.value ?? 0,
    currency: item.price?.currency ?? '',
    netUnitPrice: item.price?.netValue,
    grossUnitPrice: item.price?.grossValue,
    imageUrl: item.images?.[0] ?? null,
    href: `/product/${item.productId}`,
  }));

  const handleCancelDialogOpenChange = (open: boolean) => {
    if (open) {
      setCancelDialogOpen(true);
      return;
    }
    if (isCancelling) return;
    setCancelDialogOpen(false);
  };

  const handleDismissCancelDialog = () => {
    if (isCancelling) return;
    setCancelDialogOpen(false);
  };

  const handleConfirmCancelOrder = async () => {
    if (!cancelOrder || isCancelling) return;
    try {
      setIsCancelling(true);
      await cancelOrder();
      setCancelDialogOpen(false);
    } catch (err) {
      getLogger().error({ err }, 'Failed to cancel order');
      const message = err instanceof Error ? err.message : '';
      const description =
        message === ORDER_CUSTOMER_DECLINE_NOT_ALLOWED_MESSAGE
          ? tOrder('cancelOrderNotAllowed')
          : message || tOrder('cancelOrderFailedUnknown');
      notify({
        title: tOrder('cancelOrderFailed'),
        description,
        type: ToastType.Error,
      });
      setCancelDialogOpen(false);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header: title + status stay together; from sm, actions wrap as one horizontal row
          under that band on small tablets when space is tight (same pattern as Quote). */}
      <div
        className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
        data-testid="order-detail-header"
      >
        <div className="flex min-w-0 flex-nowrap items-center gap-3">
          <H3 className="min-w-0 break-words">
            {tOrder('orderIdHeading')}: {order.id}
          </H3>
          <div className="shrink-0">
            <OrderStatusBadge status={order.status} />
          </div>
        </div>

        {hasHeaderActions && (
          <div
            className="flex w-full flex-col gap-4 sm:w-auto sm:shrink-0 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end"
            data-testid="order-detail-header-actions"
          >
            {showCancelButton && cancelOrder && (
              <Button variant="secondary" onClick={() => setCancelDialogOpen(true)} data-testid="order-cancelButton">
                <Ban className="h-6 w-6" />
                {tOrder('cancelOrder')}
              </Button>
            )}
            {showReturnButton &&
              (returnability?.hasAnyReturnableItem === false ? (
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <span className="w-full sm:w-auto">
                      <Button
                        variant="secondary"
                        disabled
                        className="w-full sm:w-auto"
                        data-testid="order-returnButton"
                      >
                        <RotateCcw className="h-6 w-6" />
                        {tOrder('returnOrder')}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="w-[22rem] max-w-[calc(100vw-2rem)] text-wrap">
                    {tOrder('noRemainingItems')}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button variant="secondary" onClick={() => setReturnDialogOpen(true)} data-testid="order-returnButton">
                  <RotateCcw className="h-6 w-6" />
                  {tOrder('returnOrder')}
                </Button>
              ))}
            {showTrackShipmentControl && (
              <Button variant="secondary" disabled aria-disabled="true" data-testid="order-trackShipmentButton">
                <Truck className="h-6 w-6" />
                {tOrder('trackShipment')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Compact Order Details strip: single surface-primary card, theme shadow, p-6, H4 title */}
      <div className="rounded-md bg-surface-primary shadow-sm p-6" data-testid="order-details-strip">
        <div className="flex flex-col items-start gap-6">
          <H4>{tOrder('orderDetails')}</H4>
          <div className="grid w-full grid-cols-1 gap-2 pb-1 sm:grid-cols-2">
            <SummaryField label={tOrder('orderNumber')} valueClassName="text-sm">
              {order.id}
            </SummaryField>
            <SummaryField label={tOrder('orderDate')} valueClassName="text-sm">
              {order.createdAt ? format(new Date(order.createdAt), 'PPP') : '-'}
            </SummaryField>
            {order.quoteId && (
              <SummaryField label={tOrder('relatedQuote')} valueClassName="text-sm">
                <UiLink
                  href={`/account/quotes/${order.quoteId}`}
                  type="Link"
                  variant="textNoUnderline"
                  data-testid="order-relatedQuote"
                >
                  {order.quoteId}
                </UiLink>
              </SummaryField>
            )}
          </div>
        </div>
      </div>

      {/* Detail cards: Order Overview, Shipping, Payment — 3 cols from lg so cards fill width (no empty 4th track). */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="p-6 rounded-md bg-surface-action-hover-2 shadow-sm">
          <SummaryCard
            heading={tOrder('orderOverview')}
            className="shadow-none rounded-md p-4 h-full gap-4"
            headerClassName="p-0"
            contentClassName="p-0 space-y-4"
            icon={<ReceiptText className="h-8 w-8 text-text-action" />}
            hasHeadline
          >
            <OrderOverviewTotals order={order} />
          </SummaryCard>
        </div>

        {showTransportCard && (
          <div className="p-6 rounded-md bg-surface-action-hover-2 shadow-sm">
            <SummaryCard
              heading={tOrder('shipping')}
              className="shadow-none rounded-md p-4 h-full gap-4"
              headerClassName="p-0"
              contentClassName="p-0 space-y-4"
              icon={<Truck className="h-8 w-8 text-text-action" />}
              hasHeadline
            >
              {shippingMethodName && <SummaryField label={tOrder('shippingMethod')}>{shippingMethodName}</SummaryField>}
              {order.expectedDeliveryDate && (
                <SummaryField label={tOrder('deliveryDate')}>
                  {format(new Date(order.expectedDeliveryDate), 'PPP')}
                </SummaryField>
              )}
              {order.shippingAddress && (
                <SummaryField label={tOrder('shippingAddress')}>{renderAddress(order.shippingAddress)}</SummaryField>
              )}
            </SummaryCard>
          </div>
        )}

        {showPaymentCard && (
          <div className="p-6 rounded-md bg-surface-action-hover-2 shadow-sm">
            <SummaryCard
              heading={tOrder('payment')}
              className="shadow-none rounded-md p-4 h-full gap-4"
              headerClassName="p-0"
              contentClassName="p-0 space-y-4"
              icon={<CreditCard className="h-8 w-8 text-text-action" />}
              hasHeadline
            >
              {order.payments && order.payments.length > 0 && (
                <SummaryField label={tOrder('paymentMethod')}>
                  {tPaymentModes(dk<PaymentModeKey>(order.payments[0].method.toLowerCase()))}
                </SummaryField>
              )}
              {order.billingAddress && (
                <SummaryField label={tOrder('billingAddress')}>{renderAddress(order.billingAddress)}</SummaryField>
              )}
            </SummaryCard>
          </div>
        )}
      </div>

      {/* Product list — catalog brand enrichment via ProductListResolver (same as Quote/Approval). */}
      <ProductListResolver
        items={productItems}
        locale={locale}
        className="border border-border-primary shadow-sm"
        showGrossUnderNet
        presentationConfig={{
          labels: {
            product: tOrder('product'),
            quantity: tOrder('quantity'),
            unitPrice: tOrder('price'),
            amount: tOrder('price'),
          },
          showGrossSecondary: true,
        }}
      />

      {order && (
        <CreateReturnDialog
          order={order}
          open={returnDialogOpen}
          onOpenChange={setReturnDialogOpen}
          returnability={returnability ?? undefined}
        />
      )}

      <ConfirmationDialog
        open={cancelDialogOpen}
        onOpenChange={handleCancelDialogOpenChange}
        title={tOrder('cancelOrderConfirmTitle')}
        description={tOrder('cancelOrderConfirmDescription')}
        cancelLabel={tOrder('keepOrder')}
        confirmLabel={tOrder('cancelOrder')}
        onCancel={handleDismissCancelDialog}
        onConfirm={() => void handleConfirmCancelOrder()}
        pending={isCancelling}
        testIdPrefix="order-cancel"
      />
    </div>
  );
}
