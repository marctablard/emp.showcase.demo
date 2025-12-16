'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  BookOpen,
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
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { BreadcrumbContent } from '@/lib/breadcrumb';
import { UiBreadcrumb } from '../ui/molecules/ui-breadcrumb';
import { AccountSidebar } from './account-sidebar';

interface AccountLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: BreadcrumbContent[];
}

export function AccountLayout({ children, breadcrumbs }: AccountLayoutProps) {
  const t = useTranslations('account');
  const isDesktop = useBreakpoint('lg');
  const [showSidebarOffcanvas, setShowSidebarOffcanvas] = useState(false);

  // Toggle sidebar offcanvas visibility
  const toggleSidebarOffcanvas = () => {
    setShowSidebarOffcanvas(!showSidebarOffcanvas);
  };

  // Dashboard (standalone item)
  const sidebarItems = [
    {
      href: '/account',
      title: t('sidebar.dashboard'),
      icon: <LayoutDashboard className="h-6 w-6" />,
      active: true,
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

      {/* Mobile Menu Button - only visible on mobile */}
      {!isDesktop && (
        <div className="px-4 py-4">
          <Button variant="secondary" onClick={toggleSidebarOffcanvas}>
            <LayoutDashboard className="h-6 w-6" /> {t('sidebar.menu')}
          </Button>
        </div>
      )}

      <div className="flex min-h-screen">
        {/* Desktop Sidebar - always visible on desktop */}
        {isDesktop && <AccountSidebar items={sidebarItems} groups={sidebarGroups} />}

        {/* Mobile Off-canvas Sidebar */}
        {!isDesktop && showSidebarOffcanvas && (
          <>
            {/* Backdrop - closes the sidebar when clicked */}
            <div className="fixed inset-0 z-40 bg-black/20" onClick={toggleSidebarOffcanvas} aria-hidden="true" />

            {/* Off-canvas Panel */}
            <div className="fixed left-0 top-0 h-[calc(100vh-58px)] max-w-[320px] w-full bg-surface-page z-50 overflow-y-auto shadow-lg">
              <div className="flex justify-end p-4">
                <Button variant="link" size="icon" onClick={toggleSidebarOffcanvas} className="text-black">
                  <X />
                </Button>
              </div>

              <AccountSidebar items={sidebarItems} groups={sidebarGroups} />
            </div>
          </>
        )}

        <main className={`w-full ${isDesktop ? 'ml-4' : ''}`}>{children}</main>
      </div>
    </div>
  );
}

export default AccountLayout;
