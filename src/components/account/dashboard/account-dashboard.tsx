'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ClientOnly } from '@/components/common/client-only';
import { H3 } from '@/components/ui/h';
import { useCustomer } from '@/hooks/customer/useCustomer';
import { useConfigStore } from '@/lib/client/dashboard';
import { getLogger } from '@/lib/logger/use-logger-client';
import AccountLayout from '../account-layout';
import { SupportTicketData, SupportTicketDialog } from './cards/support-ticket-dialog';
import Dashboard from './dashboard';
import DashboardControls from './dashboard-controls';

interface AccountDashboardProps {
  // customer prop is now optional since we'll get it from useCustomer hook
  // customer?: Customer;
}

export default function AccountDashboard(_props: AccountDashboardProps) {
  const t = useTranslations('account');
  const { setLayouts, getLayouts } = useConfigStore();
  const [isCustomizable, setIsCustomizable] = useState(false);
  // preload customer data for other Dashboard Components
  const { customer, loading } = useCustomer();

  const handleTicketSubmit = (data: SupportTicketData) => {
    getLogger().debug({ data }, 'Ticket submitted');
    // Hier kann später die API-Integration erfolgen
  };

  return (
    <AccountLayout>
      {loading || !customer ? (
        <div className="space-y-6 mb-6 animate-pulse">
          <div className="relative flex justify-between items-center px-4 gap-2 flex-wrap">
            <div className="h-8 bg-gray-200 rounded w-48"></div>
            <div className="flex gap-4">
              <div className="h-10 bg-gray-200 rounded w-32"></div>
              <div className="h-10 bg-gray-200 rounded w-32"></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 mb-6">
          <div className="relative flex justify-between items-center px-4 gap-2 flex-wrap">
            <H3>
              {t('hello')}{' '}
              <span className="text-text-action">{customer?.firstName + ' ' + customer?.lastName || 'Kunde'}</span>
            </H3>
            <div className="flex gap-4">
              <SupportTicketDialog onSubmit={handleTicketSubmit} />
              <DashboardControls
                isCustomizableInitial={isCustomizable}
                onIsCustomizableChanged={() => {
                  setIsCustomizable(!isCustomizable);
                }}
              />
            </div>
          </div>
          <ClientOnly>
            <Dashboard isCustomizable={isCustomizable} layouts={getLayouts()} layoutChanged={setLayouts} />
          </ClientOnly>
        </div>
      )}
    </AccountLayout>
  );
}
