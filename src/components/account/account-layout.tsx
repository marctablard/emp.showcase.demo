import React from 'react';
import { useTranslations } from 'next-intl';
import {
  BookOpen,
  Bot,
  Building2,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileText,
  Gauge,
  HandHelping,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  PackageMinus,
  Percent,
  Pin,
  Receipt,
  Settings,
  User,
  UserCog,
  Wrench,
} from 'lucide-react';
import { BreadcrumbContent } from '@/lib/breadcrumb';
import { UiBreadcrumb } from '../ui/molecules/ui-breadcrumb';
import { AccountSidebar } from './account-sidebar';

interface AccountLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: BreadcrumbContent[];
}

export function AccountLayout({ children, breadcrumbs }: AccountLayoutProps) {
  const t = useTranslations('account');

  // Dashboard (standalone item)
  const sidebarItems = [
    {
      href: '/account',
      title: t('sidebar.dashboard'),
      icon: <LayoutDashboard className="h-6 w-6" />,
      active: true,
    },
    {
      href: '/account/ai-agent',
      title: 'Emporix AI Agent',
      icon: <Bot className="h-6 w-6" />,
    },
  ];

  // Sidebar groups with their items
  const sidebarGroups = [
    {
      title: t('sidebar.groups.selfService'),
      items: [
        {
          href: '/account/tickets',
          title: t('sidebar.items.supportTickets'),
          icon: <HandHelping className="h-6 w-6" />,
          counter: 4,
          badgeVariant: 'success' as const,
        },
        {
          href: '/account/calendar',
          title: t('sidebar.items.serviceCalendar'),
          icon: <CalendarDays className="h-6 w-6" />,
        },
        {
          href: '/account/training',
          title: t('sidebar.items.trainingMaterial'),
          icon: <BookOpen className="h-6 w-6" />,
          counter: 1,
        },
      ],
    },
    {
      title: t('sidebar.groups.orderManagement'),
      items: [
        {
          href: '/account/orders',
          title: t('sidebar.items.orderHistory'),
          icon: <History className="h-6 w-6" />,
        },
        {
          href: '/account/invoices',
          title: t('sidebar.items.invoicesPayments'),
          icon: <Receipt className="h-6 w-6" />,
        },
        {
          href: '/account/quotes',
          title: t('sidebar.items.quotes'),
          icon: <Percent className="h-6 w-6" />,
        },
        {
          href: '/account/returns',
          title: t('sidebar.items.returnsClaims'),
          icon: <PackageMinus className="h-6 w-6" />,
          counter: 1,
        },

        {
          href: '/account/approvals',
          title: t('sidebar.items.approvals'),
          icon: <ClipboardCheck className="h-6 w-6" />,
        },
        {
          href: '/account/quick-order',
          title: t('sidebar.items.quickOrder'),
          icon: <Gauge className="h-6 w-6" />,
        },
      ],
    },
    {
      title: t('sidebar.groups.myOrganisation'),
      items: [
        {
          href: '/account/company',
          title: t('sidebar.items.companyManagement'),
          icon: <Building2 className="h-6 w-6" />,
        },
        {
          href: '/account/addresses',
          title: t('sidebar.items.addressManagement'),
          icon: <MapPin className="h-6 w-6" />,
        },
        {
          href: '/account/users',
          title: t('sidebar.items.userManagement'),
          icon: <UserCog className="h-6 w-6" />,
        },
        {
          href: '/account/payment-options',
          title: t('sidebar.items.paymentOptions'),
          icon: <CreditCard className="h-6 w-6" />,
        },
        {
          href: '/account/wishlists',
          title: t('sidebar.items.wishlists'),
          icon: <Pin className="h-6 w-6" />,
        },
        {
          href: '/account/products',
          title: t('sidebar.items.productsMaintenance'),
          icon: <Wrench className="h-6 w-6" />,
        },
        {
          href: '/account/contracts',
          title: t('sidebar.items.contractsAgreements'),
          icon: <FileText className="h-6 w-6" />,
          counter: 1,
        },
      ],
    },
    {
      title: t('sidebar.groups.myAccount'),
      items: [
        {
          href: '/account/profile',
          title: t('sidebar.items.personalData'),
          icon: <User className="h-6 w-6" />,
        },
        {
          href: '/account/settings',
          title: t('sidebar.items.accountSettings'),
          icon: <Settings className="h-6 w-6" />,
        },
        {
          href: '/account/logout',
          title: t('logout'),
          icon: <LogOut className="h-6 w-6" />,
        },
      ],
    },
  ];

  return (
    <div className="lg:mx-9">
      {breadcrumbs && <UiBreadcrumb items={breadcrumbs} className="max-w-6xl mx-auto px-4 lg:px-9 md:gap-x-6" />}
      <div className="flex min-h-screen">
        <AccountSidebar items={sidebarItems} groups={sidebarGroups} />
        <main className="w-full ml-4">{children}</main>
      </div>
    </div>
  );
}

export default AccountLayout;
