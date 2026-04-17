'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ClipboardList, Hash, Layers, Package, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createServiceCockpitTicket } from '@/lib/client/serviceCockpitTickets';

const TICKET_TYPE_VALUE = 'product_ordering_issue';

export interface ServiceCockpitTicketDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  productId: string;
  productName: string;
  quantity: number;
}

export function ServiceCockpitTicketDialog({
  open,
  onOpenChange,
  productId,
  productName,
  quantity,
}: ServiceCockpitTicketDialogProps) {
  const t = useTranslations('cart');
  const [subject, setSubject] = useState('');
  const [summary, setSummary] = useState('');
  const [businessImpact, setBusinessImpact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const prevOpenRef = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    if (open === true && prevOpenRef.current !== true) {
      setSubject('');
      setSummary('');
      setBusinessImpact('');
      setError('');
    }
    prevOpenRef.current = open;
  }, [open]);

  const handleSubmit = async () => {
    if (!subject.trim()) {
      setError(t('substitution.serviceCockpitTicket.validation.subjectRequired'));
      return;
    }
    if (!summary.trim()) {
      setError(t('substitution.serviceCockpitTicket.validation.summaryRequired'));
      return;
    }
    if (!businessImpact.trim()) {
      setError(t('substitution.serviceCockpitTicket.validation.businessImpactRequired'));
      return;
    }
    if (!productId || !Number.isFinite(quantity) || quantity < 1) {
      setError(t('substitution.serviceCockpitTicket.validation.cartContextRequired'));
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await createServiceCockpitTicket({
        subject: subject.trim(),
        summary: summary.trim(),
        businessImpact: businessImpact.trim(),
        productId,
        quantity: Math.floor(quantity),
      });
      onOpenChange?.(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('substitution.serviceCockpitTicket.errors.submitFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>{t('substitution.serviceCockpitTicket.title')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 py-1">
          {error ? <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">{error}</div> : null}

          <section className="rounded-ss-md rounded-ee-md border border-border-primary bg-bg-surface overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border-subtle bg-surface-action-hover-2 px-4 py-2.5">
              <ClipboardList className="size-4 shrink-0 text-icon-secondary" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-wider text-text-placeholders">
                {t('substitution.serviceCockpitTicket.contextSectionTitle')}
              </p>
            </div>

            <div className="p-4 grid gap-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-text-placeholders">
                  <Tag className="size-3.5 shrink-0 text-icon-secondary" aria-hidden />
                  {t('substitution.serviceCockpitTicket.type')}
                </div>
                <Badge variant="default" rounded="default" className="font-mono text-xs font-normal normal-case">
                  {TICKET_TYPE_VALUE}
                </Badge>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-medium text-text-placeholders">
                  <Package className="size-3.5 shrink-0 text-icon-secondary" aria-hidden />
                  {t('substitution.serviceCockpitTicket.contextProduct')}
                </div>
                <p className="text-base font-semibold text-text-heading leading-snug">
                  {productName || productId || '—'}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 sm:gap-0 sm:divide-x sm:divide-border-subtle">
                <div className="space-y-1.5 sm:pe-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-text-placeholders">
                    <Hash className="size-3.5 shrink-0 text-icon-secondary" aria-hidden />
                    {t('substitution.serviceCockpitTicket.contextProductId')}
                  </div>
                  <p className="font-mono text-sm text-text-heading break-all">{productId || '—'}</p>
                </div>
                <div className="space-y-1.5 sm:ps-4 sm:border-t-0 border-t border-border-subtle pt-4 sm:pt-0">
                  <div className="flex items-center gap-2 text-xs font-medium text-text-placeholders">
                    <Layers className="size-3.5 shrink-0 text-icon-secondary" aria-hidden />
                    {t('substitution.serviceCockpitTicket.contextQuantity')}
                  </div>
                  <p className="text-lg font-semibold tabular-nums text-text-heading">
                    {Number.isFinite(quantity) ? Math.floor(quantity) : '—'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-2">
            <label htmlFor="scct-subject" className="text-sm font-medium">
              {t('substitution.serviceCockpitTicket.subject')} *
            </label>
            <Input
              id="scct-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={500}
              placeholder={t('substitution.serviceCockpitTicket.subjectPlaceholder')}
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="scct-summary" className="text-sm font-medium">
              {t('substitution.serviceCockpitTicket.summary')} *
            </label>
            <Textarea
              id="scct-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={4000}
              rows={4}
              placeholder={t('substitution.serviceCockpitTicket.summaryPlaceholder')}
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="scct-impact" className="text-sm font-medium">
              {t('substitution.serviceCockpitTicket.businessImpact')} *
            </label>
            <Input
              id="scct-impact"
              value={businessImpact}
              onChange={(e) => setBusinessImpact(e.target.value)}
              maxLength={500}
              placeholder={t('substitution.serviceCockpitTicket.businessImpactPlaceholder')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? t('substitution.serviceCockpitTicket.sending')
              : t('substitution.serviceCockpitTicket.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
