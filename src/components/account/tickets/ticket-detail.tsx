'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, LifeBuoy, RotateCcw, Star, User } from 'lucide-react';
import {
  AccountDetailContainer,
  AccountDetailHeader,
  AccountDetailStatus,
  AccountSectionBar,
} from '@/components/account/shared/account-detail';
import {
  AccountSpecTable,
  SpecFullWidthRow,
  SpecNoteRow,
  SpecRow,
} from '@/components/account/shared/account-spec-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { type ServiceTicketPriorityKey, dk } from '@/i18n/dynamic-key';
import { Link, useRouter } from '@/i18n/navigation';
import { reopenServiceTicket, replyToServiceTicket, submitServiceTicketFeedback } from '@/lib/client/servicetickets';
import { cn } from '@/lib/utils';
import type { ServiceTicket } from '@/platform/services/model/serviceticket';
import { formatTicketDate, getPriorityBadgeVariant, isElevatedPriority } from './helpers';
import { SanitizedHtml } from './sanitized-html';
import { TicketStatusBadge } from './ticket-status-badge';

interface TicketDetailProps {
  ticket: ServiceTicket;
}

export function TicketDetail({ ticket }: TicketDetailProps) {
  const t = useTranslations('account.serviceTickets');
  const locale = useLocale();
  const router = useRouter();

  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [ratingScore, setRatingScore] = useState(ticket.feedback?.score ?? 0);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const canShowFeedback = ticket.isTerminal || ticket.statusId === 'solution_provided';
  const hasFeedback = (ticket.feedback?.score ?? 0) > 0;

  const handleReply = async () => {
    if (reply.trim() === '') {
      return;
    }
    setSending(true);
    try {
      await replyToServiceTicket(ticket.id, reply.trim());
      setReply('');
      notify({ title: t('detail.replySent'), type: ToastType.Success });
      router.refresh();
    } catch (error) {
      notify({
        title: t('detail.replyError'),
        description: error instanceof Error ? error.message : undefined,
        type: ToastType.Error,
      });
    } finally {
      setSending(false);
    }
  };

  const handleReopen = async () => {
    setReopening(true);
    try {
      await reopenServiceTicket(ticket.id);
      notify({ title: t('detail.reopened'), type: ToastType.Success });
      router.refresh();
    } catch (error) {
      notify({
        title: t('detail.reopenError'),
        description: error instanceof Error ? error.message : undefined,
        type: ToastType.Error,
      });
    } finally {
      setReopening(false);
    }
  };

  const handleSubmitFeedback = async (score: number) => {
    setRatingScore(score);
    setSubmittingFeedback(true);
    try {
      await submitServiceTicketFeedback(ticket.id, score);
      notify({ title: t('detail.feedbackThanks'), type: ToastType.Success });
      router.refresh();
    } catch (error) {
      notify({
        title: t('detail.feedbackError'),
        description: error instanceof Error ? error.message : undefined,
        type: ToastType.Error,
      });
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const priorityBadge =
    ticket.priority && isElevatedPriority(ticket.priority)
      ? (() => {
          const priorityKey = dk<ServiceTicketPriorityKey>(`priorities.${ticket.priority.toLowerCase()}`);
          return (
            <Badge
              variant={getPriorityBadgeVariant(ticket.priority)}
              size="status"
              className="h-10 min-h-10 px-6 text-sm tracking-[1.5px] shadow-sm"
            >
              {t.has(priorityKey) ? t(priorityKey) : ticket.priority}
            </Badge>
          );
        })()
      : null;

  return (
    <div className="space-y-6">
      <Link
        href="/account/tickets"
        className="inline-flex items-center gap-2 text-sm font-medium text-text-action hover:text-text-action-hover"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('detail.back')}
      </Link>

      <AccountDetailContainer>
        <AccountDetailHeader
          eyebrow={ticket.typeName || undefined}
          title={ticket.subject}
          aside={
            <>
              <AccountDetailStatus label={t('columns.status')}>
                <TicketStatusBadge ticket={ticket} emphasized />
              </AccountDetailStatus>
              {priorityBadge}
            </>
          }
        />

        {/* Request details */}
        <section className="border-b border-border-primary">
          <AccountSectionBar>{t('detail.requestDetails')}</AccountSectionBar>
          <AccountSpecTable>
            <SpecRow
              left={{ label: t('columns.id'), value: <span className="font-mono">#{ticket.id}</span> }}
              right={{ label: t('detail.created'), value: formatTicketDate(ticket.createdAt, locale) }}
            />
            {ticket.updatedAt ? (
              <SpecRow left={{ label: t('updatedAt'), value: formatTicketDate(ticket.updatedAt, locale) }} />
            ) : null}
            {ticket.properties.map((property) => (
              <SpecFullWidthRow key={property.id} label={property.label}>
                {property.productName ?? property.value}
              </SpecFullWidthRow>
            ))}
            {ticket.businessImpact ? (
              <SpecFullWidthRow label={t('detail.businessImpact')}>{ticket.businessImpact}</SpecFullWidthRow>
            ) : null}
            {ticket.summary ? <SpecNoteRow title={t('detail.description')}>{ticket.summary}</SpecNoteRow> : null}
          </AccountSpecTable>
        </section>

        {/* Conversation */}
        <section className="border-b border-border-primary">
          <AccountSectionBar>{t('detail.conversation')}</AccountSectionBar>
          <div className="px-6 py-6 sm:px-8">
            {ticket.messages.length === 0 ? (
              <p className="text-sm text-text-placeholders">{t('detail.noMessages')}</p>
            ) : (
              <ul className="space-y-6">
                {ticket.messages.map((message, index) => {
                  const isCustomer = message.author === 'customer';
                  return (
                    <li key={index} className={cn('flex gap-3', isCustomer && 'flex-row-reverse')}>
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                          isCustomer
                            ? 'bg-ticket-accent text-ticket-accent-contrast'
                            : 'bg-surface-secondary text-text-headings',
                        )}
                      >
                        {isCustomer ? <User className="h-4 w-4" /> : <LifeBuoy className="h-4 w-4" />}
                      </span>
                      <div className={cn('flex min-w-0 max-w-[85%] flex-col gap-1', isCustomer && 'items-end')}>
                        <span className="text-xs font-medium text-text-on-disabled">
                          {isCustomer ? t('detail.you') : t('detail.support')}
                          {message.date && <> · {formatTicketDate(message.date, locale)}</>}
                        </span>
                        <div
                          className={cn(
                            'rounded-2xl px-4 py-3 text-sm text-text-body',
                            isCustomer ? 'rounded-tr-sm bg-ticket-accent-soft' : 'rounded-tl-sm bg-surface-secondary',
                          )}
                        >
                          <SanitizedHtml html={message.message} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Reply */}
            {!ticket.isTerminal && (
              <div className="mt-8 border-t border-border-primary pt-6">
                <label htmlFor="ticket-reply" className="mb-2 block text-sm font-medium text-text-headings">
                  {t('detail.replyLabel')}
                </label>
                <Textarea
                  id="ticket-reply"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder={t('detail.replyPlaceholder')}
                  maxLength={1000}
                />
                <div className="mt-3 flex justify-end">
                  <Button onClick={handleReply} disabled={sending || reply.trim() === ''}>
                    {sending ? <Spinner variant="sm" color="white" /> : t('detail.send')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Feedback */}
        {canShowFeedback && (
          <section className="border-b border-border-primary">
            <AccountSectionBar>{t('detail.feedbackTitle')}</AccountSectionBar>
            <div className="px-6 py-6 sm:px-8">
              <p className="mb-3 text-sm text-text-on-disabled">
                {hasFeedback ? t('detail.feedbackGiven') : t('detail.feedbackPrompt')}
              </p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    disabled={submittingFeedback}
                    onClick={() => handleSubmitFeedback(value)}
                    aria-label={t('detail.rateStars', { count: value })}
                    className="p-0.5 transition-transform hover:scale-110 disabled:opacity-50"
                  >
                    <Star
                      className={cn(
                        'h-6 w-6 transition-colors',
                        value <= ratingScore
                          ? 'fill-current text-text-warning'
                          : 'text-border-primary hover:text-text-warning',
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Actions */}
        {ticket.isReopenable && (
          <footer className="px-6 py-6 sm:px-8">
            <Button variant="secondary" size="small" onClick={handleReopen} disabled={reopening}>
              {reopening ? <Spinner variant="sm" color="primary" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              {t('detail.reopen')}
            </Button>
          </footer>
        )}
      </AccountDetailContainer>
    </div>
  );
}

export default TicketDetail;
