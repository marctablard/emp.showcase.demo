'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useMessages } from '@/hooks/messages/useMessages';
import { Link } from '@/i18n/navigation';
import { DashboardCard, DashboardCardProps } from './dashboard-card';

interface InboxCardProps extends Omit<DashboardCardProps, 'children'> {}

export function InboxCard({ className, title, ...props }: InboxCardProps) {
  const t = useTranslations('account');
  const { messages, loading: isMessagesLoading } = useMessages();

  if (isMessagesLoading) {
    return (
      <div>
        <Spinner />
      </div>
    );
  }

  return (
    <DashboardCard title={title || t('inbox')} className={className} {...props}>
      <div className="items-center justify-between absolute top-4 right-4">
        <Badge variant="secondary">{messages.length}</Badge>
      </div>
      <div className="space-y-4">
        {messages.length === 0 ? (
          <p className="text-sm text-text-placeholders">{t('noMessages')}</p>
        ) : (
          messages.slice(0, 3).map((message) => (
            <div key={message.id} className="border-b pb-3 last:border-0 last:pb-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium flex items-center">
                    {message.title}
                    {!message.read && <Badge variant="default" className="ml-2 h-1.5 w-1.5 rounded-full p-0" />}
                  </p>
                  <p className="text-sm text-text-placeholders mt-1 line-clamp-2">{message.content}</p>
                </div>
                <span className="text-sm text-text-placeholders whitespace-nowrap ml-2">
                  {formatDistanceToNow(new Date(message.date), { addSuffix: true })}
                </span>
              </div>
            </div>
          ))
        )}
        {messages.length > 3 && (
          <div className="text-center">
            <Link href="/account/inbox" className="text-sm text-text-action hover:underline">
              {t('viewAllMessages')}
            </Link>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}

export default InboxCard;
