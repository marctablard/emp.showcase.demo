'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ClientOnly } from '@/components/common/client-only';
import { H3 } from '@/components/ui/h';
import { useCustomer } from '@/hooks/customer/useCustomer';
import { useConfigStore } from '@/lib/client/dashboard';
import { Customer } from '@/platform/services/model/customer/customer';
import AccountLayout from '../account-layout';
import { SupportTicketData, SupportTicketDialog } from './cards/support-ticket-dialog';
import Dashboard from './dashboard';
import DashboardControls from './dashboard-controls';

interface AccountDashboardProps {
  customer: Customer;
}

export default function AccountDashboard({ customer }: AccountDashboardProps) {
  const t = useTranslations('account');
  const { setLayouts, getLayouts } = useConfigStore();
  const [isCustomizable, setIsCustomizable] = useState(false);
  // preload customer data for other Dashboard Components
  useCustomer(customer);

  const handleTicketSubmit = (data: SupportTicketData) => {
    console.log('Ticket submitted:', data);
    // Hier kann später die API-Integration erfolgen
  };

  return (
    <AccountLayout>
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
    </AccountLayout>
  );
}
