'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { H3 } from '@/components/ui/h';
import { useCustomer } from '@/hooks/customer/useCustomer';
import type { BreadcrumbContent } from '@/lib/breadcrumb';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Customer } from '@/platform/services/model/customer/customer';
import AccountLayout from '../account-layout';
import { AiHelperCard } from './cards/ai-helper-card';
import { DocumentsCard } from './cards/documents-card';
import { MyInvoicesCard } from './cards/my-invoices-card';
import { MyOrdersCard } from './cards/my-orders-card';
import NotificationCard from './cards/notification-card';
import type { SupportTicketData } from './cards/support-ticket-dialog';
import { SupportTicketDialog } from './cards/support-ticket-dialog';
import TicketCard from './cards/ticket-card';
import WeatherCard from './cards/weather-card';

interface AccountDashboardProps {
  initialCustomer?: Customer | null;
  breadcrumbs?: BreadcrumbContent[];
}

export default function AccountDashboard({ initialCustomer, breadcrumbs }: AccountDashboardProps) {
  const t = useTranslations('account');
  const { customer, loading: isCustomerLoading } = useCustomer(initialCustomer);

  const handleTicketSubmit = (data: SupportTicketData) => {
    getLogger().debug({ data }, 'Ticket submitted');
    // Hier kann später die API-Integration erfolgen
  };

  if (isCustomerLoading || !customer) {
    return <div className="flex justify-center items-center h-full">{t('loading')}</div>;
  }
  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <div className="mb-6">
        <div className="mb-12 flex justify-between items-start">
          <H3>
            {t('hello')}{' '}
            <span className="text-text-action">{customer?.firstName + ' ' + customer?.lastName || 'Kunde'}</span>
          </H3>

          <SupportTicketDialog onSubmit={handleTicketSubmit} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
          <AiHelperCard className="sm:col-span-2" />
          <WeatherCard className="sm:col-span-1" />
          <NotificationCard className="sm:col-span-1" />
          <TicketCard className="sm:col-span-2" />
          <MyOrdersCard className="sm:col-span-2" />
          <MyInvoicesCard className="sm:col-span-2" />
          <DocumentsCard className="sm:col-span-3" />
        </div>
      </div>
    </AccountLayout>
  );
}
