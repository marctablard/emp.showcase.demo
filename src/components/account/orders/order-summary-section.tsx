'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  AccountSpecTable,
  SpecFullWidthRow,
  SpecNoteRow,
  SpecRow,
  SpecSection,
} from '@/components/account/shared/account-spec-table';
import { AddressDisplay } from '@/components/common/address-display';
import UiLink from '@/components/ui/link';
import { type PaymentModeKey, dk } from '@/i18n/dynamic-key';
import { formatDate } from '@/lib/date-utils';
import type { Order } from '@/platform/services/model/order/order';

interface OrderSummarySectionProps {
  order: Order;
  siteName?: string | null;
}

function getCustomerName(order: Order): string | null {
  const customer = order.customer;
  if (!customer) return null;

  if (customer.name?.trim()) {
    return customer.name.trim();
  }

  const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  return fullName || null;
}

function getCustomerEmail(order: Order): string | null {
  return order.customerEmail?.trim() || order.customer?.email?.trim() || null;
}

function getShippingMethodLabel(order: Order, locale: string): string | null {
  const method = order.shipping?.methods?.[0];
  if (!method) return null;

  if (method.localizedName) {
    const localized =
      method.localizedName[locale] ||
      method.localizedName[locale.split('-')[0]] ||
      Object.values(method.localizedName).find(Boolean);
    if (localized) return localized;
  }

  return method.name || method.id || null;
}

function getItemCount(order: Order): number {
  return order.items.reduce((total, item) => total + item.quantity, 0);
}

export function OrderSummarySection({ order, siteName }: OrderSummarySectionProps) {
  const tOrder = useTranslations('orders');
  const tPaymentModes = useTranslations('checkout.PaymentModes');
  const locale = useLocale();

  const customerName = getCustomerName(order);
  const customerEmail = getCustomerEmail(order);
  const shippingMethod = getShippingMethodLabel(order, locale);
  const itemCount = getItemCount(order);
  const payment = order.payments?.[0];
  const showLastUpdated =
    order.lastStatusChange &&
    order.createdAt &&
    new Date(order.lastStatusChange).getTime() !== new Date(order.createdAt).getTime();

  return (
    <AccountSpecTable>
      <SpecSection title={tOrder('orderInformation')}>
        <SpecRow
          left={{
            label: tOrder('orderDate'),
            value: order.createdAt ? formatDate(order.createdAt, locale) : '-',
          }}
          right={{
            label: tOrder('lastUpdated'),
            value: showLastUpdated && order.lastStatusChange ? formatDate(order.lastStatusChange, locale) : '-',
          }}
        />
        <SpecRow
          left={{
            label: tOrder('columns.channel'),
            value: siteName || '-',
          }}
          right={{
            label: tOrder('numberOfItems'),
            value: itemCount,
          }}
        />
        {order.quoteId ? (
          <SpecRow
            left={{
              label: tOrder('relatedQuote'),
              value: (
                <UiLink
                  href={`/account/quotes/${order.quoteId}`}
                  type="Link"
                  variant="primary"
                  size="m"
                  data-testid="order-relatedQuote"
                >
                  #{order.quoteId}
                </UiLink>
              ),
            }}
          />
        ) : null}
      </SpecSection>

      <SpecSection title={tOrder('contactAndPayment')}>
        <SpecRow
          left={{
            label: tOrder('columns.customer'),
            value: customerName || '-',
          }}
          right={{
            label: tOrder('email'),
            value: customerEmail || '-',
          }}
        />
        <SpecRow
          left={{
            label: tOrder('paymentMethod'),
            value: payment ? tPaymentModes(dk<PaymentModeKey>(payment.method.toLowerCase())) : '-',
          }}
          right={{
            label: tOrder('paymentStatus'),
            value: payment?.status || '-',
          }}
        />
      </SpecSection>

      <SpecSection title={tOrder('shipping')}>
        <SpecRow
          left={{
            label: tOrder('shippingMethod'),
            value: shippingMethod || tOrder('shippingMethodUnknown'),
          }}
          right={
            order.expectedDeliveryDate
              ? { label: tOrder('deliveryDate'), value: formatDate(order.expectedDeliveryDate, locale) }
              : undefined
          }
        />
        <SpecFullWidthRow label={tOrder('shippingAddress')}>
          {order.shippingAddress ? (
            <AddressDisplay address={order.shippingAddress} className="[&_svg]:hidden" />
          ) : (
            <span className="text-text-placeholders">{tOrder('notProvided')}</span>
          )}
        </SpecFullWidthRow>
      </SpecSection>

      <SpecSection title={tOrder('billingAddress')}>
        <SpecFullWidthRow label={tOrder('billingAddress')}>
          {order.billingAddress ? (
            <AddressDisplay address={order.billingAddress} className="[&_svg]:hidden" />
          ) : (
            <span className="text-text-placeholders">{tOrder('notProvided')}</span>
          )}
        </SpecFullWidthRow>
      </SpecSection>

      {order.customerNote?.trim() ? (
        <SpecNoteRow title={tOrder('customerNote')}>{order.customerNote}</SpecNoteRow>
      ) : null}
    </AccountSpecTable>
  );
}
