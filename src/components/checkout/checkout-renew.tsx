'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCustomer } from '@/hooks/customer/useCustomer';
import type { CartItem } from '@/platform/services/model/cart/cart';
import type { CheckoutRenewal } from '@/platform/services/model/checkout';
import {
  type RenewPlan,
  SUBSCRIPTION_INTERVALS,
  type SubscriptionInterval,
} from '@/platform/services/subscription/subscription-rules';

interface CheckoutRenewProps {
  items: CartItem[];
  requiresApproval: boolean;
  onChange: (renewal: CheckoutRenewal | null, blocked: boolean) => void;
}

function linesOf(items: CartItem[]) {
  return items
    .map((item) => ({ productId: item.product?.id ?? '', quantity: item.quantity }))
    .filter((line) => line.productId && line.quantity > 0);
}

/**
 * "Renew this order" sits with the order total and expands into the cadence.
 * A locked digital or service cadence is shown and cannot be edited.
 */
export function CheckoutRenew({ items, requiresApproval, onChange }: CheckoutRenewProps) {
  const t = useTranslations('checkout.summary');
  const { customer } = useCustomer();
  const [enabled, setEnabled] = useState(false);
  const [every, setEvery] = useState(1);
  const [unit, setUnit] = useState<SubscriptionInterval>('months');
  const [result, setResult] = useState<{ key: string; plan: RenewPlan } | null>(null);
  const lineKey = linesOf(items)
    .map((line) => `${line.productId}:${line.quantity}`)
    .join('|');
  const requestKey = customer && !requiresApproval && enabled ? `${lineKey}#${every}#${unit}` : '';
  const plan = result?.key === requestKey ? result.plan : null;
  const loading = Boolean(requestKey) && !plan;
  const report = useEffectEvent((renewal: CheckoutRenewal | null, blocked: boolean) => onChange(renewal, blocked));
  const currentLines = useEffectEvent(() => linesOf(items));

  useEffect(() => {
    if (!requestKey) {
      report(null, false);
      return;
    }
    report(null, true);
    const controller = new AbortController();
    const settle = (next: RenewPlan) => {
      if (controller.signal.aborted) return;
      setResult({ key: requestKey, plan: next });
      report(next.ok ? { every: next.every, unit: next.unit } : null, !next.ok);
    };
    const timer = setTimeout(() => {
      fetch('/api/subscriptions/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: currentLines(), every, unit }),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('plan failed');
          return (await response.json()) as RenewPlan;
        })
        .then(settle)
        .catch(() => settle({ ok: false, issue: 'invalid-every' }));
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [requestKey, every, unit]);

  if (!customer) return null;

  const locked = plan?.ok === true && plan.locked;
  const issue = plan && !plan.ok ? plan.issue : null;

  return (
    <div className="border-t border-border-primary pt-4" data-testid="checkout-renew">
      <label className="flex items-start gap-3">
        <Checkbox
          checked={enabled}
          disabled={requiresApproval}
          onCheckedChange={(checked) => setEnabled(checked === true)}
          className="bg-surface-page mt-0.5"
          data-testid="checkout-renewOrder"
        />
        <span className="font-medium leading-6">{t('renewOrder')}</span>
      </label>
      {requiresApproval ? <p className="mt-2 text-sm text-text-placeholders">{t('renewApproval')}</p> : null}
      {enabled && !requiresApproval ? (
        <div className="mt-3 flex flex-col gap-3">
          {loading ? <p className="text-sm text-text-placeholders">{t('renewLoading')}</p> : null}
          {locked && plan?.ok ? (
            <p className="text-sm text-text-placeholders" data-testid="checkout-renewLocked">
              {t('renewLocked', { count: plan.every, unit: t(`unit.${plan.unit}`) })}
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                step={1}
                value={every}
                aria-label={t('renewEvery')}
                onChange={(event) => setEvery(Number(event.target.value))}
                className="w-24"
                data-testid="checkout-renewEvery"
              />
              <Select value={unit} onValueChange={(value) => setUnit(value as SubscriptionInterval)}>
                <SelectTrigger className="w-40" aria-label={t('renewUnit')} data-testid="checkout-renewUnit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBSCRIPTION_INTERVALS.map((value) => (
                    <SelectItem key={value} value={value} data-testid={`checkout-renewUnit-${value}`}>
                      {t(`unit.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {issue ? (
            <p className="text-sm text-text-error" role="alert" data-testid="checkout-renewIssue">
              {t(`renewIssue.${issue}`)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
