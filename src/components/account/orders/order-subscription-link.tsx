'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SpecRow } from '@/components/account/shared/account-spec-table';
import UiLink from '@/components/ui/link';
import { fetchOrderSubscriptionLinks } from '@/lib/client/subscriptions';
import { shortenId } from '../shared/account-list';

export function useOrderSubscriptionLinks(orderIds: string[]): Record<string, string> {
  const key = orderIds.filter(Boolean).join(',');
  const [links, setLinks] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    fetchOrderSubscriptionLinks(key.split(','))
      .then((next) => {
        if (!cancelled) setLinks(next);
      })
      .catch(() => {
        if (!cancelled) setLinks({});
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return links;
}

export function OrderSubscriptionRow({ orderId }: { orderId: string }) {
  const t = useTranslations('orders');
  const links = useOrderSubscriptionLinks([orderId]);
  const subscriptionId = links[orderId];
  if (!subscriptionId) return null;
  return (
    <SpecRow
      left={{
        label: t('relatedSubscription'),
        value: (
          <UiLink
            type="Link"
            href={`/account/subscriptions/${subscriptionId}`}
            variant="primary"
            size="m"
            data-testid="order-relatedSubscription"
          >
            {shortenId(subscriptionId)}
          </UiLink>
        ),
      }}
    />
  );
}

export function OrderSubscriptionLink({ orderId }: { orderId: string }) {
  const t = useTranslations('orders');
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOrderSubscriptionLinks([orderId])
      .then((links) => {
        if (!cancelled) setSubscriptionId(links[orderId] ?? null);
      })
      .catch(() => {
        if (!cancelled) setSubscriptionId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (!subscriptionId) return null;

  return (
    <div className="mt-1 text-sm text-text-placeholders">
      {t('relatedSubscription')}{' '}
      <span title={subscriptionId}>
        <UiLink
          type="Link"
          href={`/account/subscriptions/${subscriptionId}`}
          variant="text"
          data-testid={`order-subscription-${orderId}`}
        >
          {shortenId(subscriptionId)}
        </UiLink>
      </span>
    </div>
  );
}
