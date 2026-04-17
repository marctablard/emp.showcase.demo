import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { HandCoins } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { useCompany } from '@/hooks/company/useCompany';
import { useOrders } from '@/hooks/order/useOrders';
import { formatCurrency } from '@/lib/utils';
import type { DashboardCardProps } from './dashboard-card';
import { DashboardCard } from './dashboard-card';
import StatCard from './stat-card';

interface BudgetProgressProps extends Omit<DashboardCardProps, 'children'> {}

export function BudgetSummaryCard() {
  const t = useTranslations('account');
  const { loading, error, company } = useCompany();
  const { orders, loading: ordersLoading } = useOrders();
  const revenue = useMemo(() => orders?.reduce((sum, order) => sum + (order.price?.total.net || 0), 0) ?? 0, [orders]);
  const currency = orders?.[0]?.currency || 'EUR';

  if (loading || ordersLoading) {
    return (
      <div>
        <Spinner />
      </div>
    );
  }
  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (!company || !orders) {
    return <div>No company data available</div>;
  }

  return (
    <StatCard title={t('revenue')} value={formatCurrency(revenue, currency)} icon={<HandCoins className="h-4 w-4" />} />
  );
}

export function BudgetProgress({ className, title, ...props }: BudgetProgressProps) {
  const t = useTranslations('account');
  const { loading, error, company } = useCompany();
  const { orders, loading: ordersLoading } = useOrders();
  const revenue = useMemo(() => orders?.reduce((sum, order) => sum + (order.price?.total.net || 0), 0) ?? 0, [orders]);
  const currency = orders?.[0]?.currency || 'EUR';

  if (loading || ordersLoading) {
    return (
      <div>
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (!company) {
    return <div>No company data available</div>;
  }

  // Calculate percentage of budget used
  const budgetUsedPercentage = Math.min(100, Math.round((revenue / company?.financials.budget) * 100));

  return (
    <DashboardCard title={title || t('budgetOverview')} className={`${className} h-full`} {...props}>
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t('revenue')}</span>
            <span className="text-sm font-medium">{formatCurrency(revenue, currency)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t('totalBudget')}</span>
            <span className="text-sm font-medium">{formatCurrency(company.financials.budget, currency)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t('remainingBudget')}</span>
            <span className="text-sm font-medium">{formatCurrency(company.financials.budget - revenue, currency)}</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span>{t('budgetUsed')}</span>
            <span>{budgetUsedPercentage}%</span>
          </div>
          <Progress value={budgetUsedPercentage} className="h-2" />
        </div>
      </div>
    </DashboardCard>
  );
}

export default BudgetProgress;
