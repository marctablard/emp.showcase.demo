'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { BadgePercent, Ban, Package, RotateCcw, ShoppingCart, Truck } from 'lucide-react';
import {
  AccountDetailContainer,
  AccountDetailHeader,
  AccountDetailStatus,
  AccountSectionBar,
  AccountSectionLabel,
} from '@/components/account/shared/account-detail';
import {
  type DetailTaxLineInput,
  detailTaxRateSuffix,
  shouldDisplayTaxLine,
} from '@/components/account/shared/detail-tax-line';
import { formatShippingFeeDisplay } from '@/components/account/shared/format-shipping-fee';
import { coalesceBrandLabel, resolveProductBrandLabel } from '@/components/product/resolve-product-brand';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import UiLink from '@/components/ui/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TruncatedText } from '@/components/ui/truncated-text';
import { useCart } from '@/hooks/cart/useCart';
import { useOrder } from '@/hooks/order/useOrder';
import { useProducts } from '@/hooks/product/useProducts';
import { useSite } from '@/hooks/site/useSite';
import { useL10n } from '@/hooks/useL10n';
import { useRouter } from '@/i18n/navigation';
import { isOrderAccessDeniedError } from '@/lib/client/orders';
import { fetchReturnsForOrder } from '@/lib/client/returns';
import { isFreeShippingPromo, shopperFacingOrderPromos } from '@/lib/common/applied-promo-display';
import { ORDER_CUSTOMER_DECLINE_NOT_ALLOWED_MESSAGE } from '@/lib/common/order-customer-decline-not-allowed';
import { type OrderOverviewSummaryBreakdown, buildOrderOverviewBreakdown } from '@/lib/common/order-overview-summary';
import { canReorder } from '@/lib/common/orders/reorder';
import { type OrderReturnability, computeOrderReturnability } from '@/lib/common/returns/returnability';
import { getLogger } from '@/lib/logger/use-logger-client';
import { formatCurrency } from '@/lib/utils';
import type { Order, OrderDiscount, OrderItem, OrderStatus } from '@/platform/services/model/order/order';
import { ORDER_STATUS } from '@/platform/services/model/order/order-status';
import type { Product } from '@/platform/services/model/product';
import { CreateReturnDialog } from './create-return-dialog';
import { OrderStatusBadge } from './order-status-badge';
import { OrderSummarySection } from './order-summary-section';
import { ReorderDialog } from './reorder-dialog';
import { TrackingDialog } from './tracking-dialog';

function shouldShowCancelButton(status: OrderStatus, transitions: string[]): boolean {
  return status === ORDER_STATUS.CREATED && transitions.includes('DECLINED');
}

function shouldShowReturnButton(status: OrderStatus): boolean {
  return status === ORDER_STATUS.COMPLETED;
}

function shouldShowTrackingButton(status: OrderStatus): boolean {
  return (
    [
      ORDER_STATUS.PROCESSING,
      ORDER_STATUS.READY_FOR_SHIPPING,
      ORDER_STATUS.READY_FOR_PICKUP,
      ORDER_STATUS.SHIPPED,
      ORDER_STATUS.DELIVERED,
      ORDER_STATUS.COMPLETED,
    ] as OrderStatus[]
  ).includes(status);
}

function formatOverviewAmount(amount: number, currency: string): string {
  return `${amount} ${currency}`;
}

function formatOverviewSignedAmount(amount: number, currency: string): string {
  return `-${Math.abs(amount)} ${currency}`;
}

function OrderAppliedPromoList({ discounts }: { readonly discounts: OrderDiscount[] }) {
  const tOrder = useTranslations('orders');
  const visible = shopperFacingOrderPromos(discounts);
  if (visible.length === 0) {
    return null;
  }
  return (
    <ul className="flex w-full min-w-0 flex-col gap-3 border border-border-success bg-surface-success px-4 py-2">
      {visible.map((discount, index) => (
        <li
          key={`${discount.code}-${index}`}
          className="flex w-full min-w-0 flex-col gap-0.5"
          data-testid={`order-appliedPromo-${discount.code}`}
        >
          <div className="flex min-w-0 items-center gap-1">
            <BadgePercent className="size-[18px] shrink-0 text-icon-success" aria-hidden />
            <TruncatedText text={discount.code} className="text-sm leading-5 text-text-body" />
          </div>
          <div className="flex min-w-0 items-center justify-between gap-2 text-sm leading-5 text-text-body">
            {discount.description ? (
              <TruncatedText text={discount.description} className="font-normal text-sm leading-5 text-text-body" />
            ) : (
              <span />
            )}
            <p
              className="shrink-0 text-right text-sm font-normal leading-5"
              data-testid={`order-appliedPromoAmount-${discount.code}`}
            >
              {isFreeShippingPromo(discount)
                ? tOrder('promoFreeShipping')
                : formatOverviewSignedAmount(discount.value, discount.currency)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function OrderSavingsBadge({ amount, currency }: { readonly amount: number; readonly currency: string }) {
  const tOrder = useTranslations('orders');
  return (
    <div className="flex justify-end">
      <div className="bg-surface-success px-2 py-1 text-sm leading-5 text-text-body" data-testid="order-yourSavings">
        <span>{tOrder('yourSavings')} </span>
        <span className="font-bold">{formatOverviewSignedAmount(amount, currency)}</span>
      </div>
    </div>
  );
}

type OrderOverviewGoodsTotalsProps = {
  breakdown: OrderOverviewSummaryBreakdown;
  isGrossApplied: boolean;
  hasAppliedCoupons: boolean;
  goodsDiscounted: boolean;
  currency: string;
  fallbackGross: number;
  showGoodsVat: boolean;
  goodsVatAmount: number;
  goodsTaxInput: DetailTaxLineInput;
};

function OrderOverviewGoodsTotals(props: Readonly<OrderOverviewGoodsTotalsProps>) {
  const tOrder = useTranslations('orders');
  const tCommon = useTranslations('common');
  const {
    breakdown,
    isGrossApplied,
    hasAppliedCoupons,
    goodsDiscounted,
    currency,
    fallbackGross,
    showGoodsVat,
    goodsVatAmount,
    goodsTaxInput,
  } = props;
  const savingsBadge =
    typeof breakdown.savingsTotal === 'number' && breakdown.savingsTotal > 0 ? (
      <OrderSavingsBadge amount={breakdown.savingsTotal} currency={currency} />
    ) : null;

  if (isGrossApplied) {
    return (
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
              {formatOverviewAmount(breakdown.originalGoodsGross ?? fallbackGross, currency)}
            </span>
          </div>
          {savingsBadge}
          {typeof breakdown.goodsDiscountedGross === 'number' ? (
            <div className="flex justify-between gap-4" data-testid="order-grossValueOfGoods">
              <span>{tOrder('grossValueOfGoods')}</span>
              <span className="font-bold">{formatOverviewAmount(breakdown.goodsDiscountedGross, currency)}</span>
            </div>
          ) : null}
        </div>
      </>
    );
  }

  if (hasAppliedCoupons && goodsDiscounted) {
    return (
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
  }

  const showPlainSavings = hasAppliedCoupons && breakdown.shippingFree !== true;
  return (
    <>
      <div
        className={
          hasAppliedCoupons
            ? 'flex justify-between items-start gap-4'
            : 'flex justify-between items-start gap-4 border-b border-border-primary pb-4'
        }
      >
        <span>{tOrder('netValueOfGoods')}</span>
        <span className="text-right font-normal">{formatOverviewAmount(breakdown.goodsNet, currency)}</span>
      </div>
      {showPlainSavings ? savingsBadge : null}
    </>
  );
}

function isOrderOverviewGrossApplied(breakdown: OrderOverviewSummaryBreakdown): boolean {
  return (
    breakdown.hasAppliedCoupons === true &&
    breakdown.couponApplyBasis === 'gross' &&
    breakdown.goodsDiscounted !== false
  );
}

function overviewGoodsVatFields(
  breakdown: OrderOverviewSummaryBreakdown,
  isGrossApplied: boolean,
  taxRate: number | undefined,
): { input: DetailTaxLineInput; amount: number } {
  if (isGrossApplied) {
    const amount = breakdown.originalGoodsVat ?? 0;
    return {
      input: {
        taxRate,
        taxAmount: amount,
        netAmount: breakdown.originalGoodsNet ?? breakdown.goodsNet,
      },
      amount,
    };
  }
  return {
    input: {
      taxRate,
      taxAmount: breakdown.goodsVat,
      netAmount: breakdown.goodsNet,
    },
    amount: breakdown.goodsVat,
  };
}

function hasOverviewPromoList(discounts: OrderOverviewSummaryBreakdown['discounts']): boolean {
  return (discounts?.length ?? 0) > 0;
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
  const goodsDiscounted = breakdown.goodsDiscounted !== false;
  const isGrossApplied = isOrderOverviewGrossApplied(breakdown);
  const goodsVat = overviewGoodsVatFields(breakdown, isGrossApplied, order.price.subtotal.taxRate);
  const showGoodsVat = shouldDisplayTaxLine(goodsVat.input);

  return (
    <div className="space-y-2 text-sm text-text-body">
      {hasOverviewPromoList(breakdown.discounts) ? (
        <OrderAppliedPromoList discounts={breakdown.discounts ?? []} />
      ) : null}
      <OrderOverviewGoodsTotals
        breakdown={breakdown}
        isGrossApplied={isGrossApplied}
        hasAppliedCoupons={hasAppliedCoupons}
        goodsDiscounted={goodsDiscounted}
        currency={currency}
        fallbackGross={order.price.subtotal.gross}
        showGoodsVat={showGoodsVat}
        goodsVatAmount={goodsVat.amount}
        goodsTaxInput={goodsVat.input}
      />
      <OrderOverviewNetGoodsVat
        show={!isGrossApplied && showGoodsVat}
        goodsTaxInput={goodsVat.input}
        amount={goodsVat.amount}
        currency={currency}
        taxLabel={tCommon('tax')}
      />
      <OrderOverviewShippingRows order={order} breakdown={breakdown} shippingLabel={tOrder('shippingFee')} />
      <div className="flex items-start justify-between gap-4 border-t border-border-primary pt-3 font-bold text-text-headings">
        <span>{tOrder('totalValue')}</span>
        <span className="tabular-nums" data-testid="order-totalValue">
          {formatOverviewAmount(breakdown.total, order.price.total.currency)}
        </span>
      </div>
    </div>
  );
}

function OrderOverviewNetGoodsVat(props: {
  readonly show: boolean;
  readonly goodsTaxInput: DetailTaxLineInput;
  readonly amount: number;
  readonly currency: string;
  readonly taxLabel: string;
}) {
  if (!props.show) {
    return null;
  }
  return (
    <div className="flex justify-between gap-4 pt-2">
      <span>
        {props.taxLabel}
        {detailTaxRateSuffix(props.goodsTaxInput)}
      </span>
      <span>{formatOverviewAmount(props.amount, props.currency)}</span>
    </div>
  );
}

function OrderShippingFeeValue(props: {
  readonly listFee: number | undefined;
  readonly discounted: number;
  readonly currency: string;
  readonly freeLabel: string;
}) {
  const discountedLabel = formatShippingFeeDisplay(
    props.discounted,
    (amount) => formatOverviewAmount(amount, props.currency),
    props.freeLabel,
  );
  if (typeof props.listFee !== 'number') {
    return <span>{discountedLabel}</span>;
  }
  return (
    <span className="flex items-baseline justify-end gap-2" data-testid="order-shippingFeeCompare">
      <span className="line-through">{formatOverviewAmount(props.listFee, props.currency)}</span>
      <span className="font-bold">{discountedLabel}</span>
    </span>
  );
}

function OrderOverviewShippingRows(props: {
  readonly order: Order;
  readonly breakdown: OrderOverviewSummaryBreakdown;
  readonly shippingLabel: string;
}) {
  const tOrder = useTranslations('orders');
  const { order, breakdown } = props;
  const shipping = order.shipping;
  if (!shipping) {
    return null;
  }
  const shippingTax = shipping.total.tax;
  const shippingCurrency = shipping.total.currency;
  return (
    <>
      <div className="flex justify-between gap-4 pt-2">
        <span>{props.shippingLabel}</span>
        <OrderShippingFeeValue
          listFee={breakdown.shippingListFee}
          discounted={shipping.total.value}
          currency={shippingCurrency}
          freeLabel={tOrder('free')}
        />
      </div>
      {breakdown.showShippingVat && typeof shippingTax === 'number' ? (
        <div className="flex justify-between gap-4 pt-2">
          <span>
            {tOrder('shippingVat')}
            {detailTaxRateSuffix({
              taxRate: shipping.total.taxRate,
              taxAmount: shippingTax,
            })}
          </span>
          <span>{formatOverviewAmount(shippingTax, shippingCurrency)}</span>
        </div>
      ) : null}
    </>
  );
}

function OrderItemRow({
  item,
  catalogProduct,
  locale,
  onNavigate,
}: {
  item: OrderItem;
  catalogProduct?: Product;
  locale: string;
  onNavigate: (productId: string) => void;
}) {
  const tCart = useTranslations('cart');
  const { l10n } = useL10n();
  const imageUrl = item.images?.[0] ?? catalogProduct?.images?.[0]?.url;
  const name = item.name || l10n(catalogProduct?.name ?? '') || item.productId;
  const brand = coalesceBrandLabel(item.vendorName, resolveProductBrandLabel(catalogProduct, l10n));
  const currency = item.price?.currency;
  const netUnitPrice = item.price?.netValue ?? item.price?.value;
  const grossUnitPrice = item.price?.netValue === undefined ? undefined : item.price?.grossValue;

  return (
    <TableRow
      className="cursor-pointer hover:bg-surface-image-background"
      onClick={() => onNavigate(item.productId)}
      data-testid={`order-item-${item.id}`}
    >
      <TableCell className="w-[88px] py-4 pl-6 pr-3 align-middle sm:pl-8">
        <div className="flex h-[52px] w-20 items-center justify-center border border-border-primary bg-surface-image-background">
          {imageUrl ? (
            <Image src={imageUrl} alt={name} width={80} height={52} className="h-full w-full object-contain" />
          ) : (
            <Package className="h-5 w-5 text-icon-secondary opacity-40" aria-hidden="true" />
          )}
        </div>
      </TableCell>
      <TableCell className="px-4 py-4 align-middle">
        {brand ? <p className="text-xs text-text-placeholders">{brand}</p> : null}
        <p className="text-sm font-bold text-text-headings" onClick={(event) => event.stopPropagation()}>
          <UiLink type="Link" href={`/product/${item.productId}`} variant="text">
            {name}
          </UiLink>
        </p>
        {item.sku ? <p className="mt-0.5 text-xs text-text-placeholders">SKU: {item.sku}</p> : null}
      </TableCell>
      <TableCell className="px-4 py-4 text-center align-middle text-sm font-medium tabular-nums">
        {item.quantity}
      </TableCell>
      <TableCell className="py-4 pl-4 pr-6 text-right align-middle tabular-nums sm:pr-8">
        <p className="text-sm font-bold">
          {netUnitPrice === undefined ? '-' : formatCurrency(netUnitPrice, currency, locale)}
        </p>
        {grossUnitPrice === undefined ? null : (
          <p className="text-xs text-text-placeholders">
            {tCart('gross').trim()} {formatCurrency(grossUnitPrice, currency, locale)}
          </p>
        )}
      </TableCell>
    </TableRow>
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
  const locale = useLocale();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnability, setReturnability] = useState<OrderReturnability | null>(null);
  const [reorderDialogOpen, setReorderDialogOpen] = useState(false);
  const router = useRouter();
  const { addItem } = useCart();
  const { availableSites } = useSite();

  const { order, loading, error, cancelOrder, statusTransitions } = useOrder({ orderId, initialOrder });
  const productIds = useMemo(() => order?.items.map((item) => item.productId).filter(Boolean) ?? [], [order]);
  const { products } = useProducts(productIds);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const orderErrorMessage =
    error && isOrderAccessDeniedError(error) ? tOrder('orderAccessDenied') : tOrder('errorFetchingOrder');

  const siteName = useMemo(() => {
    if (!order?.siteCode) return null;
    return availableSites?.find((site) => site.code === order.siteCode)?.name ?? order.siteCode;
  }, [availableSites, order]);

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

  const handleReorder = useCallback(() => {
    if (!order || !canReorder(order)) {
      return;
    }
    setReorderDialogOpen(true);
  }, [order]);

  if (loading) {
    return (
      <div className="border border-border-primary bg-surface-page p-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-4 h-5 w-40" />
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="border border-border-primary bg-surface-page p-6 text-center">
        <p className="text-text-error">{orderErrorMessage}</p>
      </div>
    );
  }

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

  const showActions =
    canReorder(order) ||
    shouldShowCancelButton(order.status, statusTransitions) ||
    shouldShowReturnButton(order.status) ||
    shouldShowTrackingButton(order.status);

  return (
    <AccountDetailContainer>
      <AccountDetailHeader
        eyebrow={tOrder('orderDetails')}
        title={`#${order.id}`}
        aside={
          <AccountDetailStatus label={tOrder('columns.status')}>
            <OrderStatusBadge status={order.status} emphasized />
          </AccountDetailStatus>
        }
      />

      <div className="border-b border-border-primary">
        <OrderSummarySection order={order} siteName={siteName} />
      </div>

      <section className="border-b border-border-primary">
        <AccountSectionBar>{tOrder('orderItems')}</AccountSectionBar>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[88px] py-4 pl-6 pr-3 font-bold sm:pl-8">{tOrder('product')}</TableHead>
              <TableHead className="px-4 py-4 font-bold" />
              <TableHead className="w-28 px-4 py-4 text-center font-bold">{tOrder('quantity')}</TableHead>
              <TableHead className="w-36 py-4 pl-4 pr-6 text-right font-bold sm:pr-8">{tOrder('price')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((item) => (
              <OrderItemRow
                key={item.id}
                item={item}
                catalogProduct={productById.get(item.productId)}
                locale={locale}
                onNavigate={(productId) => router.push(`/product/${productId}`)}
              />
            ))}
          </TableBody>
        </Table>

        <div className="border-t border-border-primary px-6 py-6 sm:px-8">
          <div className="ml-auto w-full max-w-sm" data-testid="order-overview-totals">
            <OrderOverviewTotals order={order} />
          </div>
        </div>
      </section>

      {showActions ? (
        <footer className="px-6 py-6 sm:px-8" data-testid="order-detail-header-actions">
          <AccountSectionLabel className="mb-3">{tOrder('orderActions')}</AccountSectionLabel>
          <div className="flex flex-wrap gap-2">
            {canReorder(order) ? (
              <Button variant="secondary" size="small" onClick={handleReorder} data-testid="order-reorderButton">
                <ShoppingCart className="mr-2 h-4 w-4" />
                {tOrder('reorderLink')}
              </Button>
            ) : (
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <span>
                    <Button variant="secondary" size="small" disabled>
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      {tOrder('reorderLink')}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="w-[22rem] max-w-[calc(100vw-2rem)] text-wrap">
                  {tOrder('reorderDisabledTooltip')}
                </TooltipContent>
              </Tooltip>
            )}

            {shouldShowCancelButton(order.status, statusTransitions) && cancelOrder ? (
              <Button
                variant="secondary"
                size="small"
                onClick={() => setCancelDialogOpen(true)}
                data-testid="order-cancelButton"
              >
                <Ban className="mr-2 h-4 w-4" />
                {tOrder('cancelOrder')}
              </Button>
            ) : null}

            {shouldShowReturnButton(order.status) ? (
              returnability?.hasAnyReturnableItem === false ? (
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <span>
                      <Button variant="secondary" size="small" disabled data-testid="order-returnButton">
                        <RotateCcw className="mr-2 h-4 w-4" />
                        {tOrder('returnOrder')}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="w-[22rem] max-w-[calc(100vw-2rem)] text-wrap">
                    {tOrder('noRemainingItems')}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => setReturnDialogOpen(true)}
                  data-testid="order-returnButton"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {tOrder('returnOrder')}
                </Button>
              )
            ) : null}

            {shouldShowTrackingButton(order.status) ? (
              <Button
                variant="secondary"
                size="small"
                onClick={() => setTrackingDialogOpen(true)}
                data-testid="order-trackShipmentButton"
              >
                <Truck className="mr-2 h-4 w-4" />
                {tOrder('trackOrder')}
              </Button>
            ) : null}
          </div>
        </footer>
      ) : null}

      <TrackingDialog orderId={orderId} open={trackingDialogOpen} onOpenChange={setTrackingDialogOpen} />

      <CreateReturnDialog
        order={order}
        open={returnDialogOpen}
        onOpenChange={setReturnDialogOpen}
        returnability={returnability ?? undefined}
      />

      <ReorderDialog order={order} open={reorderDialogOpen} onOpenChange={setReorderDialogOpen} addItem={addItem} />

      <ConfirmationDialog
        open={cancelDialogOpen}
        onOpenChange={handleCancelDialogOpenChange}
        title={tOrder('cancelOrderConfirmTitle')}
        description={tOrder('cancelOrderConfirmDescription')}
        cancelLabel={tOrder('keepOrder')}
        confirmLabel={tOrder('cancelOrderConfirm')}
        onCancel={handleDismissCancelDialog}
        onConfirm={() => void handleConfirmCancelOrder()}
        pending={isCancelling}
        testIdPrefix="order-cancel"
      />
    </AccountDetailContainer>
  );
}
