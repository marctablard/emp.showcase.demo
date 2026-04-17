'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, ArrowRight, CircleAlert, CircleCheck, MoveRight } from 'lucide-react';
import { CardTitle } from '@/components/ui/card';
import { H4 } from '@/components/ui/h';
import UiLink from '@/components/ui/link';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { DashboardCardProps } from './dashboard-card';
import { DashboardCard } from './dashboard-card';

// Define the notification item structure
interface NotificationItem {
  id: string;
  count: number;
  title: string;
  type: 'info' | 'warning' | 'danger' | 'success' | 'task';
  href: string;
}

interface NotificationCardProps extends Omit<DashboardCardProps, 'children'> {
  items?: NotificationItem[];
}

export function NotificationCard({ className, title, items: customItems, ...props }: NotificationCardProps) {
  const t = useTranslations('account.Notifications');

  // Default notification items if none provided
  const defaultItems: NotificationItem[] = [
    {
      id: 'new-invoices',
      count: 12,
      title: t('newInvoices'),
      type: 'info',
      href: '/account/invoices',
    },
    {
      id: 'overdue-invoices',
      count: 12,
      title: t('overdueInvoices'),
      type: 'danger',
      href: '/account/invoices?filter=overdue',
    },
    {
      id: 'pending-quotes',
      count: 4,
      title: t('pendingQuotes'),
      type: 'warning',
      href: '/account/quotes',
    },
    {
      id: 'tasks',
      count: 4,
      title: t('tasksToComplete'),
      type: 'task',
      href: '/account/tasks',
    },
    {
      id: 'returns',
      count: 3,
      title: t('openReturns'),
      type: 'success',
      href: '/account/returns',
    },
    {
      id: 'documents',
      count: 3,
      title: t('unreadDocuments'),
      type: 'info',
      href: '/account/documents',
    },
  ];

  const items = customItems || defaultItems;

  // Get the appropriate icon based on notification type
  const getIcon = (type: string, className: string = 'h-5 w-5') => {
    switch (type) {
      case 'info':
        return <CircleAlert className={cn(className, 'text-icon-information')} />;
      case 'warning':
        return <AlertTriangle className={cn(className, 'text-icon-warning')} />;
      case 'danger':
        return <AlertTriangle className={cn(className, 'text-icon-error')} />;
      case 'success':
        return <CircleCheck className={cn(className, 'text-icon-success')} />;
      case 'task':
        return <CircleAlert className={cn(className, 'text-icon-warning')} />;
      default:
        return <CircleAlert className={cn(className, 'text-icon-information')} />;
    }
  };

  return (
    <DashboardCard variant="default" className={cn('py-4', className)} {...props}>
      <div className="flex items-center justify-between flex-wrap mb-4">
        <CardTitle className="me-2">
          <H4>{title || t('title')}</H4>
        </CardTitle>
        <UiLink type="Link" href="/account/notifications" variant="primary" size="m" iconAfter={<ArrowRight />}>
          {t('viewAll')}
        </UiLink>
      </div>

      <div className="flex flex-col">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={cn('flex items-center justify-between py-4 transition-colors rounded px-1', {
              'border-b-1': item.id !== items[items.length - 1].id,
            })}
          >
            <div className="flex items-center gap-3">
              {getIcon(item.type)}
              <span>
                {item.count} {item.title}
              </span>
            </div>
            <MoveRight />
          </Link>
        ))}
      </div>
    </DashboardCard>
  );
}

export default NotificationCard;
