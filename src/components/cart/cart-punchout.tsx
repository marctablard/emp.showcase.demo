'use client';

import { useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePunchoutSession } from '@/hooks/punchout/usePunchoutSession';
import { useL10n } from '@/hooks/useL10n';
import { fetchProductById } from '@/lib/client/products';
import { buildPunchOutOrderMessage } from '@/platform/integrations/punchout/punchout-order-message';
import type { Cart } from '@/platform/services/model/cart/cart';
import { mapCartToPunchoutLines } from '@/platform/services/model/punchout/map-cart-to-punchout-lines';

interface CartPunchoutProps {
  cart: Cart;
}

export function CartPunchout({ cart }: CartPunchoutProps) {
  const t = useTranslations('cart.punchout');
  const locale = useLocale();
  const { l10n } = useL10n();
  const { session, loading, error } = usePunchoutSession();
  const formRef = useRef<HTMLFormElement>(null);
  const cxmlFieldRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (loading || error || !session) {
    return null;
  }

  const { formData } = session;
  const currency = formData.Currency || cart.currency;

  const handleSubmit = async () => {
    setSubmitError(null);

    if (!cart.items.length) {
      setSubmitError(t('emptyCart'));
      return;
    }

    setSubmitting(true);

    try {
      const productIds = [
        ...new Set(cart.items.map((item) => item.product?.id).filter((id): id is string => Boolean(id))),
      ];
      const products = await Promise.all(productIds.map((id) => fetchProductById(id)));
      const unspscByProductId: Record<string, string> = {};
      for (const product of products) {
        const unspsc = product?.punchout?.classification?.unspsc?.trim();
        if (product?.id && unspsc) {
          unspscByProductId[product.id] = unspsc;
        }
      }

      const lines = mapCartToPunchoutLines(cart, locale, unspscByProductId);
      const cxml = buildPunchOutOrderMessage({
        buyerCookie: formData.buyercookie!,
        currency,
        from: { domain: 'DUNS', identity: formData.FromDUNSbuyer || '' },
        to: { domain: 'DUNS', identity: formData.toDUNSsupplier || '' },
        sender: {
          domain: 'DUNS',
          identity: formData.SenderDUNS || '',
          sharedSecret: session.token || '',
          userAgent: 'Emporix Storefront/1.0',
        },
        operationAllowed: formData.operationAllowed || 'edit',
        items: lines.map((line) => ({
          sku: line.sku,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          unitOfMeasure: line.unitOfMeasure,
          classificationDomain: 'UNSPSC',
          classificationCode: line.classificationCode,
          manufacturerName: line.manufacturerName,
          language: line.language,
          currency: line.currency,
        })),
      });

      if (!cxmlFieldRef.current || !formRef.current) {
        throw new Error('Punchout form is not ready');
      }

      cxmlFieldRef.current.value = cxml;
      formRef.current.submit();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const formTarget = formData.formpostframe === 'top' ? '_top' : undefined;

  return (
    <Card className="bg-surface-action-hover-2 p-6 border-none gap-4 shadow-sm text-text-heading">
      <div className="flex gap-2 items-center">
        <Send />
        <span className="font-headlines">{t('title')}</span>
      </div>
      <p className="text-base">{t('description')}</p>
      {session.name && <p className="text-sm text-text-on-disabled">{l10n(session.name)}</p>}
      <Button
        className="w-full"
        variant="secondary"
        disabled={submitting || !cart.items.length}
        onClick={handleSubmit}
        data-testid="cart-sendToProcurement"
      >
        {submitting ? t('submitting') : t('button')}
      </Button>
      {submitError && <p className="text-sm text-text-error">{submitError}</p>}

      <form
        ref={formRef}
        id="punchoutReturn"
        method="POST"
        action={formData.formposturl}
        target={formTarget}
        encType="application/x-www-form-urlencoded"
        className="hidden"
        aria-hidden="true"
      >
        <input ref={cxmlFieldRef} type="hidden" name="cxml-urlencoded" defaultValue="" />
      </form>
    </Card>
  );
}
