'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { formatDistanceToNow } from 'date-fns';
import { CheckSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/hooks/company/useCompany';
import { Link } from '@/i18n/navigation';
import { DashboardCard, DashboardCardProps } from './dashboard-card';
import { StatCard } from './stat-card';

export function ApprovalsSummaryCard({}: Omit<DashboardCardProps, 'children'>) {
  const t = useTranslations('account');
  const { getApprovalCountsThisMonth } = useCompany();

  const { pending, total } = getApprovalCountsThisMonth();

  return (
    <StatCard
      title={t('approvals')}
      value={pending + ' / ' + total}
      description={t('approvalsDescription')}
      icon={<CheckSquare className="h-4 w-4" />}
    />
  );
}

export function ApprovalsCard({ className, title, ...props }: Omit<DashboardCardProps, 'children'>) {
  const t = useTranslations('account');
  const { getPendingApprovals } = useCompany();

  const pendingApprovals = getPendingApprovals();

  return (
    <DashboardCard title={title || t('pendingApprovals')} className={className} {...props}>
      <div className="flex items-center justify-between mb-4">
        <Badge variant="secondary">{pendingApprovals.length}</Badge>
      </div>
      <div className="space-y-4">
        {pendingApprovals.length === 0 ? (
          <p className="text-sm text-text-placeholders">{t('noApprovals')}</p>
        ) : (
          pendingApprovals.slice(0, 3).map((approval) => (
            <div key={approval.id} className="border-b pb-3 last:border-0 last:pb-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {approval.type === 'order' && t('orderApproval')}
                    {approval.type === 'quote' && t('quoteApproval')}
                    {approval.type === 'return' && t('returnApproval')}{' '}
                    <span className="font-medium">#{approval.referenceId}</span>
                  </p>
                  <p className="text-sm text-text-placeholders mt-1">
                    {t('requestedBy')}: {approval.requestedBy}
                  </p>
                </div>
                <span className="text-sm text-text-placeholders whitespace-nowrap ml-2">
                  {formatDistanceToNow(new Date(approval.date), { addSuffix: true })}
                </span>
              </div>
            </div>
          ))
        )}
        {pendingApprovals.length > 3 && (
          <div className="text-center">
            <Link href="/account/approvals" className="text-sm text-text-action hover:underline">
              {t('viewAllApprovals')}
            </Link>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}

export default ApprovalsCard;
